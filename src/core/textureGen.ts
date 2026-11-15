// ---------- 贴图生成管线: 高度 -> 法线/粗糙度/反照率, 全部 GPU 计算 ----------
import { Gpu, QUAD_VS } from './gpu';
import { HEIGHT_FS, NORMAL_FS, ROUGHNESS_FS, ALBEDO_FS, NOISE_LIB, snapDirection } from './shaders';
import type { Material, TexMaps } from './types';

export interface GenResult {
  maps: TexMaps;
  /** 各通道 PNG dataURL (未翻转, 直接来自 ImageData) */
  ms: number; // 生成耗时(含读回)
}

export class TextureGen {
  private gpu: Gpu;
  private progHeight: WebGLProgram;
  private progNormal: WebGLProgram;
  private progRough: WebGLProgram;
  private progAlbedo: WebGLProgram;

  constructor(gpu: Gpu) {
    this.gpu = gpu;
    this.progHeight = gpu.compile(QUAD_VS, HEIGHT_FS(NOISE_LIB));
    this.progNormal = gpu.compile(QUAD_VS, NORMAL_FS);
    this.progRough = gpu.compile(QUAD_VS, ROUGHNESS_FS);
    this.progAlbedo = gpu.compile(QUAD_VS, ALBEDO_FS);
  }

  /** 生成一套贴图。size 为边长(正方形)。返回读回后的 ImageData 与耗时。 */
  generate(mat: Material, size: number): GenResult {
    const gl = this.gpu.gl;
    const t0 = performance.now();
    const e = mat.emboss;
    const kindIdx = e.kind === 'litchi' ? 0 : e.kind === 'crosshatch' ? 1 : 2;
    const dir = snapDirection(e.angle);

    const height = this.gpu.createTarget(size, size);
    this.gpu.runProgram(this.progHeight, height, size, size, (gl2, prog) => {
      this.setCommon(gl2, prog, size, e.cells, mat.seed);
      gl2.uniform1i(gl2.getUniformLocation(prog, 'uKind'), kindIdx);
      gl2.uniform1f(gl2.getUniformLocation(prog, 'uDepth'), e.depth);
      gl2.uniform1f(gl2.getUniformLocation(prog, 'uGrain'), e.grain);
      gl2.uniform1f(gl2.getUniformLocation(prog, 'uCrack'), e.crack);
      gl2.uniform2f(gl2.getUniformLocation(prog, 'uDir'), dir.a, dir.b);
    });

    const bindHeight = (prog: WebGLProgram) => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, height.tex);
      gl.uniform1i(gl.getUniformLocation(prog, 'uHeight'), 0);
      gl.uniform2i(gl.getUniformLocation(prog, 'uSize'), size, size);
    };

    const normal = this.gpu.createTarget(size, size);
    this.gpu.runProgram(this.progNormal, normal, size, size, (gl2, prog) => {
      bindHeight(prog);
      gl2.uniform1f(gl2.getUniformLocation(prog, 'uStrength'), mat.normalStrength);
    });

    const rough = this.gpu.createTarget(size, size);
    this.gpu.runProgram(this.progRough, rough, size, size, (gl2, prog) => {
      bindHeight(prog);
      this.setCommon(gl2, prog, size, e.cells, mat.seed);
      gl2.uniform1f(gl2.getUniformLocation(prog, 'uBase'), mat.roughness);
    });

    const albedo = this.gpu.createTarget(size, size);
    this.gpu.runProgram(this.progAlbedo, albedo, size, size, (gl2, prog) => {
      bindHeight(prog);
      this.setCommon(gl2, prog, size, e.cells, mat.seed);
      const c = hexToRgb(mat.baseColor);
      gl2.uniform3f(gl2.getUniformLocation(prog, 'uBaseColor'), c[0], c[1], c[2]);
    });

    const maps: TexMaps = {
      height: this.gpu.readImageData(height.fbo, size, size),
      normal: this.gpu.readImageData(normal.fbo, size, size),
      roughness: this.gpu.readImageData(rough.fbo, size, size),
      albedo: this.gpu.readImageData(albedo.fbo, size, size),
    };
    this.gpu.deleteTarget(height);
    this.gpu.deleteTarget(normal);
    this.gpu.deleteTarget(rough);
    this.gpu.deleteTarget(albedo);

    return { maps, ms: performance.now() - t0 };
  }

  private setCommon(gl: WebGL2RenderingContext, prog: WebGLProgram, size: number, cells: number, seed: number) {
    gl.uniform2i(gl.getUniformLocation(prog, 'uSize'), size, size);
    gl.uniform1i(gl.getUniformLocation(prog, 'uCells'), cells);
    gl.uniform1ui(gl.getUniformLocation(prog, 'uSeed'), seed >>> 0);
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [0.5, 0.35, 0.2];
  const v = parseInt(m[1], 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

export function imageDataToPng(img: ImageData): Promise<string> {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d')!.putImageData(img, 0, 0);
  return new Promise((resolve) => resolve(c.toDataURL('image/png')));
}

export function downloadPng(img: ImageData, filename: string): void {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d')!.putImageData(img, 0, 0);
  c.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

// ---------- 三项硬指标自检 ----------

export interface SelfTestResult {
  seamMaxDiff: number;       // 四边接缝最大像素差 (要求 0)
  deterministic: boolean;    // 同种子两次完全一致
  gen2048Ms: number;         // 2048 生成耗时 (要求 < 3000)
  pass: boolean;
  details: string[];
}

export function runSelfTest(gen: TextureGen, mat: Material): SelfTestResult {
  const details: string[] = [];

  // 1) 2048 计时
  const r1 = gen.generate(mat, 2048);
  const gen2048Ms = r1.ms;
  details.push(`2048 生成耗时: ${gen2048Ms.toFixed(1)} ms`);

  // 2) 接缝: 比较 albedo/normal/roughness/height 的 首末行/列
  let seamMaxDiff = 0;
  for (const [name, img] of Object.entries(r1.maps)) {
    const d = seamDiff(img);
    seamMaxDiff = Math.max(seamMaxDiff, d);
    details.push(`${name} 四边最大像素差: ${d}`);
  }

  // 3) 确定性: 同参数再来一次, 全字节比较
  const r2 = gen.generate(mat, 512);
  const r3 = gen.generate(mat, 512);
  let deterministic = true;
  for (const k of Object.keys(r2.maps) as (keyof TexMaps)[]) {
    const a = r2.maps[k].data, b = r3.maps[k].data;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) { deterministic = false; break; }
    }
    if (!deterministic) break;
  }
  details.push(`同种子两次生成字节级一致: ${deterministic ? '是' : '否'}`);

  const pass = seamMaxDiff === 0 && deterministic && gen2048Ms < 3000;
  return { seamMaxDiff, deterministic, gen2048Ms, pass, details };
}

/** 四边接缝差: col0 vs colW-1, row0 vs rowH-1 的最大通道差 */
export function seamDiff(img: ImageData): number {
  const { width: w, height: h, data } = img;
  let max = 0;
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 4; c++) {
      const a = data[(y * w + 0) * 4 + c];
      const b = data[(y * w + w - 1) * 4 + c];
      const d = Math.abs(a - b);
      if (d > max) max = d;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 4; c++) {
      const a = data[(0 * w + x) * 4 + c];
      const b = data[((h - 1) * w + x) * 4 + c];
      const d = Math.abs(a - b);
      if (d > max) max = d;
    }
  }
  return max;
}
