// ---------- 程序化压纹 GLSL ----------
// 无缝平铺的核心约定:
//   1. 所有噪声在 "tile 域" 采样: u = fragCoord / (size-1) * cells, cells 为整数周期
//      => 最后一列/行像素与第一列/行 *逐位相等* (u=P 与 u=0 的晶格坐标 mod P 相同)
//   2. 法线差分按 mod (size-1) 环绕取值 => 边缘像素的邻域完全一致
// 确定性的核心约定:
//   3. 全部随机来自整数 hash(seed, cellX, cellY), 无时间/无 Math.random

export const NOISE_LIB = /* glsl */ `
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
`;

export interface HeightUniforms {
  kind: number;      // 0 荔枝 1 十字 2 鳄鱼
  cells: number;
  seed: number;
  depth: number;
  grain: number;
  angle: number;     // 度
  crack: number;
}

/** 把任意角度吸附到有理方向 (a,b), 保证十字纹严格周期 */
export function snapDirection(angleDeg: number): { a: number; b: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const N = 8;
  let a = Math.round(Math.cos(rad) * N);
  let b = Math.round(Math.sin(rad) * N);
  if (a === 0 && b === 0) a = 1;
  const g = gcd(Math.abs(a), Math.abs(b));
  return { a: a / g, b: b / g };
}
function gcd(x: number, y: number): number { return y === 0 ? x : gcd(y, x % y); }

export const HEIGHT_FS = (lib: string) => `#version 300 es
${lib}
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
`;

/** 高度 -> 切线空间法线, 环绕差分 mod (size-1) */
export const NORMAL_FS = `#version 300 es
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
`;

/** 高度 -> 粗糙度: 凹陷处更毛糙, 加颗粒变化 */
export const ROUGHNESS_FS = `#version 300 es
${NOISE_LIB}
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
`;

/** 高度 -> 反照率: 基色 + 颗粒明度变化 + 沟壑 AO */
export const ALBEDO_FS = `#version 300 es
${NOISE_LIB}
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
`;
