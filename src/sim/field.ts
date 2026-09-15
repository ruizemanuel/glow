import { lerp } from '../rng';

/** Integer hash of a 3D cell to [−1, 1]. */
export function hash3(x: number, y: number, z: number): number {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 2147483647.5 - 1;
}

const fade = (t: number) => t * t * t * (t * (6 * t - 15) + 10);

/** 3D value noise with quintic smoothing, in [−1, 1]. */
export function valueNoise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const u = fade(x - xi);
  const v = fade(y - yi);
  const w = fade(z - zi);
  const x00 = lerp(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u);
  const x10 = lerp(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u);
  const x01 = lerp(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u);
  const x11 = lerp(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}

export interface FlowField {
  size: number;
  extent: number;
  step: number;
  time: number;
  potential: Float32Array;
  dx: Float32Array;
  dy: Float32Array;
  dz: Float32Array;
  glow: Float32Array;
}

/** Grid of size×size nodes covering [−extent, extent]². */
export function createField(size: number, extent: number): FlowField {
  const n = size * size;
  return {
    size,
    extent,
    step: (2 * extent) / (size - 1),
    time: Number.NaN,
    potential: new Float32Array(n),
    dx: new Float32Array(n),
    dy: new Float32Array(n),
    dz: new Float32Array(n),
    glow: new Float32Array(n),
  };
}

/** Recomputes the grid for `time`: noise currents + curl of the potential + traveling waves. */
export function updateField(f: FlowField, time: number): void {
  if (time === f.time) return;
  f.time = time;
  const e = time;
  const amp = 0.9 + 0.25 * valueNoise3(0.12 * e, 8, 51);
  const n = f.size;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const o = c * f.step - f.extent;
      const k = r * f.step - f.extent;
      f.potential[i] =
        valueNoise3(1.05 * o + 0.14 * e, 1.05 * k - 0.065 * e, 0.09 * e) +
        0.28 * valueNoise3(2.7 * o - 0.085 * e, 2.7 * k + 0.11 * e, 0.13 * e + 19);
      const s = valueNoise3(0.9 * o - 0.08 * e, 0.9 * k + 0.05 * e, 0.19 * e + 37);
      const wave1 = 3.6 * o + 1.8 * k - 1.25 * e + 2 * s;
      const wave2 = -2.4 * o + 4.2 * k - 0.83 * e + 1.35 * valueNoise3(2.1 * o + 0.14 * e, 2.1 * k - 0.12 * e, 0.17 * e + 71);
      const a = 0.014 * Math.cos(wave1) * (0.8 + 0.2 * s) * amp;
      const b = 0.006 * Math.cos(wave2) * amp;
      f.dx[i] = 0.78 * a - 0.48 * b;
      f.dy[i] = 0.36 * a + 0.8 * b;
      f.dz[i] = (0.078 * Math.sin(wave1) * (0.85 + 0.25 * s) + 0.036 * Math.sin(wave2) + 0.03 * s) * amp;
      f.glow[i] = 0.12 * Math.cos(wave1 - 0.4) + 0.065 * Math.cos(wave2 + 0.3);
    }
  }
  const scale = (0.007 * amp) / (2 * f.step);
  for (let r = 1; r < n - 1; r++) {
    for (let c = 1; c < n - 1; c++) {
      const i = r * n + c;
      f.dx[i] += (f.potential[i + n] - f.potential[i - n]) * scale;
      f.dy[i] -= (f.potential[i + 1] - f.potential[i - 1]) * scale;
    }
  }
}

/** Bilinear sampling at world (x, y). Writes [dx, dy, dz, glow] into out. */
export function sampleField(f: FlowField, x: number, y: number, out: Float32Array | number[]): void {
  const n = f.size;
  const gx = Math.min(n - 1.001, Math.max(0, (x + f.extent) / f.step));
  const gy = Math.min(n - 1.001, Math.max(0, (y + f.extent) / f.step));
  const c = Math.floor(gx);
  const r = Math.floor(gy);
  const u = gx - c;
  const v = gy - r;
  const i = r * n + c;
  const w00 = (1 - u) * (1 - v);
  const w10 = u * (1 - v);
  const w01 = (1 - u) * v;
  const w11 = u * v;
  out[0] = f.dx[i] * w00 + f.dx[i + 1] * w10 + f.dx[i + n] * w01 + f.dx[i + n + 1] * w11;
  out[1] = f.dy[i] * w00 + f.dy[i + 1] * w10 + f.dy[i + n] * w01 + f.dy[i + n + 1] * w11;
  out[2] = f.dz[i] * w00 + f.dz[i + 1] * w10 + f.dz[i + n] * w01 + f.dz[i + n + 1] * w11;
  out[3] = f.glow[i] * w00 + f.glow[i + 1] * w10 + f.glow[i + n] * w01 + f.glow[i + n + 1] * w11;
}
