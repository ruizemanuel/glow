import { describe, expect, it } from 'vitest';
import { chamferDistance } from '../src/shapes/distance';
import { rectMask } from './helpers';

describe('chamferDistance', () => {
  const W = 21;
  const H = 21;
  const mask = rectMask(W, H, 5, 5, 16, 16); // 11×11 interior square
  const d = chamferDistance(mask, W, H);
  const at = (x: number, y: number) => d[y * W + x];

  it('is 0 outside the shape', () => {
    expect(at(0, 0)).toBe(0);
    expect(at(4, 10)).toBe(0);
    expect(at(16, 10)).toBe(0);
  });

  it('is 1 on the interior edge', () => {
    expect(at(5, 10)).toBe(1);
    expect(at(15, 10)).toBe(1);
    expect(at(10, 5)).toBe(1);
    expect(at(5, 5)).toBe(1);
  });

  it('grows toward the center', () => {
    expect(at(10, 10)).toBeCloseTo(6, 5);
    expect(at(7, 10)).toBeCloseTo(3, 5);
  });

  it('treats the canvas edge as exterior', () => {
    const full = new Uint8Array(9).fill(1);
    const df = chamferDistance(full, 3, 3);
    expect(df[4]).toBe(2);
    expect(df[0]).toBe(1);
  });
});
