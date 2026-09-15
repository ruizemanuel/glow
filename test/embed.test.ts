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
  it('is slightly smaller than the silhouette radius due to perspective', () => {
    const r = sphereRadiusFor(1, 0, CAM);
    expect(r).toBeLessThan(1);
    expect(r).toBeGreaterThan(0.98);
  });
});

describe('embed on sphere', () => {
  const radius = sphereRadiusFor(1.2, 0.008, CAM);
  const p = points([
    { x: 0.3, y: -0.4, kind: KIND_SURFACE },
    { x: 0.3, y: -0.4, kind: KIND_VOLUME, depth: 1 },
    { x: -0.9, y: 0.2, kind: KIND_RIM, nx: -1, ny: 0 },
    { x: 0.5, y: 0.5, kind: KIND_HALO, nx: 1, ny: 0, ox: 0.1 },
  ]);
  const e = embed(p, { type: 'sphere', radius, camDist: CAM });

  it('places the surface on the sphere, on the camera side', () => {
    expect(Math.hypot(e.tx[0], e.ty[0], e.tz[0])).toBeCloseTo(radius, 5);
    expect(e.tz[0]).toBeGreaterThan(0);
  });

  it('projects the surface exactly onto its 2D point', () => {
    const s = CAM / (CAM - e.tz[0]);
    expect(e.tx[0] * s).toBeCloseTo(0.3, 5);
    expect(e.ty[0] * s).toBeCloseTo(-0.4, 5);
  });

  it('sends the volume with depth=1 to the far side, along the same line of sight', () => {
    expect(e.tz[1]).toBeLessThan(0);
    const s = CAM / (CAM - e.tz[1]);
    expect(e.tx[1] * s).toBeCloseTo(0.3, 5);
  });

  it('uses the edge normal for the rim and adds the offset for the halo', () => {
    expect(e.nx[2]).toBeLessThan(-0.99);
    expect(e.tx[3]).toBeGreaterThan(0.1);
  });

  it('produces unit normals', () => {
    for (let i = 0; i < 4; i++) expect(Math.hypot(e.nx[i], e.ny[i], e.nz[i])).toBeCloseTo(1, 5);
  });
});

describe('embed on panel', () => {
  const p = points([
    { x: 0.8, y: 0.1, kind: KIND_SURFACE },
    { x: 0.8, y: 0.1, kind: KIND_VOLUME, depth: 1 },
  ]);
  const e = embed(p, { type: 'panel', curve: 0.18, thickness: 0.04 });

  it('curves the surface backward at the ends', () => {
    expect(e.tz[0]).toBeCloseTo(-0.18 * 0.64, 5);
    expect(e.tx[0]).toBeCloseTo(0.8, 5);
  });

  it('gives thickness to the volume', () => {
    expect(e.tz[1]).toBeCloseTo(-0.18 * 0.64 + 0.04, 5);
  });

  it('tilts the normal according to the curvature', () => {
    expect(e.nx[0]).toBeGreaterThan(0);
    expect(Math.hypot(e.nx[0], e.ny[0], e.nz[0])).toBeCloseTo(1, 5);
  });
});
