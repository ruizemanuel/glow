import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { adaptCount, createPerf, recordFrame } from '../src/perf';

describe('perf', () => {
  it('calcula el FPS por segundo', () => {
    const p = createPerf(1000);
    let changed = false;
    for (let i = 0; i < 61; i++) changed = recordFrame(p, 1000 / 60) || changed;
    expect(changed).toBe(true);
    expect(p.fps).toBe(60);
  });

  it('baja un 10 % con frames lentos sin pasar del mínimo', () => {
    const p = createPerf(10000);
    p.frameEma = 30;
    expect(adaptCount(p, 2, 8000, 24000, CONFIG.perf)).toBe(true);
    expect(p.nActive).toBe(9000);
    adaptCount(p, 2, 8000, 24000, CONFIG.perf);
    expect(p.nActive).toBe(8100);
    adaptCount(p, 2, 8000, 24000, CONFIG.perf);
    expect(p.nActive).toBe(8000);
  });

  it('sube un 5 % con frames rápidos hasta el tope', () => {
    const p = createPerf(23500);
    p.frameEma = 10;
    adaptCount(p, 2, 8000, 24000, CONFIG.perf);
    expect(p.nActive).toBe(24000);
  });

  it('no cambia antes del intervalo y respeta un tope nuevo', () => {
    const p = createPerf(20000);
    p.frameEma = 30;
    expect(adaptCount(p, 1, 5000, 24000, CONFIG.perf)).toBe(false);
    expect(adaptCount(p, 0.1, 5000, 12000, CONFIG.perf)).toBe(true);
    expect(p.nActive).toBe(12000);
  });
});
