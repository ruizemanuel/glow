import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { createRng } from '../src/rng';
import { chamferDistance } from '../src/shapes/distance';
import {
  KIND_HALO,
  KIND_RIM,
  KIND_SURFACE,
  KIND_VOLUME,
  kindCounts,
  outwardNormal,
  sampleShape,
} from '../src/shapes/sample';
import { rectMask } from './helpers';

const W = 64;
const H = 64;
const mask = rectMask(W, H, 16, 16, 48, 48);
const dist = chamferDistance(mask, W, H);
const halo = { meanPx: 2, maxPx: 10 };

describe('kindCounts', () => {
  it('suma n y respeta las proporciones', () => {
    const c = kindCounts(1000, CONFIG.kinds);
    expect(c).toEqual([650, 200, 30, 120]);
    expect(kindCounts(7, CONFIG.kinds).reduce((a, b) => a + b, 0)).toBe(7);
  });
});

describe('outwardNormal', () => {
  it('apunta hacia afuera en los bordes rectos', () => {
    const [lx, ly] = outwardNormal(mask, dist, W, H, 16, 32);
    expect(lx).toBeCloseTo(-1, 5);
    expect(ly).toBeCloseTo(0, 5);
    const [tx, ty] = outwardNormal(mask, dist, W, H, 32, 16);
    expect(tx).toBeCloseTo(0, 5);
    expect(ty).toBeCloseTo(-1, 5);
  });

  it('usa el gradiente de distancia en el interior', () => {
    const [nx, ny] = outwardNormal(mask, dist, W, H, 20, 32);
    expect(nx).toBeCloseTo(-1, 5);
    expect(ny).toBeCloseTo(0, 5);
  });
});

describe('sampleShape', () => {
  const n = 2000;
  const s = sampleShape(mask, dist, W, H, n, CONFIG.kinds, halo, createRng(1));

  it('produce la cantidad de puntos por tipo, en bloques ordenados', () => {
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) counts[s.kind[i]]++;
    expect(counts).toEqual(kindCounts(n, CONFIG.kinds));
    for (let i = 1; i < n; i++) expect(s.kind[i]).toBeGreaterThanOrEqual(s.kind[i - 1]);
  });

  it('coloca surface, volume y rim dentro de la máscara', () => {
    for (let i = 0; i < n; i++) {
      if (s.kind[i] === KIND_HALO) continue;
      expect(s.x[i]).toBeGreaterThanOrEqual(16);
      expect(s.x[i]).toBeLessThan(48);
      expect(s.y[i]).toBeGreaterThanOrEqual(16);
      expect(s.y[i]).toBeLessThan(48);
    }
  });

  it('coloca el rim a menos de 2 px del borde', () => {
    for (let i = 0; i < n; i++) {
      if (s.kind[i] !== KIND_RIM) continue;
      const inset = Math.min(s.x[i] - 16, 48 - s.x[i], s.y[i] - 16, 48 - s.y[i]);
      expect(inset).toBeLessThan(2);
    }
  });

  it('coloca el halo fuera del núcleo interior de la forma', () => {
    for (let i = 0; i < n; i++) {
      if (s.kind[i] !== KIND_HALO) continue;
      const x = s.x[i] + s.ox[i];
      const y = s.y[i] + s.oy[i];
      const deepInside = x > 19 && x < 45 && y > 19 && y < 45;
      expect(deepInside).toBe(false);
    }
  });

  it('solo guarda distancia al borde en surface y volume', () => {
    for (let i = 0; i < n; i++) {
      if (s.kind[i] === KIND_SURFACE || s.kind[i] === KIND_VOLUME) expect(s.edge[i]).toBeGreaterThan(0);
      else expect(s.edge[i]).toBe(0);
    }
  });

  it('es determinista con la misma semilla', () => {
    const again = sampleShape(mask, dist, W, H, n, CONFIG.kinds, halo, createRng(1));
    expect(Array.from(again.x)).toEqual(Array.from(s.x));
    expect(Array.from(again.oy)).toEqual(Array.from(s.oy));
  });

  it('falla con una máscara vacía', () => {
    const empty = new Uint8Array(W * H);
    expect(() => sampleShape(empty, dist, W, H, 10, CONFIG.kinds, halo, createRng(1))).toThrow(/too few interior/);
  });
});
