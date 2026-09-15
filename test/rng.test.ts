import { describe, expect, it } from 'vitest';
import { clamp, createRng, gaussian, lerp, smoothstep } from '../src/rng';

describe('createRng', () => {
  it('is deterministic and returns values in [0, 1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('changes with the seed', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });

  it('gaussian has mean close to 0 and standard deviation close to 1', () => {
    const rng = createRng(3);
    let sum = 0;
    let sq = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const g = gaussian(rng);
      sum += g;
      sq += g * g;
    }
    expect(Math.abs(sum / n)).toBeLessThan(0.05);
    expect(Math.sqrt(sq / n)).toBeCloseTo(1, 1);
  });
});

describe('utilities', () => {
  it('clamp, lerp and smoothstep', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(lerp(2, 4, 0.25)).toBe(2.5);
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0.5)).toBe(0.5);
    expect(smoothstep(2)).toBe(1);
  });
});
