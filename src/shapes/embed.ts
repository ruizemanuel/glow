import { KIND_RIM, KIND_VOLUME } from './sample';

/** Puntos de una forma en espacio normalizado (y hacia arriba). */
export interface ShapePoints {
  count: number;
  x: Float32Array;
  y: Float32Array;
  ox: Float32Array;
  oy: Float32Array;
  oz: Float32Array;
  /** Normal 2D hacia afuera. */
  nx: Float32Array;
  ny: Float32Array;
  /** Distancia al borde en "unidades iso" (unidades SVG / semilado del isotipo). */
  edge: Float32Array;
  depth: Float32Array;
  kind: Uint8Array;
}

export interface Embedded {
  tx: Float32Array;
  ty: Float32Array;
  tz: Float32Array;
  nx: Float32Array;
  ny: Float32Array;
  nz: Float32Array;
}

export type Surface =
  | { type: 'sphere'; radius: number; camDist: number }
  | { type: 'panel'; curve: number; thickness: number };

/** Radio de la esfera cuya silueta, vista desde camDist, toca el punto de borde más lejano. */
export function sphereRadiusFor(maxBoundaryRadius: number, margin: number, camDist: number): number {
  const n = maxBoundaryRadius + margin;
  return n / Math.sqrt(1 + (n * n) / (camDist * camDist));
}

function normalize3(out: Float32Array[], i: number, x: number, y: number, z: number): void {
  const len = Math.hypot(x, y, z);
  if (len < 1e-9) {
    out[0][i] = 0;
    out[1][i] = 0;
    out[2][i] = 1;
    return;
  }
  out[0][i] = x / len;
  out[1][i] = y / len;
  out[2][i] = z / len;
}

export function embed(p: ShapePoints, surface: Surface): Embedded {
  const n = p.count;
  const e: Embedded = {
    tx: new Float32Array(n),
    ty: new Float32Array(n),
    tz: new Float32Array(n),
    nx: new Float32Array(n),
    ny: new Float32Array(n),
    nz: new Float32Array(n),
  };
  const normals = [e.nx, e.ny, e.nz];

  for (let i = 0; i < n; i++) {
    const kind = p.kind[i];
    let x = p.x[i];
    let y = p.y[i];
    let z: number;

    if (surface.type === 'sphere') {
      const f = surface.camDist * surface.camDist;
      const u = surface.radius * surface.radius;
      const k = x * x + y * y;
      const root = Math.sqrt(Math.max(0, f * u - k * (f - u)));
      const tNear = (f - root) / (f + k);
      const tFar = (f + root) / (f + k);
      const t = kind === KIND_VOLUME ? tNear + (tFar - tNear) * p.depth[i] : tNear;
      x *= t;
      y *= t;
      z = surface.camDist * (1 - t);
      if (kind >= KIND_RIM) normalize3(normals, i, p.nx[i], p.ny[i], 0.08);
      else normalize3(normals, i, x, y, z);
    } else {
      z = -surface.curve * x * x;
      if (kind === KIND_VOLUME) z += (p.depth[i] * 2 - 1) * surface.thickness;
      if (kind >= KIND_RIM) normalize3(normals, i, p.nx[i], p.ny[i], 0.08);
      else normalize3(normals, i, 2 * surface.curve * x, 0, 1);
    }

    e.tx[i] = x + p.ox[i];
    e.ty[i] = y + p.oy[i];
    e.tz[i] = z + p.oz[i];
  }
  return e;
}
