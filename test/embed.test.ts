import { describe, expect, it } from 'vitest';
import { embed, sphereRadiusFor, type ShapePoints } from '../src/shapes/embed';
import { KIND_HALO, KIND_RIM, KIND_SURFACE, KIND_VOLUME } from '../src/shapes/sample';

function points(list: Array<{ x: number; y: number; kind: number; depth?: number; nx?: number; ny?: number; ox?: number }>): ShapePoints {
  const n = list.length;
  const p: ShapePoints = {
    count: n,
    x: Float32Array.from(list, (q) => q.x),
    y: Float32Array.from(list, (q) => q.y),
    ox: Float32Array.from(list, (q) => q.ox ?? 0),
    oy: new Float32Array(n),
    oz: new Float32Array(n),
    nx: Float32Array.from(list, (q) => q.nx ?? 0),
    ny: Float32Array.from(list, (q) => q.ny ?? 0),
    edge: new Float32Array(n),
    depth: Float32Array.from(list, (q) => q.depth ?? 0),
    kind: Uint8Array.from(list, (q) => q.kind),
  };
  return p;
}

const CAM = 6.3;

describe('sphereRadiusFor', () => {
  it('es algo menor que el radio de la silueta por la perspectiva', () => {
    const r = sphereRadiusFor(1, 0, CAM);
    expect(r).toBeLessThan(1);
    expect(r).toBeGreaterThan(0.98);
  });
});

describe('embed en esfera', () => {
  const radius = sphereRadiusFor(1.2, 0.008, CAM);
  const p = points([
    { x: 0.3, y: -0.4, kind: KIND_SURFACE },
    { x: 0.3, y: -0.4, kind: KIND_VOLUME, depth: 1 },
    { x: -0.9, y: 0.2, kind: KIND_RIM, nx: -1, ny: 0 },
    { x: 0.5, y: 0.5, kind: KIND_HALO, nx: 1, ny: 0, ox: 0.1 },
  ]);
  const e = embed(p, { type: 'sphere', radius, camDist: CAM });

  it('pone la superficie sobre la esfera, del lado de la cámara', () => {
    expect(Math.hypot(e.tx[0], e.ty[0], e.tz[0])).toBeCloseTo(radius, 5);
    expect(e.tz[0]).toBeGreaterThan(0);
  });

  it('proyecta la superficie exactamente sobre su punto 2D', () => {
    const s = CAM / (CAM - e.tz[0]);
    expect(e.tx[0] * s).toBeCloseTo(0.3, 5);
    expect(e.ty[0] * s).toBeCloseTo(-0.4, 5);
  });

  it('manda el volumen con depth=1 al lado lejano, sobre la misma línea de visión', () => {
    expect(e.tz[1]).toBeLessThan(0);
    const s = CAM / (CAM - e.tz[1]);
    expect(e.tx[1] * s).toBeCloseTo(0.3, 5);
  });

  it('usa la normal del borde en el rim y suma el desplazamiento en el halo', () => {
    expect(e.nx[2]).toBeLessThan(-0.99);
    expect(e.tx[3]).toBeGreaterThan(0.1);
  });

  it('produce normales unitarias', () => {
    for (let i = 0; i < 4; i++) expect(Math.hypot(e.nx[i], e.ny[i], e.nz[i])).toBeCloseTo(1, 5);
  });
});

describe('embed en panel', () => {
  const p = points([
    { x: 0.8, y: 0.1, kind: KIND_SURFACE },
    { x: 0.8, y: 0.1, kind: KIND_VOLUME, depth: 1 },
  ]);
  const e = embed(p, { type: 'panel', curve: 0.18, thickness: 0.04 });

  it('curva la superficie hacia atrás en los extremos', () => {
    expect(e.tz[0]).toBeCloseTo(-0.18 * 0.64, 5);
    expect(e.tx[0]).toBeCloseTo(0.8, 5);
  });

  it('da espesor al volumen', () => {
    expect(e.tz[1]).toBeCloseTo(-0.18 * 0.64 + 0.04, 5);
  });

  it('inclina la normal según la curvatura', () => {
    expect(e.nx[0]).toBeGreaterThan(0);
    expect(Math.hypot(e.nx[0], e.ny[0], e.nz[0])).toBeCloseTo(1, 5);
  });
});
