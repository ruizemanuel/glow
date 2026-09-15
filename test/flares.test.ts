import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { KIND_HALO, KIND_SURFACE } from '../src/shapes/sample';
import { applyFlares, createFlareIO, createFlares, flareCandidates, resetFlares, updateFlares } from '../src/sim/flares';

// Four halo particles on the edges of a square and one surface particle at the center.
const kind = Uint8Array.from([KIND_HALO, KIND_HALO, KIND_HALO, KIND_HALO, KIND_SURFACE]);
const target = Float32Array.from([1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0]);
const rim = Float32Array.from([1, 0, -1, 0, 0, 1, 0, -1, 0, 0]);
const timing = CONFIG.flares;

describe('flareCandidates', () => {
  it('on the sphere, accepts halos with an outward radial normal', () => {
    expect(Array.from(flareCandidates(kind, target, rim, 'sphere'))).toEqual([0, 1, 2, 3]);
  });

  it('on the panel, accepts only top and bottom edges', () => {
    expect(Array.from(flareCandidates(kind, target, rim, 'panel'))).toEqual([2, 3]);
  });

  it('fails if there are no candidates', () => {
    expect(() => flareCandidates(Uint8Array.from([KIND_SURFACE]), new Float32Array(3), new Float32Array(2), 'sphere')).toThrow(/No outward/);
  });
});

describe('updateFlares', () => {
  const candidates = flareCandidates(kind, target, rim, 'sphere');

  it('chooses sources among the candidates and keeps emitters apart', () => {
    const flares = createFlares(2, 4.8);
    updateFlares(flares, 1, candidates, target, 0.72, timing);
    for (const f of flares) expect(Array.from(candidates)).toContain(f.source);
    expect(flares[0].source).not.toBe(flares[1].source);
  });

  it('ramps energy up, holds it, and turns it off at the end of the active cycle', () => {
    const flares = createFlares(1, 4.8);
    updateFlares(flares, -0.3, candidates, target, 0.72, timing);
    expect(flares[0].energy).toBe(0);
    updateFlares(flares, 1.5, candidates, target, 0.72, timing);
    expect(flares[0].energy).toBeCloseTo(1, 5);
    updateFlares(flares, 4.2, candidates, target, 0.72, timing);
    expect(flares[0].energy).toBe(0);
  });

  it('resetFlares forces choosing again', () => {
    const flares = createFlares(1, 4.8);
    updateFlares(flares, 1, candidates, target, 0.72, timing);
    resetFlares(flares);
    expect(flares[0].source).toBe(-1);
    expect(flares[0].cycle).toBe(-1);
  });
});

describe('applyFlares', () => {
  it('pushes a halo near the source outward', () => {
    const flares = createFlares(1, 4.8);
    flares[0].source = 0;
    flares[0].energy = 1;
    flares[0].age = 1.2;
    flares[0].height = 0.5;
    const io = createFlareIO();
    io.x = 1;
    io.y = 0;
    io.z = 0;
    applyFlares(io, flares, target, rim, 0, true, 1, 1, 0, 0, 1, 1, 1);
    expect(io.x).toBeGreaterThan(1.1);
    expect(io.energy).toBeGreaterThan(0.5);
  });

  it('does not affect distant particles or ones with force 0', () => {
    const flares = createFlares(1, 4.8);
    flares[0].source = 0;
    flares[0].energy = 1;
    flares[0].age = 1.2;
    const io = createFlareIO();
    io.x = -1;
    applyFlares(io, flares, target, rim, 1, true, 1, 1, 0, 0, 1, 1, 1);
    expect(io.x).toBe(-1);
    io.x = 1;
    applyFlares(io, flares, target, rim, 0, true, 1, 1, 0, 0, 1, 1, 0);
    expect(io.x).toBe(1);
    expect(io.energy).toBe(0);
  });
});
