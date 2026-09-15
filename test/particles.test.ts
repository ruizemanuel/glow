import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { createRng } from '../src/rng';
import { buildShapes } from '../src/shapes/build';
import { applyLayout, createParticles, dotCenters, stratifiedOrder } from '../src/sim/particles';
import { computeLayout } from '../src/view';
import { bboxRaster } from './helpers';

const cfg = { ...CONFIG, shapes: { ...CONFIG.shapes, rasterSize: 512 } };
const N = 3000;
const shapes = buildShapes(bboxRaster, N, cfg);
const layout = computeLayout(1280, 800, 1, shapes, cfg);

describe('stratifiedOrder', () => {
  it('makes any prefix respect the proportions of each stratum', () => {
    const strata = Uint8Array.from({ length: 10000 }, (_, i) => (i % 100 < 65 ? 0 : i % 100 < 85 ? 1 : i % 100 < 88 ? 2 : 3));
    const order = stratifiedOrder(strata, createRng(7));
    expect(new Set(order).size).toBe(10000);
    for (const prefix of [1000, 3333, 7000]) {
      const counts = [0, 0, 0, 0];
      for (let i = 0; i < prefix; i++) counts[strata[order[i]]]++;
      expect(counts[0] / prefix).toBeCloseTo(0.65, 1);
      expect(Math.abs(counts[3] / prefix - 0.12)).toBeLessThan(0.02);
    }
  });
});

describe('createParticles', () => {
  const P = createParticles(shapes, createRng(1), cfg);
  applyLayout(P, layout);

  it('creates one particle per point with the correct count in the dot', () => {
    expect(P.capacity).toBe(N);
    const dots = P.isDot.reduce((s, v) => s + v, 0);
    expect(dots).toBe(Math.round(N * cfg.particles.dotFraction));
  });

  it('starts in the cloud, unlocked', () => {
    expect(Array.from(P.pos.subarray(0, 30))).toEqual(Array.from(P.cloud.subarray(0, 30)));
    expect(P.lock.every((v) => v === 0)).toBe(true);
  });

  it('scales the B targets by wordScale', () => {
    for (let i = 0; i < 50; i++) expect(P.targetB[i * 3]).toBeCloseTo(P.shapeB[i * 3] * layout.wordScale, 5);
  });

  it('places the dot center to the right in both shapes', () => {
    const { a, b } = dotCenters(P);
    expect(a[0]).toBeGreaterThan(0.5);
    expect(b[0]).toBeGreaterThan(layout.wordScale * 0.9);
  });

  it('bounds the delays and the travel distance', () => {
    for (let i = 0; i < N; i++) {
      expect(P.morphDelay[i]).toBeGreaterThanOrEqual(0);
      expect(P.morphDelay[i]).toBeLessThanOrEqual(cfg.morph.spread);
      expect(P.travelA[i]).toBeLessThanOrEqual(0.03 + 1e-6);
    }
  });

  it('marks the dot trail: 0 at the front and 1 at the back', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < N; i++) {
      if (!P.isDot[i]) continue;
      min = Math.min(min, P.trail[i]);
      max = Math.max(max, P.trail[i]);
    }
    expect(min).toBeCloseTo(0, 5);
    expect(max).toBeCloseTo(1, 5);
  });
});
