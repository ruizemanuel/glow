import { describe, expect, it } from 'vitest';
import { rampColor, rampGlsl, RAMP_STOPS } from '../src/render/ramp';

describe('color ramp', () => {
  const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  it('starts at black and passes through the brand orange', () => {
    expect(rampColor(0)).toEqual([0, 0, 0]);
    const orange = rampColor(0.45).map((v) => Math.round(v * 255));
    expect(orange).toEqual([255, 77, 0]);
  });

  it('has monotonically increasing luminance', () => {
    let prev = -1;
    for (let i = 0; i <= 200; i++) {
      const l = luminance(rampColor(i / 200));
      expect(l).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = l;
    }
  });

  it('generates a GLSL segment per interval', () => {
    const glsl = rampGlsl();
    expect(glsl.match(/return mix/g)?.length).toBe(RAMP_STOPS.length - 1);
    expect(glsl).toContain('vec3 ramp(float x)');
  });
});
