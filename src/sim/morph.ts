import { clamp, smoothstep } from '../rng';

/** Retraso de una partícula en la transición, siempre en [0, spread]. xNormB ∈ [−1, 1]. */
export function morphDelay(xNormB: number, rand: number, spread: number): number {
  const x01 = clamp((xNormB + 1) / 2, 0, 1);
  return spread * (0.85 * x01 + 0.15 * rand);
}

/** Progreso local suavizado: 0 en p = 0 y 1 en p = 1 para cualquier retraso en [0, spread]. */
export function localProgress(p: number, delay: number, spread: number): number {
  return smoothstep(p * (1 + spread) - delay);
}

/**
 * Objetivo de una partícula del cuerpo: interpolación A→B más un desvío en nube que sube y baja con sin(π·q).
 * Escribe x, y, z en out[0..2].
 */
export function bodyTarget(
  out: Float32Array | number[],
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  sx: number,
  sy: number,
  sz: number,
  q: number,
  scatter: number,
): void {
  const lift = Math.sin(Math.PI * q) * scatter;
  out[0] = ax + (bx - ax) * q + sx * lift;
  out[1] = ay + (by - ay) * q + sy * lift;
  out[2] = az + (bz - az) * q + sz * lift;
}

/** Centro del punto sobre una Bézier cuadrática de A a B con el control elevado `lift`. */
export function dotCenter(out: Float32Array | number[], q: number, ax: number, ay: number, bx: number, by: number, lift: number): void {
  const cx = (ax + bx) / 2;
  const cy = (ay + by) / 2 + lift;
  const u = 1 - q;
  out[0] = u * u * ax + 2 * u * q * cx + q * q * bx;
  out[1] = u * u * ay + 2 * u * q * cy + q * q * by;
}
