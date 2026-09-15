import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { buildShapes } from '../src/shapes/build';
import { kindCounts } from '../src/shapes/sample';
import { bboxRaster } from './helpers';

describe('buildShapes', () => {
  const nMax = 2000;
  const cfg = { ...CONFIG, shapes: { ...CONFIG.shapes, rasterSize: 512 } };
  const set = buildShapes(bboxRaster, nMax, cfg);
  const dotCount = Math.round(nMax * CONFIG.particles.dotFraction);

  it('splits particles between body and dot with the same kinds in both shapes', () => {
    expect(set.iso.body.points.count).toBe(nMax - dotCount);
    expect(set.word.body.points.count).toBe(nMax - dotCount);
    expect(set.iso.dot.points.count).toBe(dotCount);
    expect(set.word.dot.points.count).toBe(dotCount);
    const counts = (kinds: Uint8Array) => {
      const c = [0, 0, 0, 0];
      kinds.forEach((k) => c[k]++);
      return c;
    };
    expect(counts(set.iso.body.points.kind)).toEqual(kindCounts(nMax - dotCount, CONFIG.kinds));
    expect(counts(set.word.body.points.kind)).toEqual(counts(set.iso.body.points.kind));
  });

  it('normalizes the isotype to [-1, 1] and the wordmark by its half-width', () => {
    const iso = set.iso.body.points;
    const word = set.word.body.points;
    for (let i = 0; i < iso.count; i++) {
      if (iso.kind[i] === 3) continue;
      expect(Math.abs(iso.x[i])).toBeLessThanOrEqual(1.001);
      expect(Math.abs(word.x[i])).toBeLessThanOrEqual(1.001);
      expect(Math.abs(word.y[i])).toBeLessThan(0.15);
    }
  });

  it('places the wordmark dot to the right and the isotype dot to the bottom right', () => {
    const mean = (a: Float32Array) => a.reduce((s, v) => s + v, 0) / a.length;
    expect(mean(set.word.dot.points.x)).toBeGreaterThan(0.95);
    expect(mean(set.iso.dot.points.x)).toBeGreaterThan(0.6);
    expect(mean(set.iso.dot.points.y)).toBeLessThan(-0.6);
  });

  it('computes a sphere radius that contains the silhouette', () => {
    expect(set.sphereRadius).toBeGreaterThan(1);
    expect(set.sphereRadius).toBeLessThan(1.5);
    expect(set.isoHalfSvg).toBeCloseTo(7.7105, 3);
    expect(set.wordHalfSvg).toBe(53.5);
    expect(set.wordHalfHeight).toBeCloseTo(0.1402, 3);
  });
});
