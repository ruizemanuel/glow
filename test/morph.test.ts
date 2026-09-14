import { describe, expect, it } from 'vitest';
import { bodyTarget, dotCenter, localProgress, morphDelay } from '../src/sim/morph';

const spread = 0.6;

describe('morphDelay', () => {
  it('queda siempre en [0, spread] y crece hacia la derecha', () => {
    expect(morphDelay(-1, 0, spread)).toBe(0);
    expect(morphDelay(1, 1, spread)).toBeCloseTo(spread, 10);
    expect(morphDelay(0.5, 0.5, spread)).toBeGreaterThan(morphDelay(-0.5, 0.5, spread));
    expect(morphDelay(3, 1, spread)).toBeLessThanOrEqual(spread);
  });
});

describe('localProgress', () => {
  it('vale 0 en p = 0 y 1 en p = 1 para cualquier retraso válido', () => {
    for (const delay of [0, 0.2, 0.45, spread]) {
      expect(localProgress(0, delay, spread)).toBe(0);
      expect(localProgress(1, delay, spread)).toBe(1);
    }
  });

  it('es continua y monótona en p', () => {
    let prev = 0;
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const q = localProgress(p, 0.3, spread);
      expect(q).toBeGreaterThanOrEqual(prev - 1e-12);
      expect(q - prev).toBeLessThan(0.05);
      prev = q;
    }
  });
});

describe('bodyTarget', () => {
  const out = [0, 0, 0];
  it('coincide con A en q = 0 y con B en q = 1', () => {
    bodyTarget(out, 1, 2, 3, -4, 5, -6, 0, 1, 0, 0, 0.35);
    expect(out).toEqual([1, 2, 3]);
    bodyTarget(out, 1, 2, 3, -4, 5, -6, 0, 1, 0, 1, 0.35);
    expect(out[0]).toBeCloseTo(-4, 10);
    expect(out[1]).toBeCloseTo(5, 10);
    expect(out[2]).toBeCloseTo(-6, 10);
  });

  it('se desvía en nube a mitad de camino', () => {
    bodyTarget(out, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0.5, 0.35);
    expect(out[1]).toBeCloseTo(0.35, 10);
  });
});

describe('dotCenter', () => {
  it('va de A a B pasando por arriba', () => {
    const out = [0, 0];
    dotCenter(out, 0, 0.8, -0.7, 2.5, -0.2, 0.25);
    expect(out).toEqual([0.8, -0.7]);
    dotCenter(out, 1, 0.8, -0.7, 2.5, -0.2, 0.25);
    expect(out[0]).toBeCloseTo(2.5, 10);
    expect(out[1]).toBeCloseTo(-0.2, 10);
    dotCenter(out, 0.5, 0.8, -0.7, 2.5, -0.2, 0.25);
    expect(out[1]).toBeGreaterThan((-0.7 + -0.2) / 2);
  });
});
