// ---------- 做旧画笔: 射线拾取 UV, 在遮罩贴图上盖章 ----------
import { Gpu, QUAD_VS } from '../core/gpu';
import type { Mesh } from '../geom/bags';
import { Mat4, Vec3, sub3, dot3, cross3 } from '../render/camera';

export type BrushChannel = 'wear' | 'wax' | 'crease';

const SPLAT_FS = `#version 300 es
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uUv;        // 章中心 (UV 空间)
uniform float uRadius;   // UV 半径
uniform float uStrength; // 0..1
uniform vec3 uChannel;   // 写入哪个通道
uniform float uAspect;   // v 方向尺度补偿
in vec2 vUv;
out vec4 outColor;
void main(){
  vec4 prev = texture(uPrev, vUv);
  // UV 环面距离 (u 向环绕, 贴图周向无缝)
  vec2 d = vUv - uUv;
  d.x -= floor(d.x + 0.5);
  d.y *= uAspect;
  float dist = length(d);
  float fall = smoothstep(uRadius, uRadius * 0.25, dist);
  vec3 add = uChannel * fall * uStrength;
  outColor = vec4(clamp(prev.rgb + add, 0.0, 1.0), 1.0);
}
`;

export class BrushPainter {
  private gpu: Gpu;
  private prog: WebGLProgram;
  private targets: [{ tex: WebGLTexture; fbo: WebGLFramebuffer }, { tex: WebGLTexture; fbo: WebGLFramebuffer }] | null = null;
  private front = 0;
  size = 0;
  private undoStack: ImageData[] = [];
  private strokeActive = false;

  constructor(gpu: Gpu) {
    this.gpu = gpu;
    this.prog = gpu.compile(QUAD_VS, SPLAT_FS);
  }

  init(size: number): WebGLTexture {
    this.size = size;
    if (this.targets) {
      this.gpu.deleteTarget(this.targets[0]);
      this.gpu.deleteTarget(this.targets[1]);
    }
    this.targets = [this.gpu.createTarget(size, size), this.gpu.createTarget(size, size)];
    this.clear();
    this.undoStack = [];
    return this.targets[this.front].tex;
  }

  get texture(): WebGLTexture | null {
    return this.targets ? this.targets[this.front].tex : null;
  }

  clear(): void {
    if (!this.targets) return;
    const gl = this.gpu.gl;
    for (const t of this.targets) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  beginStroke(): void {
    if (!this.targets || this.strokeActive) return;
    this.strokeActive = true;
    // 快照用于撤销
    const img = this.gpu.readImageData(this.targets[this.front].fbo, this.size, this.size);
    this.undoStack.push(img);
    if (this.undoStack.length > 12) this.undoStack.shift();
  }

  endStroke(): void { this.strokeActive = false; }

  /** 在 UV 处盖章 (channel: 0=R磨损 1=G油蜡 2=B折痕) */
  stamp(u: number, v: number, radius: number, strength: number, channel: BrushChannel): void {
    if (!this.targets) return;
    const gl = this.gpu.gl;
    const src = this.targets[this.front];
    const dst = this.targets[1 - this.front];
    const ch: [number, number, number] =
      channel === 'wear' ? [1, 0, 0] : channel === 'wax' ? [0, 1, 0] : [0, 0, 1];
    this.gpu.runProgram(this.prog, dst, this.size, this.size, (gl2, prog) => {
      gl2.activeTexture(gl2.TEXTURE0);
      gl2.bindTexture(gl2.TEXTURE_2D, src.tex);
      gl2.uniform1i(gl2.getUniformLocation(prog, 'uPrev'), 0);
      gl2.uniform2f(gl2.getUniformLocation(prog, 'uUv'), u, v);
      gl2.uniform1f(gl2.getUniformLocation(prog, 'uRadius'), radius);
      gl2.uniform1f(gl2.getUniformLocation(prog, 'uStrength'), strength);
      gl2.uniform3f(gl2.getUniformLocation(prog, 'uChannel'), ch[0], ch[1], ch[2]);
      gl2.uniform1f(gl2.getUniformLocation(prog, 'uAspect'), 1.0);
    });
    this.front = 1 - this.front;
    void gl;
  }

  undo(): boolean {
    const img = this.undoStack.pop();
    if (!img || !this.targets) return false;
    const gl = this.gpu.gl;
    // 写回 front 纹理 (注意 ImageData 是翻正后的, 需要翻转上传)
    gl.bindTexture(gl.TEXTURE_2D, this.targets[this.front].tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.size, this.size, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array(img.data.buffer));
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    return true;
  }

  /** 导出当前遮罩为 PNG dataURL (翻正) */
  exportPng(): string | null {
    if (!this.targets) return null;
    const img = this.gpu.readImageData(this.targets[this.front].fbo, this.size, this.size);
    const c = document.createElement('canvas');
    c.width = this.size; c.height = this.size;
    c.getContext('2d')!.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }

  /** 从 PNG dataURL 载入遮罩 */
  async loadPng(dataUrl: string): Promise<void> {
    if (!this.targets) return;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    const c = document.createElement('canvas');
    c.width = this.size; c.height = this.size;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, this.size, this.size);
    const data = ctx.getImageData(0, 0, this.size, this.size);
    const gl = this.gpu.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.targets[this.front].tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.size, this.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  }
}

