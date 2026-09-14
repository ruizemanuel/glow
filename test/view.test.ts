import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { computeLayout, projectToScreen, rotate, screenToWorld, tiltMatrix } from '../src/view';

const shapes = { wordHalfHeight: 0.1402, isoHalfSvg: 7.5455, wordHalfSvg: 53.5 };

describe('computeLayout', () => {
  it('ajusta el isotipo al lado menor y el wordmark al ancho', () => {
    const l = computeLayout(1440, 900, 1, shapes, CONFIG);
    expect(l.pxPerUnit).toBeCloseTo((0.55 * 900) / 2, 5);
    expect(2 * l.wordScale * l.pxPerUnit).toBeCloseTo(0.88 * 1440, 3);
    expect(l.unitB).toBeCloseTo((l.wordScale * 7.5455) / 53.5, 5);
    expect(l.mobile).toBe(false);
  });

  it('limita el wordmark por alto en pantallas muy anchas', () => {
    const l = computeLayout(3000, 500, 1, shapes, CONFIG);
    expect(2 * 0.1402 * l.wordScale * l.pxPerUnit).toBeCloseTo(0.4 * 500, 3);
  });

  it('usa píxeles de dispositivo con el dpr acotado', () => {
    const l = computeLayout(390, 844, 3, shapes, CONFIG);
    expect(l.dpr).toBe(2);
    expect(l.width).toBe(780);
    expect(l.mobile).toBe(true);
  });
});

describe('rotación', () => {
  it('tiltMatrix coincide con rotate', () => {
    const yaw = 0.3;
    const pitch = -0.2;
    const m = tiltMatrix(yaw, pitch);
    const v = [0.4, -0.7, 0.2];
    const out = [0, 0, 0];
    rotate(yaw, pitch, v[0], v[1], v[2], out);
    for (let r = 0; r < 3; r++) {
      const fromMatrix = m[r] * v[0] + m[3 + r] * v[1] + m[6 + r] * v[2];
      expect(fromMatrix).toBeCloseTo(out[r], 6);
    }
  });
});

describe('proyección', () => {
  it('screenToWorld invierte projectToScreen en z = 0', () => {
    const l = computeLayout(1280, 800, 2, shapes, CONFIG);
    const [px, py] = projectToScreen(l, CONFIG.camDist, 0.5, -0.25, 0);
    const [x, y] = screenToWorld(l, px / l.dpr, py / l.dpr);
    expect(x).toBeCloseTo(0.5, 6);
    expect(y).toBeCloseTo(-0.25, 6);
  });
});
