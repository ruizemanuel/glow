import type { Rng } from '../rng';

export const KIND_SURFACE = 0;
export const KIND_VOLUME = 1;
export const KIND_RIM = 2;
export const KIND_HALO = 3;

export interface KindFractions {
  surface: number;
  volume: number;
  rim: number;
  halo: number;
}

/** Cantidad de puntos por tipo [surface, volume, rim, halo]; el redondeo sobrante va a surface. */
export function kindCounts(n: number, f: KindFractions): [number, number, number, number] {
  const volume = Math.round(n * f.volume);
  const rim = Math.round(n * f.rim);
  const halo = Math.round(n * f.halo);
  return [n - volume - rim - halo, volume, rim, halo];
}

/** Puntos muestreados en coordenadas de la máscara (píxeles, y hacia abajo), agrupados por tipo. */
export interface Sample2D {
  count: number;
  /** Posición base. En el halo es el punto del borde de donde sale. */
  x: Float32Array;
  y: Float32Array;
  /** Desplazamiento del halo respecto de la base (0 en los demás tipos). */
  ox: Float32Array;
  oy: Float32Array;
  oz: Float32Array;
  /** Normal 2D hacia afuera (unitaria, o 0 si no está definida). */
  nx: Float32Array;
  ny: Float32Array;
  /** Distancia al borde en píxeles (0 en rim y halo). */
  edge: Float32Array;
  /** Valor uniforme en [0, 1) para la profundidad del volumen. */
  depth: Float32Array;
  kind: Uint8Array;
}

export interface HaloParams {
  meanPx: number;
  maxPx: number;
}

/** Normal hacia afuera en un píxel: suma de direcciones a vecinos exteriores o, si no hay, el gradiente de distancia. */
export function outwardNormal(
  mask: Uint8Array,
  dist: Float32Array,
  width: number,
  height: number,
  px: number,
  py: number,
): [number, number] {
  let vx = 0;
  let vy = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const x = px + dx;
      const y = py + dy;
      const outside = x < 0 || y < 0 || x >= width || y >= height || mask[y * width + x] === 0;
      if (outside) {
        const len = Math.hypot(dx, dy);
        vx += dx / len;
        vy += dy / len;
      }
    }
  }
  if (vx === 0 && vy === 0) {
    const g = (x: number, y: number): number =>
      x < 0 || y < 0 || x >= width || y >= height ? 0 : dist[y * width + x];
    vx = -(g(px + 1, py) - g(px - 1, py));
    vy = -(g(px, py + 1) - g(px, py - 1));
  }
  const len = Math.hypot(vx, vy);
  return len > 1e-6 ? [vx / len, vy / len] : [0, 0];
}

export function sampleShape(
  mask: Uint8Array,
  dist: Float32Array,
  width: number,
  height: number,
  n: number,
  fractions: KindFractions,
  halo: HaloParams,
  rng: Rng,
): Sample2D {
  let interiorCount = 0;
  let borderCount = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    interiorCount++;
    if (dist[i] <= 1.5) borderCount++;
  }
  if (interiorCount < 100) throw new Error(`Shape mask has too few interior pixels (${interiorCount}).`);
  if (borderCount === 0) throw new Error('Shape mask has no border pixels.');

  const interior = new Int32Array(interiorCount);
  const border = new Int32Array(borderCount);
  for (let i = 0, a = 0, b = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    interior[a++] = i;
    if (dist[i] <= 1.5) border[b++] = i;
  }

  const s: Sample2D = {
    count: n,
    x: new Float32Array(n),
    y: new Float32Array(n),
    ox: new Float32Array(n),
    oy: new Float32Array(n),
    oz: new Float32Array(n),
    nx: new Float32Array(n),
    ny: new Float32Array(n),
    edge: new Float32Array(n),
    depth: new Float32Array(n),
    kind: new Uint8Array(n),
  };

  const counts = kindCounts(n, fractions);
  const haloCdfCap = 1 - Math.exp(-halo.maxPx / halo.meanPx);
  let i = 0;
  for (let kind = KIND_SURFACE; kind <= KIND_HALO; kind++) {
    const pool = kind <= KIND_VOLUME ? interior : border;
    for (let c = 0; c < counts[kind]; c++, i++) {
      const p = pool[Math.floor(rng() * pool.length)];
      const px = p % width;
      const py = (p - px) / width;
      const [nx, ny] = outwardNormal(mask, dist, width, height, px, py);
      s.x[i] = px + rng();
      s.y[i] = py + rng();
      s.nx[i] = nx;
      s.ny[i] = ny;
      s.kind[i] = kind;
      s.depth[i] = rng();
      s.edge[i] = kind <= KIND_VOLUME ? dist[p] : 0;
      if (kind === KIND_HALO) {
        const r = -halo.meanPx * Math.log(1 - rng() * haloCdfCap);
        const t = (rng() - 0.5) * r * 0.8;
        s.ox[i] = nx * r - ny * t;
        s.oy[i] = ny * r + nx * t;
        s.oz[i] = (rng() - 0.5) * r * 1.8;
      }
    }
  }
  return s;
}
