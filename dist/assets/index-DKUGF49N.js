(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))n(r);new MutationObserver(r=>{for(const o of r)if(o.type==="childList")for(const a of o.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&n(a)}).observe(document,{childList:!0,subtree:!0});function t(r){const o={};return r.integrity&&(o.integrity=r.integrity),r.referrerPolicy&&(o.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?o.credentials="include":r.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function n(r){if(r.ep)return;r.ep=!0;const o=t(r);fetch(r.href,o)}})();class me{constructor(e){this.canvas=e;const t=e.getContext("webgl2",{preserveDrawingBuffer:!0,antialias:!0,premultipliedAlpha:!1});if(!t)throw new Error("需要 WebGL2 支持,请使用新版 Chrome/Edge/Firefox");this.gl=t,this.whiteTex=t.createTexture(),t.bindTexture(t.TEXTURE_2D,this.whiteTex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA8,1,1,0,t.RGBA,t.UNSIGNED_BYTE,new Uint8Array([255,255,255,255])),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.NEAREST),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.NEAREST),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.REPEAT),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.REPEAT);const n=t.createVertexArray();t.bindVertexArray(n);const r=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,r),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),t.STATIC_DRAW),t.enableVertexAttribArray(0),t.vertexAttribPointer(0,2,t.FLOAT,!1,0,0),this.quadVAO=n,t.bindVertexArray(null)}compile(e,t){const n=this.gl,r=(a,l)=>{const s=n.createShader(a);if(n.shaderSource(s,l),n.compileShader(s),!n.getShaderParameter(s,n.COMPILE_STATUS)){const c=n.getShaderInfoLog(s);throw new Error(`Shader 编译失败: ${c}
${l}`)}return s},o=n.createProgram();if(n.attachShader(o,r(n.VERTEX_SHADER,e)),n.attachShader(o,r(n.FRAGMENT_SHADER,t)),n.linkProgram(o),!n.getProgramParameter(o,n.LINK_STATUS))throw new Error(`Shader 链接失败: ${n.getProgramInfoLog(o)}`);return o}createTarget(e,t){const n=this.gl,r=n.createTexture();n.bindTexture(n.TEXTURE_2D,r),n.texImage2D(n.TEXTURE_2D,0,n.RGBA8,e,t,0,n.RGBA,n.UNSIGNED_BYTE,null),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MAG_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.REPEAT),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.REPEAT);const o=n.createFramebuffer();if(n.bindFramebuffer(n.FRAMEBUFFER,o),n.framebufferTexture2D(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,r,0),n.checkFramebufferStatus(n.FRAMEBUFFER)!==n.FRAMEBUFFER_COMPLETE)throw new Error("FBO 不完整");return n.bindFramebuffer(n.FRAMEBUFFER,null),{tex:r,fbo:o}}runProgram(e,t,n,r,o){const a=this.gl;a.bindFramebuffer(a.FRAMEBUFFER,t?t.fbo:null),a.viewport(0,0,n,r),a.useProgram(e),o?.(a,e),a.bindVertexArray(this.quadVAO),a.drawArrays(a.TRIANGLES,0,3),a.bindVertexArray(null)}readPixels(e,t,n){const r=this.gl,o=new Uint8Array(t*n*4);return r.bindFramebuffer(r.FRAMEBUFFER,e),r.readPixels(0,0,t,n,r.RGBA,r.UNSIGNED_BYTE,o),r.bindFramebuffer(r.FRAMEBUFFER,null),o}readImageData(e,t,n){const r=this.readPixels(e,t,n),o=new ImageData(t,n),a=t*4;for(let l=0;l<n;l++){const s=(n-1-l)*a;o.data.set(r.subarray(s,s+a),l*a)}return o}deleteTarget(e){this.gl.deleteTexture(e.tex),this.gl.deleteFramebuffer(e.fbo)}}const V=`#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }
`,Z=`
precision highp float;
precision highp int;

uint hashu(uint x){
  x ^= x >> 16; x *= 0x7feb352dU;
  x ^= x >> 15; x *= 0x846ca68bU;
  x ^= x >> 16; return x;
}

// 晶格 hash -> [0,1], 纯函数
float hashf(ivec2 c, uint seed){
  uint h = hashu( uint(c.x) * 0x8da6b343U ^ hashu( uint(c.y) * 0xd8163841U ^ seed ) );
  return float(h) * (1.0 / 4294967295.0);
}

// 周期 value noise, u 以晶格为单位, period = 晶格数
float vnoise(vec2 u, int period, uint seed){
  ivec2 i = ivec2(floor(u));
  vec2 f = fract(u);
  vec2 w = f * f * (3.0 - 2.0 * f);
  ivec2 p = ivec2(period);
  float v00 = hashf((i + ivec2(0,0)) % p, seed);
  float v10 = hashf((i + ivec2(1,0)) % p, seed);
  float v01 = hashf((i + ivec2(0,1)) % p, seed);
  float v11 = hashf((i + ivec2(1,1)) % p, seed);
  return mix(mix(v00, v10, w.x), mix(v01, v11, w.x), w.y);
}

float fbm(vec2 u, int period, uint seed, int octaves){
  float sum = 0.0, amp = 0.5, norm = 0.0;
  vec2 x = u;
  int p = period;
  for(int k = 0; k < 8; k++){
    if(k >= octaves) break;
    sum += amp * vnoise(x, p, seed + uint(k) * 0x85ebca6bU);
    norm += amp;
    amp *= 0.5;
    x *= 2.0;
    p *= 2;
  }
  return sum / norm;
}

// 周期 voronoi: 返回 F1, F2 与最近特征点所在晶格
void voronoi(vec2 u, int period, uint seed, out float f1, out float f2, out ivec2 cell){
  ivec2 base = ivec2(floor(u));
  f1 = 8.0; f2 = 8.0; cell = base;
  ivec2 p = ivec2(period);
  for(int dy = -1; dy <= 1; dy++)
  for(int dx = -1; dx <= 1; dx++){
    ivec2 g = base + ivec2(dx, dy);
    ivec2 wrapped = ((g % p) + p) % p;
    vec2 fp = vec2(g) + vec2(hashf(wrapped, seed), hashf(wrapped, seed ^ 0xc2b2ae35U));
    vec2 r = fp - u;
    float d = dot(r, r);
    if(d < f1){ f2 = f1; f1 = d; cell = wrapped; }
    else if(d < f2){ f2 = d; }
  }
  f1 = sqrt(f1); f2 = sqrt(f2);
}
`;function ge(i){const e=i*Math.PI/180,t=8;let n=Math.round(Math.cos(e)*t),r=Math.round(Math.sin(e)*t);n===0&&r===0&&(n=1);const o=ie(Math.abs(n),Math.abs(r));return{a:n/o,b:r/o}}function ie(i,e){return e===0?i:ie(e,i%e)}const ve=i=>`#version 300 es
${i}
uniform ivec2 uSize;
uniform int uKind;
uniform int uCells;
uniform uint uSeed;
uniform float uDepth;
uniform float uGrain;
uniform vec2 uDir;    // 十字纹有理方向 (未归一化的整数方向)
uniform float uCrack;
out vec4 outColor;

float litchi(vec2 u, int P, uint seed, float crack, float grain){
  float f1, f2; ivec2 cell;
  voronoi(u, P, seed, f1, f2, cell);
  float edge = f2 - f1;                       // 0 在边界
  float wall = smoothstep(0.0, 0.08 + crack * 0.25, edge);   // 沟壑
  float dome = 1.0 - smoothstep(0.0, 0.75, f1);              // 圆顶
  dome = pow(dome, 1.5 - crack);
  float jitter = 0.85 + 0.3 * hashf(cell, seed ^ 0x27d4eb2fU);
  float h = wall * (0.35 + 0.65 * dome) * jitter;
  h += (fbm(u * 6.0, P * 6, seed ^ 0x165667b1U, 4) - 0.5) * 0.25 * grain;
  return clamp(h, 0.0, 1.0);
}

float crosshatch(vec2 u, int P, uint seed, float crack, float grain){
  // 有理方向 => 严格周期; 频率取 m*L/P 使每 tile 恰好整数个波
  float L = length(uDir);
  vec2 dir1 = uDir / L;
  vec2 dir2 = vec2(-uDir.y, uDir.x) / L;
  float m = float(P) * 2.0;                    // 每晶格 2 根线
  float freq = m * L / float(P);
  float t1 = fract(dot(u, dir1) * freq);
  float t2 = fract(dot(u, dir2) * freq);
  float tri1 = 1.0 - abs(2.0 * t1 - 1.0);
  float tri2 = 1.0 - abs(2.0 * t2 - 1.0);
  float sharp = 2.0 + (1.0 - crack) * 6.0;     // crack 控制线宽/锐度
  float r1 = pow(tri1, sharp);
  float r2 = pow(tri2, sharp);
  float h = max(r1, r2) * 0.85 + min(r1, r2) * 0.15;
  h += (fbm(u * 8.0, P * 8, seed ^ 0x9e3779b9U, 3) - 0.5) * 0.2 * grain;
  return clamp(h, 0.0, 1.0);
}

float croc(vec2 u, int P, uint seed, float crack, float grain){
  float f1, f2; ivec2 cell;
  voronoi(u, P, seed, f1, f2, cell);
  float edge = f2 - f1;
  float w = 0.10 + crack * 0.35;               // 裂纹宽度
  float plateau = smoothstep(0.0, w, edge);
  float dome = 1.0 - smoothstep(0.1, 0.9, f1) * 0.4;
  float jitter = 0.75 + 0.5 * hashf(cell, seed ^ 0x27d4eb2fU);
  float h = plateau * dome * jitter;
  // 鳞片内细皱
  h += (fbm(u * 5.0, P * 5, seed ^ 0x85ebca6bU, 4) - 0.5) * 0.18 * grain * plateau;
  return clamp(h, 0.0, 1.0);
}

void main(){
  int P = uCells;
  // 关键: fragCoord-0.5 把像素中心映射到 [0, size-1] => 末列/行与首列/行逐位相等
  vec2 u = (gl_FragCoord.xy - 0.5) / vec2(uSize - 1) * float(P);
  // 关键2: u=P 折回 0, 下游所有函数在边缘拿到逐位相同的输入
  u = mod(u, vec2(float(P)));
  float h;
  if(uKind == 0)      h = litchi(u, P, uSeed, uCrack, uGrain);
  else if(uKind == 1) h = crosshatch(u, P, uSeed, uCrack, uGrain);
  else                h = croc(u, P, uSeed, uCrack, uGrain);
  h *= uDepth;
  outColor = vec4(h, h, h, 1.0);
}
`,be=`#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uHeight;
uniform ivec2 uSize;
uniform float uStrength;
out vec4 outColor;

float H(ivec2 p){
  ivec2 period = uSize - 1;              // 唯一周期像素数
  ivec2 w = ivec2( (p.x % period.x + period.x) % period.x,
                   (p.y % period.y + period.y) % period.y );
  return texelFetch(uHeight, w, 0).r;
}

void main(){
  ivec2 p = ivec2(gl_FragCoord.xy);
  float hl = H(p + ivec2(-1, 0));
  float hr = H(p + ivec2( 1, 0));
  float hd = H(p + ivec2( 0,-1));
  float hu = H(p + ivec2( 0, 1));
  // 每像素世界尺度: 假设 1 tile = 0.1m, 高度幅值 ~8mm
  float texel = 0.1 / float(uSize.x - 1);
  float amp = 0.008 * uStrength;
  vec3 n = normalize(vec3(-(hr - hl) * amp / (2.0 * texel),
                          -(hu - hd) * amp / (2.0 * texel), 1.0));
  outColor = vec4(n * 0.5 + 0.5, 1.0);
}
`,we=`#version 300 es
${Z}
uniform sampler2D uHeight;
uniform ivec2 uSize;
uniform int uCells;
uniform uint uSeed;
uniform float uBase;
out vec4 outColor;
void main(){
  ivec2 p = ivec2(gl_FragCoord.xy);
  float h = texelFetch(uHeight, p, 0).r;
  int P = uCells;
  vec2 u = (gl_FragCoord.xy - 0.5) / vec2(uSize - 1) * float(P);
  u = mod(u, vec2(float(P)));
  float g = fbm(u * 4.0, P * 4, uSeed ^ 0x27d4eb2fU, 3);
  float r = uBase + (1.0 - h) * 0.18 + (g - 0.5) * 0.12;
  r = clamp(r, 0.05, 1.0);
  outColor = vec4(r, r, r, 1.0);
}
`,Ee=`#version 300 es
${Z}
uniform sampler2D uHeight;
uniform ivec2 uSize;
uniform int uCells;
uniform uint uSeed;
uniform vec3 uBaseColor;
out vec4 outColor;
void main(){
  ivec2 p = ivec2(gl_FragCoord.xy);
  float h = texelFetch(uHeight, p, 0).r;
  int P = uCells;
  vec2 u = (gl_FragCoord.xy - 0.5) / vec2(uSize - 1) * float(P);
  u = mod(u, vec2(float(P)));
  float g = fbm(u * 3.0, P * 3, uSeed ^ 0x165667b1U, 4);
  float lum = 0.90 + 0.20 * g;                 // 颗粒明度
  float ao = mix(0.55, 1.0, smoothstep(0.0, 0.45, h));  // 沟壑变暗
  vec3 col = uBaseColor * lum * ao;
  outColor = vec4(col, 1.0);
}
`;class Te{constructor(e){this.gpu=e,this.progHeight=e.compile(V,ve(Z)),this.progNormal=e.compile(V,be),this.progRough=e.compile(V,we),this.progAlbedo=e.compile(V,Ee)}generate(e,t){const n=this.gpu.gl,r=performance.now(),o=e.emboss,a=o.kind==="litchi"?0:o.kind==="crosshatch"?1:2,l=ge(o.angle),s=this.gpu.createTarget(t,t);this.gpu.runProgram(this.progHeight,s,t,t,(p,g)=>{this.setCommon(p,g,t,o.cells,e.seed),p.uniform1i(p.getUniformLocation(g,"uKind"),a),p.uniform1f(p.getUniformLocation(g,"uDepth"),o.depth),p.uniform1f(p.getUniformLocation(g,"uGrain"),o.grain),p.uniform1f(p.getUniformLocation(g,"uCrack"),o.crack),p.uniform2f(p.getUniformLocation(g,"uDir"),l.a,l.b)});const c=p=>{n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,s.tex),n.uniform1i(n.getUniformLocation(p,"uHeight"),0),n.uniform2i(n.getUniformLocation(p,"uSize"),t,t)},d=this.gpu.createTarget(t,t);this.gpu.runProgram(this.progNormal,d,t,t,(p,g)=>{c(g),p.uniform1f(p.getUniformLocation(g,"uStrength"),e.normalStrength)});const f=this.gpu.createTarget(t,t);this.gpu.runProgram(this.progRough,f,t,t,(p,g)=>{c(g),this.setCommon(p,g,t,o.cells,e.seed),p.uniform1f(p.getUniformLocation(g,"uBase"),e.roughness)});const m=this.gpu.createTarget(t,t);this.gpu.runProgram(this.progAlbedo,m,t,t,(p,g)=>{c(g),this.setCommon(p,g,t,o.cells,e.seed);const w=xe(e.baseColor);p.uniform3f(p.getUniformLocation(g,"uBaseColor"),w[0],w[1],w[2])});const u={height:this.gpu.readImageData(s.fbo,t,t),normal:this.gpu.readImageData(d.fbo,t,t),roughness:this.gpu.readImageData(f.fbo,t,t),albedo:this.gpu.readImageData(m.fbo,t,t)};return this.gpu.deleteTarget(s),this.gpu.deleteTarget(d),this.gpu.deleteTarget(f),this.gpu.deleteTarget(m),{maps:u,ms:performance.now()-r}}setCommon(e,t,n,r,o){e.uniform2i(e.getUniformLocation(t,"uSize"),n,n),e.uniform1i(e.getUniformLocation(t,"uCells"),r),e.uniform1ui(e.getUniformLocation(t,"uSeed"),o>>>0)}}function xe(i){const e=/^#?([0-9a-f]{6})$/i.exec(i);if(!e)return[.5,.35,.2];const t=parseInt(e[1],16);return[(t>>16&255)/255,(t>>8&255)/255,(t&255)/255]}function Re(i,e){const t=document.createElement("canvas");t.width=i.width,t.height=i.height,t.getContext("2d").putImageData(i,0,0),t.toBlob(n=>{if(!n)return;const r=document.createElement("a");r.href=URL.createObjectURL(n),r.download=e,r.click(),setTimeout(()=>URL.revokeObjectURL(r.href),5e3)},"image/png")}function ye(i,e){const t=[],n=i.generate(e,2048),r=n.ms;t.push(`2048 生成耗时: ${r.toFixed(1)} ms`);let o=0;for(const[d,f]of Object.entries(n.maps)){const m=Se(f);o=Math.max(o,m),t.push(`${d} 四边最大像素差: ${m}`)}const a=i.generate(e,512),l=i.generate(e,512);let s=!0;for(const d of Object.keys(a.maps)){const f=a.maps[d].data,m=l.maps[d].data;for(let u=0;u<f.length;u++)if(f[u]!==m[u]){s=!1;break}if(!s)break}t.push(`同种子两次生成字节级一致: ${s?"是":"否"}`);const c=o===0&&s&&r<3e3;return{seamMaxDiff:o,deterministic:s,gen2048Ms:r,pass:c,details:t}}function Se(i){const{width:e,height:t,data:n}=i;let r=0;for(let o=0;o<t;o++)for(let a=0;a<4;a++){const l=n[(o*e+0)*4+a],s=n[(o*e+e-1)*4+a],c=Math.abs(l-s);c>r&&(r=c)}for(let o=0;o<e;o++)for(let a=0;a<4;a++){const l=n[(0*e+o)*4+a],s=n[((t-1)*e+o)*4+a],c=Math.abs(l-s);c>r&&(r=c)}return r}const Me="leather-studio",O="materials",J="settings";function Ae(){return new Promise((i,e)=>{const t=indexedDB.open(Me,1);t.onupgradeneeded=()=>{const n=t.result;n.objectStoreNames.contains(O)||n.createObjectStore(O,{keyPath:"id"}),n.objectStoreNames.contains(J)||n.createObjectStore(J)},t.onsuccess=()=>i(t.result),t.onerror=()=>e(t.error)})}function j(i,e,t){return Ae().then(n=>new Promise((r,o)=>{const a=n.transaction(i,e),l=t(a.objectStore(i));l.onsuccess=()=>r(l.result),l.onerror=()=>o(l.error),a.oncomplete=()=>n.close()}))}async function q(){return(await j(O,"readonly",e=>e.getAll())).sort((e,t)=>e.createdAt-t.createdAt)}async function Y(i){i.updatedAt=Date.now(),await j(O,"readwrite",e=>e.put(i))}async function Pe(i){await j(O,"readwrite",e=>e.delete(i))}async function Ue(){await j(O,"readwrite",i=>i.clear()),await j(J,"readwrite",i=>i.clear())}function Le(i){const e={format:"leather-pack",version:1,exportedAt:new Date().toISOString(),materials:i},t=new Blob([JSON.stringify(e,null,2)],{type:"application/json"}),n=document.createElement("a");n.href=URL.createObjectURL(t),n.download=`leather-pack-${new Date().toISOString().slice(0,10)}.json`,n.click(),setTimeout(()=>URL.revokeObjectURL(n.href),5e3)}async function Fe(i){const e=await i.text(),t=JSON.parse(e);if(t.format!=="leather-pack"||!Array.isArray(t.materials))throw new Error("不是有效的材质包文件");const n=new Set((await q()).map(a=>a.id));let r=0,o=0;for(const a of t.materials){if(!a.id||!a.emboss||!a.aging){o++;continue}n.has(a.id)&&(a.id=`${a.id}-IMP${r}`),await Y(a),r++}return{added:r,skipped:o}}const Ce={kind:"litchi",cells:24,depth:.6,grain:.5,angle:45,crack:.35};function se(i){const e=i*2654435761>>>0;return{id:_e(e),name:`新皮料 ${i}`,seed:e,baseColor:"#8a5a33",roughness:.55,normalStrength:1,emboss:{...Ce},aging:{maskPng:null,wear:1,wax:1,crease:1},createdAt:Date.now(),updatedAt:Date.now()}}function _e(i){const e="0123456789ABCDEFGHJKMNPQRSTVWXYZ";let t=(i^2654435769)>>>0,n="";for(let r=0;r<5;r++)t=Math.imul(t,1664525)+1013904223>>>0,n+=e[t%e.length];return`LTH-${n}`}function ee(){const i=new Float32Array(16);return i[0]=i[5]=i[10]=i[15]=1,i}function Ie(i,e,t,n){const r=1/Math.tan(i/2),o=new Float32Array(16);return o[0]=r/e,o[5]=r,o[10]=(n+t)/(t-n),o[11]=-1,o[14]=2*n*t/(t-n),o}function ke(i,e,t){const n=ae(B(i,e)),r=ae(G(t,n)),o=G(n,r),a=new Float32Array(16);return a[0]=r[0],a[4]=r[1],a[8]=r[2],a[12]=-I(r,i),a[1]=o[0],a[5]=o[1],a[9]=o[2],a[13]=-I(o,i),a[2]=n[0],a[6]=n[1],a[10]=n[2],a[14]=-I(n,i),a[15]=1,a}function ce(i,e){const t=new Float32Array(16);for(let n=0;n<4;n++)for(let r=0;r<4;r++){let o=0;for(let a=0;a<4;a++)o+=i[a*4+r]*e[n*4+a];t[n*4+r]=o}return t}function le(i,e,t){const n=ee();return n[12]=i,n[13]=e,n[14]=t,n}function ue(i){const e=ee(),t=Math.cos(i),n=Math.sin(i);return e[0]=t,e[2]=-n,e[8]=n,e[10]=t,e}function De(i){const e=ee();for(let n=0;n<3;n++)for(let r=0;r<3;r++)e[r*4+n]=i[n*4+r];const t=[i[12],i[13],i[14]];return e[12]=-(e[0]*t[0]+e[4]*t[1]+e[8]*t[2]),e[13]=-(e[1]*t[0]+e[5]*t[1]+e[9]*t[2]),e[14]=-(e[2]*t[0]+e[6]*t[1]+e[10]*t[2]),e}function B(i,e){return[i[0]-e[0],i[1]-e[1],i[2]-e[2]]}function G(i,e){return[i[1]*e[2]-i[2]*e[1],i[2]*e[0]-i[0]*e[2],i[0]*e[1]-i[1]*e[0]]}function I(i,e){return i[0]*e[0]+i[1]*e[1]+i[2]*e[2]}function ae(i){const e=Math.hypot(i[0],i[1],i[2])||1;return[i[0]/e,i[1]/e,i[2]/e]}class Ne{constructor(){this.yaw=.6,this.pitch=.35,this.dist=1.1,this.target=[0,.18,0],this.fov=38*Math.PI/180}view(){const e=this.eye();return ke(e,this.target,[0,1,0])}eye(){const e=Math.cos(this.pitch),t=Math.sin(this.pitch);return[this.target[0]+this.dist*e*Math.sin(this.yaw),this.target[1]+this.dist*t,this.target[2]+this.dist*e*Math.cos(this.yaw)]}proj(e){return Ie(this.fov,e,.01,20)}rotate(e,t){this.yaw-=e*.008,this.pitch=re(this.pitch+t*.008,-1.4,1.4)}zoom(e){this.dist=re(this.dist*(e>0?1.1:.9),.25,4)}}function re(i,e,t){return Math.min(t,Math.max(e,i))}const Be=[{kind:"spot",azimuth:35,elevation:55,intensity:1.6,color:[1,.93,.82],enabled:!0},{kind:"sun",azimuth:200,elevation:40,intensity:.9,color:[.95,.97,1],enabled:!0}];function $e(i){const e=i.azimuth*Math.PI/180,t=i.elevation*Math.PI/180;return[Math.cos(t)*Math.sin(e),Math.sin(t),Math.cos(t)*Math.cos(e)]}const Xe=`#version 300 es
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
`,ze=`#version 300 es
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
`;class Oe{constructor(e){this.meshes=new Map,this.camera=new Ne,this.lights=JSON.parse(JSON.stringify(Be)),this.modelRotation=0,this.gpu=e,this.prog=e.compile(Xe,ze)}uploadMesh(e,t){if(this.meshes.has(e))return;const n=this.gpu.gl,r=n.createVertexArray();n.bindVertexArray(r);const o=(l,s,c)=>{const d=n.createBuffer();n.bindBuffer(n.ARRAY_BUFFER,d),n.bufferData(n.ARRAY_BUFFER,s,n.STATIC_DRAW),n.enableVertexAttribArray(l),n.vertexAttribPointer(l,c,n.FLOAT,!1,0,0)};o(0,t.positions,3),o(1,t.normals,3),o(2,t.uvs,2);const a=n.createBuffer();n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,a),n.bufferData(n.ELEMENT_ARRAY_BUFFER,t.indices,n.STATIC_DRAW),n.bindVertexArray(null),this.meshes.set(e,{vao:r,count:t.indices.length})}draw(e,t,n,r,o=[0,0,0],a=0,l){const s=this.gpu.gl,c=Math.min(window.devicePixelRatio||1,2),d=Math.floor(e.clientWidth*c),f=Math.floor(e.clientHeight*c);if(d===0||f===0)return;const m=this.gpu.canvas;(m.width!==d||m.height!==f)&&(m.width=d,m.height=f),s.bindFramebuffer(s.FRAMEBUFFER,null);const u=l??[0,0,d,f];s.enable(s.DEPTH_TEST),s.enable(s.SCISSOR_TEST),s.scissor(u[0],u[1],u[2],u[3]),s.viewport(u[0],u[1],u[2],u[3]),s.clearColor(.13,.12,.11,1),s.clear(s.COLOR_BUFFER_BIT|s.DEPTH_BUFFER_BIT),s.disable(s.SCISSOR_TEST);const p=this.meshes.get(t);if(!p)return;s.useProgram(this.prog);const g=b=>s.getUniformLocation(this.prog,b);s.uniformMatrix4fv(g("uProj"),!1,this.camera.proj(u[2]/u[3])),s.uniformMatrix4fv(g("uView"),!1,this.camera.view());const w=ce(le(...o),ue(this.modelRotation+a));s.uniformMatrix4fv(g("uModel"),!1,w),s.uniform3fv(g("uEye"),this.camera.eye());for(let b=0;b<2;b++){const S=this.lights[b],M=$e(S);s.uniform3fv(g(`uLightDir[${b}]`),M);const E=S.enabled?S.intensity:0;s.uniform3fv(g(`uLightColor[${b}]`),[S.color[0]*E,S.color[1]*E,S.color[2]*E]),s.uniform1f(g(`uSpot[${b}]`),S.kind==="spot"?1:0),s.uniform3fv(g(`uSpotPos[${b}]`),[-M[0]*1.2,-M[1]*1.2+.2,-M[2]*1.2])}s.uniform1f(g("uNormalStrength"),1),s.uniform3fv(g("uAging"),r),s.uniform1f(g("uUseMask"),n.mask?1:0);const T=(b,S,M)=>{s.activeTexture(s.TEXTURE0+b),s.bindTexture(s.TEXTURE_2D,S??this.gpu.whiteTex),s.uniform1i(g(M),b)};T(0,n.albedo,"uAlbedo"),T(1,n.normal,"uNormalMap"),T(2,n.roughness,"uRoughMap"),T(3,n.mask,"uMask"),s.bindVertexArray(p.vao),s.drawElements(s.TRIANGLES,p.count,s.UNSIGNED_INT,0),s.bindVertexArray(null),(e.width!==d||e.height!==f)&&(e.width=d,e.height=f);const y=e.getContext("2d");y&&(l?y.drawImage(m,u[0],u[1],u[2],u[3],u[0],u[1],u[2],u[3]):y.drawImage(m,0,0))}}function h(i,e,t){const n=document.createElement(i);return e&&(n.className=e),t!==void 0&&(n.textContent=t),n}function C(i){const e=h("div","ctl"),t=h("div","ctl-head"),n=h("span","",i.label),r=h("span","ctl-val",i.format?i.format(i.value):String(i.value));t.append(n,r);const o=h("input");return o.type="range",o.min=String(i.min),o.max=String(i.max),o.step=String(i.step),o.value=String(i.value),o.addEventListener("input",()=>{const a=parseFloat(o.value);r.textContent=i.format?i.format(a):String(a),i.onInput(a)}),e.append(t,o),e}function Ge(i,e,t){const n=h("div","ctl ctl-row"),r=h("span","",i),o=h("input");return o.type="color",o.value=e,o.addEventListener("input",()=>t(o.value)),n.append(r,o),n}function D(i,e,t,n){const r=h("div","ctl ctl-row"),o=h("span","",i),a=h("select");for(const[l,s]of e){const c=h("option","",s);c.value=l,a.append(c)}return a.value=t,a.addEventListener("change",()=>n(a.value)),r.append(o,a),r}function P(i,e,t="btn"){const n=h("button",t,i);return n.addEventListener("click",e),n}function He(i,e,t){const n=h("div","ctl ctl-row"),r=h("span","",i),o=h("input");return o.type="number",o.value=String(e),o.addEventListener("change",()=>{const a=parseInt(o.value,10);Number.isFinite(a)&&t(a)}),n.append(r,o),n}function Ve(i,e,t){const n=h("div","ctl ctl-row"),r=h("span","",i),o=h("input");return o.type="text",o.value=e,o.addEventListener("change",()=>t(o.value)),n.append(r,o),n}function _(i,e=!0){const t=h("div",`toast ${e?"toast-ok":"toast-err"}`,i);document.body.append(t),setTimeout(()=>t.classList.add("show"),10),setTimeout(()=>{t.classList.remove("show"),setTimeout(()=>t.remove(),300)},2600)}function oe(i,e){const t=h("div","page-pad"),n=h("div","page-head");n.append(h("h2","","皮料库"));const r=h("div","head-actions");r.append(P("＋ 新建皮料",async()=>{const s=await e.addMaterial();_(`已创建 ${s.id}`),a()}),P("导出材质包",()=>{if(!e.materials.length)return _("没有可导出的皮料",!1);Le(e.materials),_(`已导出 ${e.materials.length} 个皮料`)},"btn btn-ghost"),P("导入材质包",()=>{const s=h("input");s.type="file",s.accept=".json",s.addEventListener("change",async()=>{const c=s.files?.[0];if(c)try{const{added:d,skipped:f}=await Fe(c);e.materials=await q(),_(`导入 ${d} 个皮料${f?`, 跳过 ${f}`:""}`),a()}catch(d){_(d instanceof Error?d.message:"导入失败",!1)}}),s.click()},"btn btn-ghost")),n.append(r),t.append(n);const o=h("div","mat-grid");t.append(o),i.append(t);function a(){if(o.innerHTML="",!e.materials.length){o.append(h("div","empty","还没有皮料,点「新建皮料」开始"));return}for(const s of e.materials)o.append(l(s))}function l(s){const c=h("div","mat-card");s.id===e.currentId&&c.classList.add("selected");const d=h("div","mat-thumb"),{maps:f}={maps:e.getMaps(s,256)},m=h("canvas");m.width=256,m.height=256,m.getContext("2d").putImageData(f.albedo,0,0),d.append(m);const u=h("canvas","tile-strip");u.width=256,u.height=64;const p=u.getContext("2d"),g=document.createElement("canvas");g.width=64,g.height=64,g.getContext("2d").drawImage(m,0,0,64,64);for(let b=0;b<4;b++)p.drawImage(g,b*64,0);d.append(u);const w=h("div","mat-info");w.append(h("div","mat-name",s.name)),w.append(h("div","mat-id",s.id));const T={litchi:"荔枝纹",crosshatch:"十字纹",croc:"鳄鱼纹"}[s.emboss.kind];w.append(h("div","mat-sub",`${T} · 深度 ${s.emboss.depth*100|0}%`));const y=h("div","mat-btns");return y.append(P("编辑压纹",()=>{e.setCurrent(s.id),e.navigate("emboss")},"btn btn-sm"),P("做旧",()=>{e.setCurrent(s.id),e.navigate("aging")},"btn btn-sm"),P("预览",()=>{e.setCurrent(s.id),e.navigate("preview")},"btn btn-sm"),P("复制",async()=>{await e.duplicate(s),_("已复制"),a()},"btn btn-sm btn-ghost"),P("删除",async()=>{confirm(`删除皮料 ${s.name} (${s.id})?`)&&(await e.remove(s.id),e.invalidate(s),_("已删除"),a())},"btn btn-sm btn-danger")),w.append(y),c.append(d,w),c.addEventListener("dblclick",()=>{e.setCurrent(s.id),e.navigate("emboss")}),c}a()}function W(i){return i.materials.map(e=>[e.id,`${e.name} (${e.id})`])}function je(i,e){const t=e.current(),n=h("div","page-pad emboss-layout");if(i.append(n),!t){n.append(h("div","empty","请先在皮料库选择或新建一个皮料")),n.append(P("去皮料库",()=>e.navigate("library")));return}const r=h("div","panel");r.append(h("h3","",`${t.name} · ${t.id}`)),r.append(Ve("名称",t.name,E=>{t.name=E,y()})),r.append(He("种子 (同种子结果完全一致)",t.seed,E=>{t.seed=E>>>0,w()})),r.append(P("随机种子",()=>{t.seed=t.seed*1664525+1013904223>>>0,w(),M()},"btn btn-sm btn-ghost")),r.append(D("纹样",[["litchi","荔枝纹"],["crosshatch","十字纹"],["croc","鳄鱼纹"]],t.emboss.kind,E=>{t.emboss.kind=E,w(),M()}));const o=h("div");r.append(o),r.append(Ge("底色",t.baseColor,E=>{t.baseColor=E,w()})),r.append(C({label:"基础粗糙度",min:.05,max:1,step:.01,value:t.roughness,format:E=>E.toFixed(2),onInput:E=>{t.roughness=E,w()}})),r.append(C({label:"法线强度",min:0,max:3,step:.05,value:t.normalStrength,format:E=>E.toFixed(2),onInput:E=>{t.normalStrength=E,w()}}));const a=h("div","btn-row");a.append(P("下载法线 PNG",()=>S("normal"),"btn btn-sm"),P("下载粗糙度 PNG",()=>S("roughness"),"btn btn-sm"),P("下载颜色 PNG",()=>S("albedo"),"btn btn-sm"),P("下载高度 PNG",()=>S("height"),"btn btn-sm")),r.append(a),r.append(h("div","hint","贴图为 2048×2048,四边像素严格对齐,可直接平铺使用"));const l=h("div","emboss-right"),s=h("div","preview-title");l.append(s);const c=h("div","flat-previews"),d=h("canvas","flat-canvas"),f=h("canvas","flat-canvas");c.append(g("颜色 (单张)",d),g("3×3 平铺 (检查接缝)",f));const m=h("canvas","flat-canvas"),u=h("canvas","flat-canvas");c.append(g("法线",m),g("粗糙度",u)),l.append(c);const p=h("div","stats");l.append(p),n.append(r,l);function g(E,R){const x=h("div","flat-item");return x.append(h("div","flat-label",E),R),x}function w(){y(),e.invalidate(t),b()}let T=null;function y(){T&&clearTimeout(T),T=setTimeout(()=>e.save(t),300)}function b(){const E=performance.now(),R=e.getMaps(t,1024),x=performance.now()-E,L=(v,A)=>{v.width=A.width,v.height=A.height,v.getContext("2d").putImageData(A,0,0)};L(d,R.albedo),L(m,R.normal),L(u,R.roughness),f.width=768,f.height=768;const F=f.getContext("2d"),U=document.createElement("canvas");U.width=256,U.height=256,U.getContext("2d").putImageData(R.albedo,0,0);for(let v=0;v<3;v++)for(let A=0;A<3;A++)F.drawImage(U,A*256,v*256);s.textContent=`${t.name} · ${t.id}`,p.textContent=`本次生成(1024): ${x.toFixed(0)} ms`}function S(E){_("正在生成 2048 贴图…"),setTimeout(()=>{const R=e.getMaps(t,2048);Re(R[E],`${t.id}_${E}_2048.png`)},30)}function M(){o.innerHTML="";const E=t.emboss;o.append(C({label:"纹理尺度 (晶格数, 整数保证无缝)",min:4,max:64,step:1,value:E.cells,format:R=>`${R|0}`,onInput:R=>{E.cells=Math.round(R),w()}})),o.append(C({label:"压纹深度",min:0,max:1,step:.01,value:E.depth,format:R=>`${R*100|0}%`,onInput:R=>{E.depth=R,w()}})),o.append(C({label:"细纹强度",min:0,max:1,step:.01,value:E.grain,format:R=>`${R*100|0}%`,onInput:R=>{E.grain=R,w()}})),E.kind==="crosshatch"&&o.append(C({label:"斜纹角度",min:0,max:90,step:1,value:E.angle,format:R=>`${R|0}°`,onInput:R=>{E.angle=R,w()}})),E.kind!=="crosshatch"&&o.append(C({label:E.kind==="croc"?"裂纹宽度":"沟壑宽度",min:0,max:1,step:.01,value:E.crack,format:R=>`${R*100|0}%`,onInput:R=>{E.crack=R,w()}}))}M(),b()}const Ye=`#version 300 es
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
`;class We{constructor(e){this.targets=null,this.front=0,this.size=0,this.undoStack=[],this.strokeActive=!1,this.gpu=e,this.prog=e.compile(V,Ye)}init(e){return this.size=e,this.targets&&(this.gpu.deleteTarget(this.targets[0]),this.gpu.deleteTarget(this.targets[1])),this.targets=[this.gpu.createTarget(e,e),this.gpu.createTarget(e,e)],this.clear(),this.undoStack=[],this.targets[this.front].tex}get texture(){return this.targets?this.targets[this.front].tex:null}clear(){if(!this.targets)return;const e=this.gpu.gl;for(const t of this.targets)e.bindFramebuffer(e.FRAMEBUFFER,t.fbo),e.clearColor(0,0,0,1),e.clear(e.COLOR_BUFFER_BIT);e.bindFramebuffer(e.FRAMEBUFFER,null)}beginStroke(){if(!this.targets||this.strokeActive)return;this.strokeActive=!0;const e=this.gpu.readImageData(this.targets[this.front].fbo,this.size,this.size);this.undoStack.push(e),this.undoStack.length>12&&this.undoStack.shift()}endStroke(){this.strokeActive=!1}stamp(e,t,n,r,o){if(!this.targets)return;this.gpu.gl;const a=this.targets[this.front],l=this.targets[1-this.front],s=o==="wear"?[1,0,0]:o==="wax"?[0,1,0]:[0,0,1];this.gpu.runProgram(this.prog,l,this.size,this.size,(c,d)=>{c.activeTexture(c.TEXTURE0),c.bindTexture(c.TEXTURE_2D,a.tex),c.uniform1i(c.getUniformLocation(d,"uPrev"),0),c.uniform2f(c.getUniformLocation(d,"uUv"),e,t),c.uniform1f(c.getUniformLocation(d,"uRadius"),n),c.uniform1f(c.getUniformLocation(d,"uStrength"),r),c.uniform3f(c.getUniformLocation(d,"uChannel"),s[0],s[1],s[2]),c.uniform1f(c.getUniformLocation(d,"uAspect"),1)}),this.front=1-this.front}undo(){const e=this.undoStack.pop();if(!e||!this.targets)return!1;const t=this.gpu.gl;return t.bindTexture(t.TEXTURE_2D,this.targets[this.front].tex),t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,1),t.texImage2D(t.TEXTURE_2D,0,t.RGBA8,this.size,this.size,0,t.RGBA,t.UNSIGNED_BYTE,new Uint8Array(e.data.buffer)),t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,0),!0}exportPng(){if(!this.targets)return null;const e=this.gpu.readImageData(this.targets[this.front].fbo,this.size,this.size),t=document.createElement("canvas");return t.width=this.size,t.height=this.size,t.getContext("2d").putImageData(e,0,0),t.toDataURL("image/png")}async loadPng(e){if(!this.targets)return;const t=await new Promise((l,s)=>{const c=new Image;c.onload=()=>l(c),c.onerror=s,c.src=e}),n=document.createElement("canvas");n.width=this.size,n.height=this.size;const r=n.getContext("2d");r.drawImage(t,0,0,this.size,this.size);const o=r.getImageData(0,0,this.size,this.size),a=this.gpu.gl;a.bindTexture(a.TEXTURE_2D,this.targets[this.front].tex),a.pixelStorei(a.UNPACK_FLIP_Y_WEBGL,1),a.texImage2D(a.TEXTURE_2D,0,a.RGBA8,this.size,this.size,0,a.RGBA,a.UNSIGNED_BYTE,o),a.pixelStorei(a.UNPACK_FLIP_Y_WEBGL,0)}}function qe(i,e,t,n){const r=t.positions,o=t.indices,a=t.uvs;let l=null;const s=(c,d,f)=>[n[0]*c+n[4]*d+n[8]*f+n[12],n[1]*c+n[5]*d+n[9]*f+n[13],n[2]*c+n[6]*d+n[10]*f+n[14]];for(let c=0;c<o.length;c+=3){const d=o[c],f=o[c+1],m=o[c+2],u=s(r[d*3],r[d*3+1],r[d*3+2]),p=s(r[f*3],r[f*3+1],r[f*3+2]),g=s(r[m*3],r[m*3+1],r[m*3+2]),w=Ke(i,e,u,p,g);if(w!==null&&(l===null||w<l.dist)){const T=Je(i,e,u,p,g),y=T[0]*a[d*2]+T[1]*a[f*2]+T[2]*a[m*2],b=T[0]*a[d*2+1]+T[1]*a[f*2+1]+T[2]*a[m*2+1];l={u:y-Math.floor(y),v:b,dist:w}}}return l}function Ke(i,e,t,n,r){const o=B(n,t),a=B(r,t),l=G(e,a),s=I(o,l);if(Math.abs(s)<1e-10)return null;const c=1/s,d=B(i,t),f=I(d,l)*c;if(f<0||f>1)return null;const m=G(d,o),u=I(e,m)*c;if(u<0||f+u>1)return null;const p=I(a,m)*c;return p>0?p:null}function Je(i,e,t,n,r){const o=B(n,t),a=B(r,t),l=G(e,a),s=I(o,l);if(Math.abs(s)<1e-10)return null;const c=1/s,d=B(i,t),f=I(d,l)*c,m=G(d,o),u=I(e,m)*c;return[1-f-u,f,u]}function Qe(i,e,t,n,r){const o=n[5],a=[i*r/o,e/o,-1],l=[t[0]*a[0]+t[4]*a[1]+t[8]*a[2],t[1]*a[0]+t[5]*a[1]+t[9]*a[2],t[2]*a[0]+t[6]*a[1]+t[10]*a[2]],s=Math.hypot(l[0],l[1],l[2]);return{origin:[t[12],t[13],t[14]],dir:[l[0]/s,l[1]/s,l[2]/s]}}const z={tote:"托特包",boston:"波士顿包",clutch:"手拿包"},k=.35;function Ze(i,e){const t=Math.cos(i),n=Math.sin(i);return[Math.sign(t)*Math.pow(Math.abs(t),e),Math.sign(n)*Math.pow(Math.abs(n),e)]}function Q(i,e,t,n){const o=n*16,a=[],l=[0];for(let f=0;f<o;f++)a.push(Ze(f/o*Math.PI*2,t).map((m,u)=>m*(u===0?i:e)));for(let f=1;f<=o;f++){const[m,u]=a[f-1],[p,g]=f<o?a[f]:a[0];l.push(l[f-1]+Math.hypot(p-m,g-u))}const s=l[o],c=[];let d=0;for(let f=0;f<=n;f++){const m=f/n*s;for(;d<o-1&&l[d+1]<m;)d++;const[u,p]=a[d],[g,w]=d+1<o?a[d+1]:a[0],T=l[d+1]-l[d]||1,y=(m-l[d])/T;c.push([u+(g-u)*y,p+(w-p)*y])}return c}function et(i){const e=i.normals;e.fill(0);const t=i.positions,n=i.indices;for(let r=0;r<n.length;r+=3){const o=n[r]*3,a=n[r+1]*3,l=n[r+2]*3,s=t[a]-t[o],c=t[a+1]-t[o+1],d=t[a+2]-t[o+2],f=t[l]-t[o],m=t[l+1]-t[o+1],u=t[l+2]-t[o+2],p=c*u-d*m,g=d*f-s*u,w=s*m-c*f;for(const T of[o,a,l])e[T]+=p,e[T+1]+=g,e[T+2]+=w}for(let r=0;r<e.length;r+=3){const o=Math.hypot(e[r],e[r+1],e[r+2])||1;e[r]/=o,e[r+1]/=o,e[r+2]/=o}}class te{constructor(){this.pos=[],this.uv=[],this.idx=[]}vert(e,t,n,r,o){return this.pos.push(e,t,n),this.uv.push(r,o),this.pos.length/3-1}tri(e,t,n){this.idx.push(e,t,n)}build(){const e={positions:new Float32Array(this.pos),normals:new Float32Array(this.pos.length),uvs:new Float32Array(this.uv),indices:new Uint32Array(this.idx)};return et(e),e}}function de(i){return i==="boston"?nt():tt(i)}function tt(i){const n=i==="clutch"?.05:.42,r=new te,o=u=>{if(i==="tote"){let T=.3+.09*u,y=.115*(1-.2*u);const b=Math.min(1,Math.min(u,1-u)*12+.15);return T*=.82+.18*b,y*=.82+.18*b,{rx:T,rz:y,e:.55,y:u*n}}let p=.3,g=.19;const w=Math.min(1,Math.min(u,1-u)*8+.1);return p*=.7+.3*w,g*=.7+.3*w,{rx:p,rz:g,e:.5,y:u*n}},a=o(.5),l=Q(a.rx,a.rz,a.e,256);let s=0;for(let u=1;u<l.length;u++)s+=Math.hypot(l[u][0]-l[u-1][0],l[u][1]-l[u-1][1]);const c=Math.max(1,Math.round(s/k)),d=n/k,f=[];for(let u=0;u<=48;u++){const p=u/48,{rx:g,rz:w,e:T,y}=o(p),b=Q(g,w,T,72);f.push(r.pos.length/3);for(let S=0;S<=72;S++){const[M,E]=b[S];r.vert(M,y,E,S/72*c,p*d)}}for(let u=0;u<48;u++)for(let p=0;p<72;p++){const g=f[u]+p,w=f[u+1]+p;r.tri(g,w,g+1),r.tri(g+1,w,w+1)}const m=(u,p,g)=>{const w=[],T=f[u];for(let b=0;b<=72;b++){const S=T+b,M=r.pos[S*3],E=r.pos[S*3+2];w.push(r.vert(M,p,E,M/k,E/k))}const y=r.vert(0,p,0,0,0);for(let b=0;b<72;b++)g?r.tri(y,w[b+1],w[b]):r.tri(y,w[b],w[b+1])};return m(0,0,!1),m(48,n,!0),r.build()}function nt(){const t=new te,n=s=>{const c=Math.sin(Math.PI*s);return .17*(.3+.7*Math.pow(Math.max(0,c),.55))},r=Math.max(1,Math.round(Math.PI*2*.17/k)),o=.56/k,a=[];for(let s=0;s<=64;s++){const c=s/64,d=n(c),f=(c-.5)*.56,m=Q(d,d*.95,.9,64);a.push(t.pos.length/3);for(let u=0;u<=64;u++){const[p,g]=m[u];t.vert(f,p,g,u/64*r,c*o)}}for(let s=0;s<64;s++)for(let c=0;c<64;c++){const d=a[s]+c,f=a[s+1]+c;t.tri(d,d+1,f),t.tri(d+1,f+1,f)}const l=(s,c,d)=>{const f=a[s],m=[];for(let p=0;p<=64;p++){const g=f+p,w=t.pos[g*3+1],T=t.pos[g*3+2];m.push(t.vert(c,w,T,w/k,T/k))}const u=t.vert(c,0,0,0,0);for(let p=0;p<64;p++)d?t.tri(u,m[p],m[p+1]):t.tri(u,m[p+1],m[p])};return l(0,-.28,!1),l(64,.28,!0),t.build()}function at(){const e=new te;for(let n=0;n<=24;n++)for(let r=0;r<=24;r++){const o=r/24,a=n/24;e.vert((o-.5)*.5,(a-.5)*.36,0,o*(.5/k),a*(.36/k))}const t=25;for(let n=0;n<24;n++)for(let r=0;r<24;r++){const o=n*t+r,a=o+t;e.tri(o,a,o+1),e.tri(o+1,a,a+1)}return e.build()}const rt=1024;function ot(i,e){const t=h("div","page-pad aging-layout");if(i.append(t),!e.materials.length){t.append(h("div","empty","请先在皮料库新建皮料"));return}let n=e.current()??e.materials[0],r="tote",o="wear",a=.05,l=.5;const s=new We(e.gpu);s.init(rt),e.renderer.camera.yaw=.6,e.renderer.camera.pitch=.35,e.renderer.camera.dist=1.1,e.renderer.camera.target=[0,.18,0];const c=h("div","panel");c.append(h("h3","","做旧处理")),c.append(D("皮料",W(e),n.id,v=>{n=e.materials.find(A=>A.id===v),e.setCurrent(n.id),T(),w()}));const d=h("div","hint");c.append(d),c.append(D("包型",[["tote",z.tote],["boston",z.boston],["clutch",z.clutch]],r,v=>{r=v,e.renderer.camera.target=v==="boston"?[0,0,0]:[0,.18,0],g()})),c.append(D("刷子",[["wear","磨损 (变浅变毛)"],["wax","油蜡 (变深变亮)"],["crease","折痕 (压暗)"]],o,v=>{o=v})),c.append(C({label:"笔刷大小",min:.01,max:.2,step:.005,value:a,format:v=>v.toFixed(3),onInput:v=>{a=v}})),c.append(C({label:"笔刷强度",min:.05,max:1,step:.05,value:l,format:v=>`${v*100|0}%`,onInput:v=>{l=v}})),c.append(h("div","hint","左键拖动 = 刷 · 右键/Shift拖动 = 旋转 · 滚轮 = 缩放"));const f=h("div","btn-row");f.append(P("撤销",()=>{s.undo()||_("没有可撤销的步骤",!1)},"btn btn-sm"),P("清空",()=>{s.clear()},"btn btn-sm btn-ghost"),P("保存到皮料",()=>{n.aging.maskPng=s.exportPng(),e.save(n),e.maskTextures.delete(n.id),_("做旧遮罩已保存")},"btn btn-sm")),c.append(f),c.append(C({label:"磨损整体强度",min:0,max:2,step:.05,value:n.aging.wear,format:v=>v.toFixed(2),onInput:v=>{n.aging.wear=v,e.save(n)}})),c.append(C({label:"油蜡整体强度",min:0,max:2,step:.05,value:n.aging.wax,format:v=>v.toFixed(2),onInput:v=>{n.aging.wax=v,e.save(n)}})),c.append(C({label:"折痕整体强度",min:0,max:2,step:.05,value:n.aging.crease,format:v=>v.toFixed(2),onInput:v=>{n.aging.crease=v,e.save(n)}}));const m=h("div","view-wrap"),u=h("canvas","view3d");m.append(u),t.append(c,m);const p=new Map;function g(){p.has(r)||p.set(r,de(r)),e.renderer.uploadMesh(`aging-${r}`,p.get(r))}g();function w(){d.textContent=`${n.name} · ${n.id}`}w();async function T(){s.clear(),n.aging.maskPng&&await s.loadPng(n.aging.maskPng),s.texture&&e.maskTextures.set(n.id,s.texture)}s.texture&&e.maskTextures.set(n.id,s.texture),T();let y=!1,b=!1,S=0,M=0;u.addEventListener("contextmenu",v=>v.preventDefault()),u.addEventListener("pointerdown",v=>{u.setPointerCapture(v.pointerId),S=v.clientX,M=v.clientY,v.button===2||v.shiftKey?b=!0:(y=!0,s.beginStroke(),R(v))}),u.addEventListener("pointermove",v=>{b?e.renderer.camera.rotate(v.clientX-S,v.clientY-M):y&&R(v),S=v.clientX,M=v.clientY});const E=()=>{y&&s.endStroke(),y=!1,b=!1};u.addEventListener("pointerup",E),u.addEventListener("pointercancel",E),u.addEventListener("wheel",v=>{v.preventDefault(),e.renderer.camera.zoom(v.deltaY)},{passive:!1});function R(v){const A=u.getBoundingClientRect(),$=(v.clientX-A.left)/A.width*2-1,N=-((v.clientY-A.top)/A.height*2-1),H=e.renderer.camera,X=H.view(),fe=De(X),he=H.proj(A.width/A.height),ne=Qe($,N,fe,he,A.width/A.height),pe=ce(le(0,0,0),ue(e.renderer.modelRotation)),K=qe(ne.origin,ne.dir,p.get(r),pe);K&&s.stamp(K.u,K.v,a,l*.25,o)}let x=0,L=!0;const F=new MutationObserver(()=>{document.contains(u)||(L=!1,cancelAnimationFrame(x),F.disconnect())});F.observe(document.body,{childList:!0,subtree:!0});function U(){if(!L)return;const v=e.getTextures(n,e.previewSize);v.mask=s.texture,e.renderer.draw(u,`aging-${r}`,v,[n.aging.wear,n.aging.wax,n.aging.crease]),x=requestAnimationFrame(U)}U()}function it(i,e){const t=h("div","page-pad preview-layout");if(i.append(t),!e.materials.length){t.append(h("div","empty","请先在皮料库新建皮料"));return}let n=e.current()??e.materials[0],r="tote",o=!1;e.renderer.camera.yaw=.6,e.renderer.camera.pitch=.35,e.renderer.camera.dist=1.1,e.renderer.camera.target=[0,.18,0];const a=h("div","panel");a.append(h("h3","","成品预览")),a.append(D("皮料",W(e),n.id,x=>{n=e.materials.find(L=>L.id===x),e.setCurrent(n.id),p()})),a.append(D("包型",[["tote",z.tote],["boston",z.boston],["clutch",z.clutch]],r,x=>{r=x,e.renderer.camera.target=x==="boston"?[0,0,0]:[0,.18,0],u()}));const l=h("div","hint");a.append(l),a.append(h("h4","","光源 (拖动圆盘调整方向)")),e.renderer.lights.forEach((x,L)=>{const F=h("div","light-box"),U=h("div","light-title",`${x.kind==="spot"?"柜台射灯":"日光"}`),v=h("input");v.type="checkbox",v.checked=x.enabled,v.addEventListener("change",()=>{x.enabled=v.checked}),U.append(v);const A=st(x),$=C({label:"强度",min:0,max:3,step:.05,value:x.intensity,format:N=>N.toFixed(2),onInput:N=>{x.intensity=N}});F.append(U,A,$),a.append(F)});const s=h("div","btn-row"),c=P("自动旋转: 关",()=>{o=!o,c.textContent=`自动旋转: ${o?"开":"关"}`},"btn btn-sm btn-ghost");s.append(c),a.append(s),a.append(P("📷 截图 (带皮料编号)",()=>y(),"btn"));const d=h("div","view-wrap"),f=h("canvas","view3d");d.append(f),t.append(a,d);const m=new Map;function u(){m.has(r)||m.set(r,de(r)),e.renderer.uploadMesh(`preview-${r}`,m.get(r))}u();function p(){l.textContent=`${n.name} · ${n.id}`}p();let g=!1,w=0,T=0;f.addEventListener("pointerdown",x=>{g=!0,w=x.clientX,T=x.clientY,f.setPointerCapture(x.pointerId)}),f.addEventListener("pointermove",x=>{g&&(e.renderer.camera.rotate(x.clientX-w,x.clientY-T),w=x.clientX,T=x.clientY)}),f.addEventListener("pointerup",()=>{g=!1}),f.addEventListener("wheel",x=>{x.preventDefault(),e.renderer.camera.zoom(x.deltaY)},{passive:!1});function y(){b();const x=f,L=document.createElement("canvas"),F=Math.round(x.height*.09);L.width=x.width,L.height=x.height+F;const U=L.getContext("2d");U.drawImage(x,0,0),U.fillStyle="#1a1713",U.fillRect(0,x.height,L.width,F),U.fillStyle="#e8dcc8";const v=Math.round(F*.34);U.font=`${v}px system-ui, sans-serif`,U.textBaseline="middle";const A=Math.round(F*.3);U.fillText(`皮料编号: ${n.id}   ${n.name}`,A,x.height+F/2);const $=new Date().toISOString().slice(0,10),N=U.measureText($).width;U.fillText($,L.width-N-A,x.height+F/2),L.toBlob(H=>{if(!H)return;const X=document.createElement("a");X.href=URL.createObjectURL(H),X.download=`${n.id}_preview.png`,X.click(),setTimeout(()=>URL.revokeObjectURL(X.href),5e3),_("截图已下载")},"image/png")}function b(){const x=e.getTextures(n,e.previewSize);e.renderer.draw(f,`preview-${r}`,x,[n.aging.wear,n.aging.wax,n.aging.crease])}let S=0,M=!0;const E=new MutationObserver(()=>{document.contains(f)||(M=!1,cancelAnimationFrame(S),E.disconnect())});E.observe(document.body,{childList:!0,subtree:!0});function R(){M&&(o&&(e.renderer.modelRotation+=.008),b(),S=requestAnimationFrame(R))}R()}function st(i){const t=h("div","dial-wrap"),n=h("canvas","dial");n.width=110,n.height=110,t.append(n);function r(){const l=n.getContext("2d");l.clearRect(0,0,110,110);const s=110/2-6,c=110/2,d=110/2;l.strokeStyle="#7a6f5f",l.lineWidth=1.5,l.beginPath(),l.arc(c,d,s,0,Math.PI*2),l.stroke(),l.beginPath(),l.arc(c,d,s*.5,0,Math.PI*2),l.stroke(),l.beginPath(),l.moveTo(c-s,d),l.lineTo(c+s,d),l.stroke(),l.beginPath(),l.moveTo(c,d-s),l.lineTo(c,d+s),l.stroke();const f=i.azimuth*Math.PI/180,m=s*(1-i.elevation/95),u=c+Math.sin(f)*m,p=d-Math.cos(f)*m*.999;l.fillStyle=i.kind==="spot"?"#ffb84d":"#7db8ff",l.beginPath(),l.arc(u,p,7,0,Math.PI*2),l.fill(),l.strokeStyle="#2a251f",l.stroke()}let o=!1;const a=l=>{const s=n.getBoundingClientRect(),c=l.clientX-s.left-110/2,d=l.clientY-s.top-110/2,f=110/2-6;i.azimuth=(Math.atan2(c,-d)*180/Math.PI+360)%360;const m=Math.min(1,Math.hypot(c,d)/f);i.elevation=Math.max(2,Math.min(90,(1-m)*95)),r()};return n.addEventListener("pointerdown",l=>{o=!0,n.setPointerCapture(l.pointerId),a(l)}),n.addEventListener("pointermove",l=>{o&&a(l)}),n.addEventListener("pointerup",()=>{o=!1}),r(),t}function ct(i,e){const t=h("div","page-pad colorcard-layout");if(i.append(t),e.materials.length<1){t.append(h("div","empty","请先在皮料库新建至少一个皮料"));return}let n=e.materials[0].id,r=e.materials.length>1?e.materials[1].id:e.materials[0].id;const o=h("div","colorcard-bar"),a=D("左侧皮料",W(e),n,b=>{n=b}),l=D("右侧皮料",W(e),r,b=>{r=b});o.append(a,l,h("span","hint","拖动旋转 · 滚轮缩放 · 两侧同光源同角度")),t.append(o);const s=h("div","view-wrap colorcard-view"),c=h("canvas","view3d");s.append(c);const d=h("div","cc-label cc-left"),f=h("div","cc-label cc-right");s.append(d,f),t.append(s),e.renderer.uploadMesh("swatch",at()),e.renderer.camera.yaw=.35,e.renderer.camera.pitch=.25,e.renderer.camera.dist=.8,e.renderer.camera.target=[0,0,0];let m=!1,u=0,p=0;c.addEventListener("pointerdown",b=>{m=!0,u=b.clientX,p=b.clientY,c.setPointerCapture(b.pointerId)}),c.addEventListener("pointermove",b=>{m&&(e.renderer.camera.rotate(b.clientX-u,b.clientY-p),u=b.clientX,p=b.clientY)}),c.addEventListener("pointerup",()=>{m=!1}),c.addEventListener("wheel",b=>{b.preventDefault(),e.renderer.camera.zoom(b.deltaY)},{passive:!1});let g=0,w=!0;const T=new MutationObserver(()=>{document.contains(c)||(w=!1,cancelAnimationFrame(g),T.disconnect())});T.observe(document.body,{childList:!0,subtree:!0});function y(){if(!w)return;const b=Math.min(window.devicePixelRatio||1,2),S=c.clientWidth*b,M=c.clientHeight*b,E=e.materials.find(F=>F.id===n),R=e.materials.find(F=>F.id===r);d.textContent=`${E.name} · ${E.id}`,f.textContent=`${R.name} · ${R.id}`;const x=e.getTextures(E,e.previewSize),L=e.getTextures(R,e.previewSize);e.renderer.draw(c,"swatch",x,[E.aging.wear,E.aging.wax,E.aging.crease],[0,0,0],0,[0,0,S/2,M]),e.renderer.draw(c,"swatch",L,[R.aging.wear,R.aging.wax,R.aging.crease],[0,0,0],0,[S/2,0,S/2,M]),g=requestAnimationFrame(y)}y()}function lt(i,e){const t=h("div","page-pad settings-layout");i.append(t),t.append(h("h2","","设置"));const n=h("div","panel");n.append(h("h3","","预览")),n.append(D("预览贴图分辨率",[["512","512 × 512 (快)"],["1024","1024 × 1024 (推荐)"],["2048","2048 × 2048 (精细)"]],String(e.previewSize),c=>{e.previewSize=parseInt(c,10),_("已切换, 新贴图将按此分辨率生成")})),t.append(n);const r=h("div","panel");r.append(h("h3","","质量自检")),r.append(h("div","hint","验证三项硬指标: ① 四边接缝像素差 = 0 ② 同一种子两次生成完全一致 ③ 2048 贴图生成 < 3 秒"));const o=h("pre","test-out"),a=P("运行自检",()=>{a.disabled=!0,o.textContent="运行中…",setTimeout(()=>{try{const c=se(42),d=ye(e.texGen,c);o.textContent=`${d.details.join(`
`)}

`+(d.pass?"✅ 全部通过":"❌ 存在未通过项"),o.className=`test-out ${d.pass?"pass":"fail"}`}catch(c){o.textContent=`自检出错: ${c instanceof Error?c.message:String(c)}`,o.className="test-out fail"}a.disabled=!1},30)});r.append(a,o),t.append(r);const l=h("div","panel");l.append(h("h3","","数据"));const s=h("div","hint","统计中…");l.append(s),navigator.storage?.estimate&&navigator.storage.estimate().then(c=>{s.textContent=`本地存储占用: ${((c.usage??0)/1024/1024).toFixed(1)} MB`+(c.quota?` / 配额 ${(c.quota/1024/1024).toFixed(0)} MB`:"")}),l.append(P("清空全部数据",async()=>{confirm("确定删除所有皮料和设置? 此操作不可恢复!")&&(await Ue(),e.materials=await q(),e.currentId=null,e.mapCache.clear(),_("已清空"),e.navigate("library"))},"btn btn-danger")),t.append(l)}async function ut(){const i=document.createElement("canvas"),e=new me(i),t=new Te(e),n=new Oe(e),r={gpu:e,texGen:t,renderer:n,materials:await q(),currentId:null,previewSize:1024,mapCache:new Map,maskTextures:new Map,getMaps(a,l){const s=`${a.id}:${a.updatedAt}:${l}`;let c=this.mapCache.get(s);if(!c){const{maps:d}=t.generate(a,l),f=dt(e,d);c={maps:d,textures:f},this.mapCache.set(s,c);for(const m of[...this.mapCache.keys()])if(m.startsWith(`${a.id}:`)&&m!==s){const u=this.mapCache.get(m);e.gl.deleteTexture(u.textures.albedo),e.gl.deleteTexture(u.textures.normal),e.gl.deleteTexture(u.textures.roughness),this.mapCache.delete(m)}}return c.maps},getTextures(a,l){return this.getMaps(a,l),{...this.mapCache.get(`${a.id}:${a.updatedAt}:${l}`).textures,mask:this.maskTextures.get(a.id)??null}},invalidate(a){for(const l of[...this.mapCache.keys()])l.startsWith(`${a.id}:`)&&this.mapCache.delete(l);this.maskTextures.delete(a.id)},async save(a){await Y(a)},async remove(a){await Pe(a),this.materials=this.materials.filter(l=>l.id!==a),this.currentId===a&&(this.currentId=null)},async addMaterial(){const a=se(this.materials.length+1+Math.floor(Math.random()*1e3));return await Y(a),this.materials.push(a),this.currentId=a.id,a},async duplicate(a){const l=JSON.parse(JSON.stringify(a));return l.id=`${a.id}-C${(this.materials.length%36).toString(36).toUpperCase()}`,l.name=`${a.name} 副本`,l.createdAt=Date.now(),l.updatedAt=Date.now(),await Y(l),this.materials.push(l),l},setCurrent(a){this.currentId=a},current(){return this.materials.find(a=>a.id===this.currentId)??null},navigate(a){location.hash=`#${a}`}};function o(){const a=(location.hash||"#library").slice(1);document.querySelectorAll(".nav-btn").forEach(c=>{c.classList.toggle("active",c.dataset.page===a)});const l=document.getElementById("page");l.innerHTML="",({library:oe,emboss:je,aging:ot,preview:it,colorcard:ct,settings:lt}[a]??oe)(l,r)}document.querySelectorAll(".nav-btn").forEach(a=>{a.addEventListener("click",()=>{location.hash=`#${a.dataset.page}`})}),window.addEventListener("hashchange",o),o(),window.__app={ctx:r,texGen:t}}function dt(i,e){const t=i.gl,n=r=>{const o=t.createTexture();return t.bindTexture(t.TEXTURE_2D,o),t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,1),t.texImage2D(t.TEXTURE_2D,0,t.RGBA8,r.width,r.height,0,t.RGBA,t.UNSIGNED_BYTE,r),t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,0),t.generateMipmap(t.TEXTURE_2D),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR_MIPMAP_LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.REPEAT),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.REPEAT),o};return{albedo:n(e.albedo),normal:n(e.normal),roughness:n(e.roughness),mask:null}}ut().catch(i=>{document.getElementById("page").innerHTML=`<div class="fatal">初始化失败: ${i instanceof Error?i.message:String(i)}</div>`});
