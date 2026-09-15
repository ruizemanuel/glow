import { describe, expect, it } from 'vitest';
import { createTilt, updateTilt } from '../src/sim/tilt';

describe('updateTilt', () => {
  const params = { max: 0.13, stiffness: 24, damping: 7.5 };

  it('follows the pointer and stays bounded', () => {
    const withPointer = createTilt();
    const without = createTilt();
    for (let i = 0; i < 300; i++) {
      updateTilt(withPointer, 1 / 60, 0, true, 1, 0, params, false);
      updateTilt(without, 1 / 60, 0, false, 1, 0, params, false);
    }
    expect(withPointer.yaw - without.yaw).toBeCloseTo(0.13, 2);
    expect(Math.abs(withPointer.yaw)).toBeLessThan(0.25);
  });

  it('returns to 0 with reduced motion', () => {
    const t = { yaw: 0.2, pitch: 0.1, vYaw: 1, vPitch: 1 };
    updateTilt(t, 1 / 60, 3, true, 1, 1, params, true);
    expect(t).toEqual({ yaw: 0, pitch: 0, vYaw: 0, vPitch: 0 });
  });
});
