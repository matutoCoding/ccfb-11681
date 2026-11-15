// ---------- 材质数据模型 ----------

export type PatternKind = 'litchi' | 'crosshatch' | 'croc';

export interface EmbossParams {
  kind: PatternKind;
  /** 整数:一个 tile 横向/纵向的晶格数(平铺周期) */
  cells: number;
  /** 压纹深度 0..1 */
  depth: number;
  /** 细纹叠加强度 0..1 */
  grain: number;
  /** 十字纹角度(度), 鳄鱼纹紧实度等, 各纹样解释不同 */
  angle: number;
  /** 鳄鱼纹裂纹宽度 / 荔枝纹圆润度 0..1 */
  crack: number;
}

export interface AgingParams {
  /** 三种做旧刷痕贴图 (dataURL PNG, 可空) 存在 material 里 */
  maskPng: string | null;
  /** 各通道整体强度 */
  wear: number;   // 磨损
  wax: number;    // 油蜡
  crease: number; // 折痕
}

export interface Material {
  id: string;            // 皮料编号, 如 LTH-7F3K2
  name: string;
  seed: number;          // 确定性种子
  baseColor: string;     // #rrggbb
  roughness: number;     // 基础粗糙度 0..1
  normalStrength: number;
  emboss: EmbossParams;
  aging: AgingParams;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;    // dataURL
}

export interface TexMaps {
  albedo: ImageData;
  normal: ImageData;
  roughness: ImageData;
  height: ImageData;
}

export const DEFAULT_EMBOSS: EmbossParams = {
  kind: 'litchi', cells: 24, depth: 0.6, grain: 0.5, angle: 45, crack: 0.35,
};

export function defaultMaterial(seq: number): Material {
  const seed = (seq * 2654435761) >>> 0;
  return {
    id: makeId(seed),
    name: `新皮料 ${seq}`,
    seed,
    baseColor: '#8a5a33',
    roughness: 0.55,
    normalStrength: 1.0,
    emboss: { ...DEFAULT_EMBOSS },
    aging: { maskPng: null, wear: 1, wax: 1, crease: 1 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function makeId(seed: number): string {
  const chars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let x = (seed ^ 0x9e3779b9) >>> 0;
  let s = '';
  for (let i = 0; i < 5; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    s += chars[x % chars.length];
  }
  return `LTH-${s}`;
}
