// ---------- 程序化包型网格 ----------
// loft: 水平超椭圆截面沿高度堆叠; boston: 截面沿 X 轴扫掠
// UV 约定: 周向 u = 整数个 tile (保证环绕无缝), v 按世界尺寸等密度, 封口用平面投影 UV

export interface Mesh {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

export type BagKind = 'tote' | 'boston' | 'clutch';

export const BAG_NAMES: Record<BagKind, string> = {
  tote: '托特包', boston: '波士顿包', clutch: '手拿包',
};

/** 1 个贴图 tile 对应的世界尺寸 (米) */
const TILE_WORLD = 0.35;

/** 超椭圆截面: (|cos t|^e, |sin t|^e) 带符号 */
function superellipse(t: number, e: number): [number, number] {
  const c = Math.cos(t), s = Math.sin(t);
  return [Math.sign(c) * Math.pow(Math.abs(c), e), Math.sign(s) * Math.pow(Math.abs(s), e)];
}

/**
 * 按弧长均匀采样超椭圆截面 (等角度采样会在扁平截面两侧拉伸贴图)
 * 返回 n+1 个点 (首尾重合)
 */
function ringByArcLength(rx: number, rz: number, e: number, n: number): [number, number][] {
  const OVER = 16;
  const M = n * OVER;
  const pts: [number, number][] = [];
  const cum: number[] = [0];
  for (let i = 0; i < M; i++) {
    pts.push(superellipse((i / M) * Math.PI * 2, e).map((v, k) => v * (k === 0 ? rx : rz)) as [number, number]);
  }
  for (let i = 1; i <= M; i++) {
    const [x0, z0] = pts[i - 1];
    const [x1, z1] = i < M ? pts[i] : pts[0];
    cum.push(cum[i - 1] + Math.hypot(x1 - x0, z1 - z0));
  }
  const total = cum[M];
  const out: [number, number][] = [];
  let seg = 0;
  for (let i = 0; i <= n; i++) {
    const target = (i / n) * total;
    while (seg < M - 1 && cum[seg + 1] < target) seg++;
    const [x0, z0] = pts[seg];
    const [x1, z1] = seg + 1 < M ? pts[seg + 1] : pts[0];
    const segLen = cum[seg + 1] - cum[seg] || 1;
    const f = (target - cum[seg]) / segLen;
    out.push([x0 + (x1 - x0) * f, z0 + (z1 - z0) * f]);
  }
  return out;
}

/** 超椭圆截面近似周长 (保留给外部估算用) */
export function approxPerimeter(rx: number, rz: number): number {
  const a = Math.max(rx, rz), b = Math.min(rx, rz);
  const h = ((a - b) / (a + b)) ** 2;
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

export function computeNormals(m: Mesh): void {
  const n = m.normals; n.fill(0);
  const p = m.positions, idx = m.indices;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const abx = p[b] - p[a], aby = p[b + 1] - p[a + 1], abz = p[b + 2] - p[a + 2];
    const acx = p[c] - p[a], acy = p[c + 1] - p[a + 1], acz = p[c + 2] - p[a + 2];
    const nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
    for (const v of [a, b, c]) { n[v] += nx; n[v + 1] += ny; n[v + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
}

class MeshBuilder {
  pos: number[] = [];
  uv: number[] = [];
  idx: number[] = [];
  vert(px: number, py: number, pz: number, u: number, v: number): number {
    this.pos.push(px, py, pz);
    this.uv.push(u, v);
    return this.pos.length / 3 - 1;
  }
  tri(a: number, b: number, c: number): void { this.idx.push(a, b, c); }
  build(): Mesh {
    const mesh: Mesh = {
      positions: new Float32Array(this.pos),
      normals: new Float32Array(this.pos.length),
      uvs: new Float32Array(this.uv),
      indices: new Uint32Array(this.idx),
    };
    computeNormals(mesh);
    return mesh;
  }
}

export function makeBag(kind: BagKind): Mesh {
  return kind === 'boston' ? makeBoston() : makeLoftBag(kind);
}

/** 托特/手拿包: 水平截面沿 Y 堆叠, 顶底平面投影封口 */
function makeLoftBag(kind: 'tote' | 'clutch'): Mesh {
  const sections = 48, around = 72;
  const H = kind === 'clutch' ? 0.05 : 0.42;
  const b = new MeshBuilder();

  // 截面参数
  const section = (t: number): { rx: number; rz: number; e: number; y: number } => {
    if (kind === 'tote') {
      let rx = 0.30 + 0.09 * t;
      let rz = 0.115 * (1 - 0.2 * t);
      const cap = Math.min(1, Math.min(t, 1 - t) * 12 + 0.15);
      rx *= 0.82 + 0.18 * cap; rz *= 0.82 + 0.18 * cap;
      return { rx, rz, e: 0.55, y: t * H };
    }
    let rx = 0.30, rz = 0.19;
    const cap = Math.min(1, Math.min(t, 1 - t) * 8 + 0.1);
    rx *= 0.7 + 0.3 * cap; rz *= 0.7 + 0.3 * cap;
    return { rx, rz, e: 0.5, y: t * H };
  };

  // 周向 tile 数取整数保证无缝 (用真实弧长周长)
  const mid = section(0.5);
  const midRing = ringByArcLength(mid.rx, mid.rz, mid.e, 256);
  let perimeter = 0;
  for (let i = 1; i < midRing.length; i++) {
    perimeter += Math.hypot(midRing[i][0] - midRing[i - 1][0], midRing[i][1] - midRing[i - 1][1]);
  }
  const uTiles = Math.max(1, Math.round(perimeter / TILE_WORLD));
  const vTiles = H / TILE_WORLD;

  const ringStart: number[] = [];
  for (let i = 0; i <= sections; i++) {
    const t = i / sections;
    const { rx, rz, e, y } = section(t);
    const ring = ringByArcLength(rx, rz, e, around);
    ringStart.push(b.pos.length / 3);
    for (let j = 0; j <= around; j++) {
      const [sx, sz] = ring[j];
      b.vert(sx, y, sz, (j / around) * uTiles, t * vTiles);
    }
  }
  for (let i = 0; i < sections; i++) {
    for (let j = 0; j < around; j++) {
      const a = ringStart[i] + j, c = ringStart[i + 1] + j;
      b.tri(a, c, a + 1);
      b.tri(a + 1, c, c + 1);
    }
  }

  // 封口: 复制边缘环 + 平面投影 UV (与侧面不同的 UV => 必须独立顶点)
  const cap = (ringIdx: number, y: number, top: boolean) => {
    const ring: number[] = [];
    // 用实际截面点 (从侧壁环读取位置)
    const srcStart = ringStart[ringIdx];
    for (let j = 0; j <= around; j++) {
      const vi = srcStart + j;
      const x = b.pos[vi * 3], z = b.pos[vi * 3 + 2];
      ring.push(b.vert(x, y, z, x / TILE_WORLD, z / TILE_WORLD));
    }
    const center = b.vert(0, y, 0, 0, 0);
    for (let j = 0; j < around; j++) {
      // 顶盖 +Y: (center, j, j+1) 在 XZ 平面为 -Y... 由叉积: (c,pj,pj1) => -Y, 所以顶盖用 (c, pj1, pj)
      if (top) b.tri(center, ring[j + 1], ring[j]);
      else b.tri(center, ring[j], ring[j + 1]);
    }
  };
  cap(0, 0, false);
  cap(sections, H, true);

  return b.build();
}

/** 波士顿包: 圆角筒, 路径沿 X, 两端平面投影封口 */
function makeBoston(): Mesh {
  const sections = 64, around = 64;
  const b = new MeshBuilder();
  const radius = (t: number): number => {
    const end = Math.sin(Math.PI * t);
    return 0.17 * (0.30 + 0.70 * Math.pow(Math.max(0, end), 0.55));
  };
  const uTiles = Math.max(1, Math.round((Math.PI * 2 * 0.17) / TILE_WORLD));
  const vTiles = 0.56 / TILE_WORLD;

  const ringStart: number[] = [];
  for (let i = 0; i <= sections; i++) {
    const t = i / sections;
    const r = radius(t);
    const x = (t - 0.5) * 0.56;
    const ring = ringByArcLength(r, r * 0.95, 0.9, around);
    ringStart.push(b.pos.length / 3);
    for (let j = 0; j <= around; j++) {
      const [sy, sz] = ring[j];
      b.vert(x, sy, sz, (j / around) * uTiles, t * vTiles);
    }
  }
  for (let i = 0; i < sections; i++) {
    for (let j = 0; j < around; j++) {
      const a = ringStart[i] + j, c = ringStart[i + 1] + j;
      b.tri(a, a + 1, c);
      b.tri(a + 1, c + 1, c);
    }
  }

  // 端盖: 平面投影 (y,z)
  const cap = (ringIdx: number, x: number, positiveX: boolean) => {
    const srcStart = ringStart[ringIdx];
    const ring: number[] = [];
    for (let j = 0; j <= around; j++) {
      const vi = srcStart + j;
      const y = b.pos[vi * 3 + 1], z = b.pos[vi * 3 + 2];
      ring.push(b.vert(x, y, z, y / TILE_WORLD, z / TILE_WORLD));
    }
    const center = b.vert(x, 0, 0, 0, 0);
    for (let j = 0; j < around; j++) {
      // (c, pj, pj1) 在 YZ 截面 => +X 法线
      if (positiveX) b.tri(center, ring[j], ring[j + 1]);
      else b.tri(center, ring[j + 1], ring[j]);
    }
  };
  cap(0, -0.28, false);
  cap(sections, 0.28, true);

  return b.build();
}

/** 平面色卡 */
export function makeSwatch(): Mesh {
  const seg = 24;
  const b = new MeshBuilder();
  for (let i = 0; i <= seg; i++) {
    for (let j = 0; j <= seg; j++) {
      const u = j / seg, v = i / seg;
      b.vert((u - 0.5) * 0.5, (v - 0.5) * 0.36, 0, u * (0.5 / TILE_WORLD), v * (0.36 / TILE_WORLD));
    }
  }
  const cols = seg + 1;
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * cols + j, c = a + cols;
      b.tri(a, c, a + 1);
      b.tri(a + 1, c, c + 1);
    }
  }
  return b.build();
}
