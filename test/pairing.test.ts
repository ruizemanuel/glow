import { describe, expect, it } from 'vitest';
import { createRng } from '../src/rng';
import { pairByColumns } from '../src/sim/pairing';

function randomSet(n: number, seed: number, width: number): { x: Float32Array; y: Float32Array } {
  const rng = createRng(seed);
  return { x: Float32Array.from({ length: n }, () => (rng() * 2 - 1) * width), y: Float32Array.from({ length: n }, () => rng() * 2 - 1) };
}

describe('pairByColumns', () => {
  it('devuelve una permutación', () => {
    const a = randomSet(500, 1, 1);
    const b = randomSet(500, 2, 4);
    const match = pairByColumns(a.x, a.y, b.x, b.y);
    expect(new Set(match).size).toBe(500);
    expect(Math.min(...match)).toBe(0);
    expect(Math.max(...match)).toBe(499);
  });

  it('empareja un conjunto consigo mismo como identidad', () => {
    const a = randomSet(200, 3, 1);
    const match = pairByColumns(a.x, a.y, a.x, a.y);
    expect(Array.from(match)).toEqual(Array.from({ length: 200 }, (_, i) => i));
  });

  it('preserva el orden izquierda→derecha', () => {
    const a = randomSet(900, 4, 1);
    const b = randomSet(900, 5, 5);
    const match = pairByColumns(a.x, a.y, b.x, b.y);
    let leftSum = 0;
    let leftN = 0;
    let rightSum = 0;
    let rightN = 0;
    for (let i = 0; i < 900; i++) {
      if (a.x[i] < -0.5) {
        leftSum += b.x[match[i]];
        leftN++;
      } else if (a.x[i] > 0.5) {
        rightSum += b.x[match[i]];
        rightN++;
      }
    }
    expect(leftSum / leftN).toBeLessThan(-2);
    expect(rightSum / rightN).toBeGreaterThan(2);
  });

  it('falla con conjuntos de distinto tamaño', () => {
    const a = randomSet(10, 1, 1);
    const b = randomSet(11, 2, 1);
    expect(() => pairByColumns(a.x, a.y, b.x, b.y)).toThrow(/equal-sized/);
  });
});