// ---------- 射线与网格求交 (CPU, 用于取 UV) ----------

export interface RayHit { u: number; v: number; dist: number; }

export function raycastMesh(
  origin: Vec3, dir: Vec3, mesh: Mesh, model: Mat4,
): RayHit | null {
  // 模型只有旋转Y+平移: 把射线变换到模型空间
  // 这里直接在世界空间遍历三角形 (网格 ~10k 三角形, 可接受)
  const p = mesh.positions, idx = mesh.indices, uv = mesh.uvs;
  let best: RayHit | null = null;
  // 提取模型变换 (平移 + rotY): 手动应用
  const apply = (x: number, y: number, z: number): Vec3 => [
    model[0] * x + model[4] * y + model[8] * z + model[12],
    model[1] * x + model[5] * y + model[9] * z + model[13],
    model[2] * x + model[6] * y + model[10] * z + model[14],
  ];
  for (let i = 0; i < idx.length; i += 3) {
    const ia = idx[i], ib = idx[i + 1], ic = idx[i + 2];
    const a = apply(p[ia * 3], p[ia * 3 + 1], p[ia * 3 + 2]);
    const b = apply(p[ib * 3], p[ib * 3 + 1], p[ib * 3 + 2]);
    const c = apply(p[ic * 3], p[ic * 3 + 1], p[ic * 3 + 2]);
    const hit = rayTriangle(origin, dir, a, b, c);
    if (hit !== null && (best === null || hit < best.dist)) {
      // 重心坐标 -> UV
      const bc = barycentric(origin, dir, a, b, c)!;
      const u = bc[0] * uv[ia * 2] + bc[1] * uv[ib * 2] + bc[2] * uv[ic * 2];
      const v = bc[0] * uv[ia * 2 + 1] + bc[1] * uv[ib * 2 + 1] + bc[2] * uv[ic * 2 + 1];
      best = { u: u - Math.floor(u), v, dist: hit };
    }
  }
  return best;
}

function rayTriangle(o: Vec3, d: Vec3, a: Vec3, b: Vec3, c: Vec3): number | null {
  const e1 = sub3(b, a), e2 = sub3(c, a);
  const p = cross3(d, e2);
  const det = dot3(e1, p);
  if (Math.abs(det) < 1e-10) return null;
  const inv = 1 / det;
  const t = sub3(o, a);
  const u = dot3(t, p) * inv;
  if (u < 0 || u > 1) return null;
  const q = cross3(t, e1);
  const v = dot3(d, q) * inv;
  if (v < 0 || u + v > 1) return null;
  const dist = dot3(e2, q) * inv;
  return dist > 0 ? dist : null;
}

function barycentric(o: Vec3, d: Vec3, a: Vec3, b: Vec3, c: Vec3): [number, number, number] | null {
  const e1 = sub3(b, a), e2 = sub3(c, a);
  const p = cross3(d, e2);
  const det = dot3(e1, p);
  if (Math.abs(det) < 1e-10) return null;
  const inv = 1 / det;
  const t = sub3(o, a);
  const u = dot3(t, p) * inv;
  const q = cross3(t, e1);
  const v = dot3(d, q) * inv;
  return [1 - u - v, u, v];
}

/** 由相机和屏幕坐标生成世界射线 */
export function screenRay(ndcX: number, ndcY: number, viewInv: Mat4, proj: Mat4, aspect: number): { origin: Vec3; dir: Vec3 } {
  // 从投影矩阵反推视锥参数
  const f = proj[5]; // 1/tan(fov/2)
  const dirCam: Vec3 = [(ndcX * aspect) / f, ndcY / f, -1];
  // 相机系 -> 世界
  const dir: Vec3 = [
    viewInv[0] * dirCam[0] + viewInv[4] * dirCam[1] + viewInv[8] * dirCam[2],
    viewInv[1] * dirCam[0] + viewInv[5] * dirCam[1] + viewInv[9] * dirCam[2],
    viewInv[2] * dirCam[0] + viewInv[6] * dirCam[1] + viewInv[10] * dirCam[2],
  ];
  const l = Math.hypot(dir[0], dir[1], dir[2]);
  const origin: Vec3 = [viewInv[12], viewInv[13], viewInv[14]];
  return { origin, dir: [dir[0] / l, dir[1] / l, dir[2] / l] };
}
