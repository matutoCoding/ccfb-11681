// ---------- 成品预览渲染器: PBR(GGX) + 双光源 + 做旧遮罩 ----------
import { Gpu } from '../core/gpu';
import type { Mesh } from '../geom/bags';
import { OrbitCamera, mat4Mul, mat4Translate, mat4RotateY, Vec3 } from './camera';

export interface Light {
  kind: 'sun' | 'spot';
  azimuth: number;   // 度
  elevation: number; // 度
  intensity: number;
  color: [number, number, number];
  enabled: boolean;
}

export const DEFAULT_LIGHTS: Light[] = [
  { kind: 'spot', azimuth: 35, elevation: 55, intensity: 1.6, color: [1.0, 0.93, 0.82], enabled: true }, // 柜台射灯(暖)
  { kind: 'sun', azimuth: 200, elevation: 40, intensity: 0.9, color: [0.95, 0.97, 1.0], enabled: true },  // 日光(冷)
];

export function lightDir(l: Light): Vec3 {
  const az = (l.azimuth * Math.PI) / 180, el = (l.elevation * Math.PI) / 180;
  return [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
}

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUv;
uniform mat4 uProj, uView, uModel;
out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUv;
void main(){
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorldPos = wp.xyz;
  vNormal = mat3(uModel) * aNormal;
  vUv = aUv;
  gl_Position = uProj * uView * wp;
}
`;

const FS = `#version 300 es
precision highp float;
in vec3 vWorldPos;
in vec3 vNormal;
in vec2 vUv;
uniform sampler2D uAlbedo, uNormalMap, uRoughMap, uMask;
uniform float uUseMask;
uniform vec3 uAging;      // wear, wax, crease 强度
uniform vec3 uEye;
uniform vec3 uLightDir[2];
uniform vec3 uLightColor[2];
uniform float uSpot[2];   // 1=聚光(带衰减角), 0=平行光
uniform vec3 uSpotPos[2];
uniform float uNormalStrength;
out vec4 outColor;

const float PI = 3.14159265;

vec3 getTBN(out vec3 T, out vec3 B, vec3 N){
  vec3 dp1 = dFdx(vWorldPos), dp2 = dFdy(vWorldPos);
  vec2 duv1 = dFdx(vUv), duv2 = dFdy(vUv);
  float r = 1.0 / (duv1.x * duv2.y - duv1.y * duv2.x + 1e-8);
  T = normalize((dp1 * duv2.y - dp2 * duv1.y) * r);
  B = normalize((dp2 * duv1.x - dp1 * duv2.x) * r);
  return mat3(T, B, N) * vec3(0.0);
}

float ggxD(float NoH, float rough){
  float a = rough * rough;
  float a2 = a * a;
  float d = (NoH * a2 - NoH) * NoH + 1.0;
  return a2 / (PI * d * d + 1e-7);
}
float ggxV(float NoV, float NoL, float rough){
  float a = rough * rough;
  float gv = NoL * sqrt(NoV * NoV * (1.0 - a) + a);
  float gl = NoV * sqrt(NoL * NoL * (1.0 - a) + a);
  return 0.5 / (gv + gl + 1e-7);
}
vec3 fresnel(vec3 F0, float VoH){
  return F0 + (1.0 - F0) * pow(1.0 - VoH, 5.0);
}

void main(){
  // albedo 贴图存的是 sRGB 值, 转线性再光照
  vec3 albedo = pow(texture(uAlbedo, vUv).rgb, vec3(2.2));
  vec3 nTs = texture(uNormalMap, vUv).xyz * 2.0 - 1.0;
  nTs.xy *= uNormalStrength;
  float rough = texture(uRoughMap, vUv).r;

  // ---- 做旧遮罩 ----
  if(uUseMask > 0.5){
    vec3 mask = texture(uMask, vUv).rgb;
    float wear = mask.r * uAging.x;
    float wax = mask.g * uAging.y;
    float crease = mask.b * uAging.z;
    // 磨损: 变浅变粉, 更毛糙, 法线磨平
    albedo = mix(albedo, albedo * 0.55 + vec3(0.42, 0.36, 0.30) * 0.45, wear);
    rough = mix(rough, min(1.0, rough + 0.35), wear);
    nTs.xy *= (1.0 - 0.7 * wear);
    // 油蜡: 变深变饱和, 更亮(低粗糙)
    vec3 waxed = albedo * vec3(0.62, 0.55, 0.48) * 1.15;
    albedo = mix(albedo, waxed, wax);
    rough = mix(rough, max(0.12, rough - 0.4), wax);
    // 折痕: 压暗 + 微毛糙
    albedo *= (1.0 - 0.45 * crease);
    rough = mix(rough, min(1.0, rough + 0.15), crease);
  }

  vec3 N0 = normalize(vNormal);
  vec3 T, B;
  getTBN(T, B, N0);
  vec3 N = normalize(mat3(T, B, N0) * normalize(nTs));
  vec3 V = normalize(uEye - vWorldPos);
  float NoV = max(dot(N, V), 1e-4);

  vec3 F0 = vec3(0.04); // 皮革电介质
  vec3 col = albedo * 0.05; // 环境

  for(int i = 0; i < 2; i++){
    vec3 L;
    vec3 radiance = uLightColor[i];
    if(uSpot[i] > 0.5){
      // 聚光: 从光源位置指向表面, 带角度衰减
      vec3 toFrag = vWorldPos - uSpotPos[i];
      float dist = length(toFrag);
      L = -toFrag / dist;
      float cosA = dot(normalize(toFrag), normalize(uLightDir[i]));
      float falloff = smoothstep(0.55, 0.75, cosA);
      radiance *= falloff * 2.2 / (1.0 + dist * dist * 2.0);
    } else {
      L = normalize(uLightDir[i]);
    }
    vec3 H = normalize(L + V);
    float NoL = max(dot(N, L), 0.0);
    float NoH = max(dot(N, H), 0.0);
    float VoH = max(dot(V, H), 0.0);
    float D = ggxD(NoH, rough);
    float Vis = ggxV(NoV, NoL, rough);
    vec3 F = fresnel(F0, VoH);
    vec3 spec = D * Vis * F;
    vec3 diff = (1.0 - F) * albedo / PI;
    col += (diff + spec) * radiance * NoL;
  }

  // 简单色调映射 + gamma
  col = col / (col + vec3(0.6));
  col = pow(col, vec3(1.0 / 2.2));
  outColor = vec4(col, 1.0);
}
`;

export interface MaterialTextures {
  albedo: WebGLTexture;
  normal: WebGLTexture;
  roughness: WebGLTexture;
  mask: WebGLTexture | null;
}

export class PreviewRenderer {
  private gpu: Gpu;
  private prog: WebGLProgram;
  private meshes = new Map<string, { vao: WebGLVertexArrayObject; count: number }>();
  camera = new OrbitCamera();
  lights: Light[] = JSON.parse(JSON.stringify(DEFAULT_LIGHTS));
  modelRotation = 0;

  constructor(gpu: Gpu) {
    this.gpu = gpu;
    this.prog = gpu.compile(VS, FS);
  }

  uploadMesh(key: string, mesh: Mesh): void {
    if (this.meshes.has(key)) return;
    const gl = this.gpu.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const bind = (loc: number, data: Float32Array, size: number) => {
      const b = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    bind(0, mesh.positions, 3);
    bind(1, mesh.normals, 3);
    bind(2, mesh.uvs, 2);
    const ib = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.meshes.set(key, { vao, count: mesh.indices.length });
  }

  /** 渲染到 Gpu 的离屏 canvas, 再 blit 到页面上的 2D canvas */
  draw(canvas: HTMLCanvasElement, meshKey: string, tex: MaterialTextures,
       aging: [number, number, number], modelOffset: [number, number, number] = [0, 0, 0],
       extraYaw = 0, viewport?: [number, number, number, number]): void {
    const gl = this.gpu.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (w === 0 || h === 0) return;
    const glCanvas = this.gpu.canvas;
    if (glCanvas.width !== w || glCanvas.height !== h) { glCanvas.width = w; glCanvas.height = h; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const vp = viewport ?? [0, 0, w, h];
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(vp[0], vp[1], vp[2], vp[3]);
    gl.viewport(vp[0], vp[1], vp[2], vp[3]);
    gl.clearColor(0.13, 0.12, 0.11, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);

    const mesh = this.meshes.get(meshKey);
    if (!mesh) return;
    gl.useProgram(this.prog);
    const u = (n: string) => gl.getUniformLocation(this.prog, n);

    gl.uniformMatrix4fv(u('uProj'), false, this.camera.proj(vp[2] / vp[3]));
    gl.uniformMatrix4fv(u('uView'), false, this.camera.view());
    const model = mat4Mul(mat4Translate(...modelOffset), mat4RotateY(this.modelRotation + extraYaw));
    gl.uniformMatrix4fv(u('uModel'), false, model);
    gl.uniform3fv(u('uEye'), this.camera.eye());

    for (let i = 0; i < 2; i++) {
      const l = this.lights[i];
      const d = lightDir(l);
      gl.uniform3fv(u(`uLightDir[${i}]`), d);
      const c = l.enabled ? l.intensity : 0;
      gl.uniform3fv(u(`uLightColor[${i}]`), [l.color[0] * c, l.color[1] * c, l.color[2] * c]);
      gl.uniform1f(u(`uSpot[${i}]`), l.kind === 'spot' ? 1 : 0);
      // 聚光灯位置: 沿方向反推到 1.2m 处
      gl.uniform3fv(u(`uSpotPos[${i}]`), [-d[0] * 1.2, -d[1] * 1.2 + 0.2, -d[2] * 1.2]);
    }
    gl.uniform1f(u('uNormalStrength'), 1.0);
    gl.uniform3fv(u('uAging'), aging);
    gl.uniform1f(u('uUseMask'), tex.mask ? 1 : 0);

    const bindTex = (unit: number, t: WebGLTexture | null, name: string) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t ?? this.gpu.whiteTex);
      gl.uniform1i(u(name), unit);
    };
    bindTex(0, tex.albedo, 'uAlbedo');
    bindTex(1, tex.normal, 'uNormalMap');
    bindTex(2, tex.roughness, 'uRoughMap');
    bindTex(3, tex.mask, 'uMask');

    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);

    // blit 到页面 2D canvas
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const c2d = canvas.getContext('2d');
    if (c2d) {
      if (viewport) c2d.drawImage(glCanvas, vp[0], vp[1], vp[2], vp[3], vp[0], vp[1], vp[2], vp[3]);
      else c2d.drawImage(glCanvas, 0, 0);
    }
  }
}
