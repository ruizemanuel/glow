import { describe, expect, it } from 'vitest';
import { createField, hash3, sampleField, updateField, valueNoise3 } from '../src/sim/field';

describe('ruido', () => {
  it('hash3 es determinista y está en [−1, 1]', () => {
    expect(hash3(1, 2, 3)).toBe(hash3(1, 2, 3));
    for (let i = 0; i < 200; i++) {
      const h = hash3(i, -i * 3, i * 7);
      expect(h).toBeGreaterThanOrEqual(-1);
      expect(h).toBeLessThanOrEqual(1);
    }
  });

  it('valueNoise3 coincide con el hash en los nodos enteros', () => {
    expect(valueNoise3(2, 5, -1)).toBeCloseTo(hash3(2, 5, -1), 10);
  });
});

describe('campo de flujo', () => {
  const f = createField(32, 1.6);
  updateField(f, 12.5);
  const out = [0, 0, 0, 0];

  it('cubre [−extent, extent] con el paso correcto', () => {
    expect(f.step).toBeCloseTo(3.2 / 31, 10);
  });

  it('muestrea exactamente el valor de un nodo', () => {
    const r = 10;
    const c = 7;
    sampleField(f, c * f.step - f.extent, r * f.step - f.extent, out);
    const i = r * 32 + c;
    expect(out[0]).toBeCloseTo(f.dx[i], 5);
    expect(out[2]).toBeCloseTo(f.dz[i], 5);
  });

  it('produce desplazamientos acotados', () => {
    for (let i = 0; i < f.dx.length; i++) {
      expect(Math.abs(f.dx[i])).toBeLessThan(0.06);
      expect(Math.abs(f.dy[i])).toBeLessThan(0.06);
      expect(Math.abs(f.dz[i])).toBeLessThan(0.2);
    }
  });

  it('es determinista y no recalcula para el mismo tiempo', () => {
    const g = createField(32, 1.6);
    updateField(g, 12.5);
    expect(Array.from(g.dx)).toEqual(Array.from(f.dx));
    g.dx[0] = 99;
    updateField(g, 12.5);
    expect(g.dx[0]).toBe(99);
  });

  it('limita el muestreo fuera de la rejilla', () => {
    sampleField(f, 50, -50, out);
    expect(Number.isFinite(out[0])).toBe(true);
  });
});
