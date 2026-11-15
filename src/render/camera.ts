// ---------- 轨道相机 + 矩阵工具 ----------
export type Vec3 = [number, number, number];
export type Mat4 = Float32Array; // 16, 列主序

export function mat4Identity(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function mat4Perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f;
  m[10] = (far + near) / (near - far); m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

export function mat4LookAt(eye: Vec3, center: Vec3, up: Vec3): Mat4 {
  const z = normalize3(sub3(eye, center));
  const x = normalize3(cross3(up, z));
  const y = cross3(z, x);
  const m = new Float32Array(16);
  m[0] = x[0]; m[4] = x[1]; m[8] = x[2]; m[12] = -dot3(x, eye);
  m[1] = y[0]; m[5] = y[1]; m[9] = y[2]; m[13] = -dot3(y, eye);
  m[2] = z[0]; m[6] = z[1]; m[10] = z[2]; m[14] = -dot3(z, eye);
  m[15] = 1;
  return m;
}

export function mat4Mul(a: Mat4, b: Mat4): Mat4 {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}

export function mat4Translate(x: number, y: number, z: number): Mat4 {
  const m = mat4Identity();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
}

export function mat4RotateY(a: number): Mat4 {
  const m = mat4Identity(); const c = Math.cos(a), s = Math.sin(a);
  m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
  return m;
}

export function mat4InvertRigid(m: Mat4): Mat4 {
  // 仅旋转+平移
  const o = mat4Identity();
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[c * 4 + r] = m[r * 4 + c];
  const t = [m[12], m[13], m[14]];
  o[12] = -(o[0] * t[0] + o[4] * t[1] + o[8] * t[2]);
  o[13] = -(o[1] * t[0] + o[5] * t[1] + o[9] * t[2]);
  o[14] = -(o[2] * t[0] + o[6] * t[1] + o[10] * t[2]);
  return o;
}

export function sub3(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
export function cross3(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function dot3(a: Vec3, b: Vec3): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function normalize3(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

export class OrbitCamera {
  yaw = 0.6;
  pitch = 0.35;
  dist = 1.1;
  target: Vec3 = [0, 0.18, 0];
  fov = (38 * Math.PI) / 180;

  view(): Mat4 {
    const eye = this.eye();
    return mat4LookAt(eye, this.target, [0, 1, 0]);
  }
  eye(): Vec3 {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    return [
      this.target[0] + this.dist * cp * Math.sin(this.yaw),
      this.target[1] + this.dist * sp,
      this.target[2] + this.dist * cp * Math.cos(this.yaw),
    ];
  }
  proj(aspect: number): Mat4 {
    return mat4Perspective(this.fov, aspect, 0.01, 20);
  }
  /** 屏幕像素 delta -> 旋转 */
  rotate(dx: number, dy: number): void {
    this.yaw -= dx * 0.008;
    this.pitch = clamp(this.pitch + dy * 0.008, -1.4, 1.4);
  }
  zoom(delta: number): void {
    this.dist = clamp(this.dist * (delta > 0 ? 1.1 : 0.9), 0.25, 4);
  }
}

function clamp(v: number, a: number, b: number): number { return Math.min(b, Math.max(a, v)); }
