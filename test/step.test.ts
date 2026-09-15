import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { buildShapes } from '../src/shapes/build';
import { KIND_HALO, KIND_SURFACE } from '../src/shapes/sample';
import { initialState, reduce, type SceneState } from '../src/sim/state';
import { createSim, setActiveCount, stepSim, writeInstances, type Sim } from '../src/sim/step';
import { computeLayout } from '../src/view';
import { bboxRaster } from './helpers';

const cfg = { ...CONFIG, shapes: { ...CONFIG.shapes, rasterSize: 512 } };
const N = 3000;
const shapes = buildShapes(bboxRaster, N, cfg);
const layout = computeLayout(1280, 800, 1, shapes, cfg);
const DT = 1 / 60;

function advance(sim: Sim, state: SceneState, seconds: number, reduced = false): SceneState {
  let s = state;
  for (let t = 0; t < seconds; t += DT) {
    s = reduce(s, { type: 'tick', dt: DT }, cfg.timing);
    stepSim(sim, s, DT, reduced);
  }
  return s;
}

function meanSurfaceError(sim: Sim, target: Float32Array): number {
  const P = sim.particles;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < P.capacity; i++) {
    if (P.kind[i] !== KIND_SURFACE) continue;
    sum += Math.hypot(P.pos[i * 3] - target[i * 3], P.pos[i * 3 + 1] - target[i * 3 + 1]);
    n++;
  }
  return sum / n;
}

describe('stepSim', () => {
  it('forms the b. during the intro', () => {
    const sim = createSim(shapes, layout, N, false, cfg);
    const state = advance(sim, initialState(), 5);
    expect(state.phase).toBe('idleB');
    expect(meanSurfaceError(sim, sim.particles.targetA)).toBeLessThan(0.02);
  });

  it('with reduced motion places everything in position in a single step', () => {
    const sim = createSim(shapes, layout, N, true, cfg);
    stepSim(sim, { phase: 'idleB', t: 0, p: 0, dir: 1 }, DT, true);
    expect(meanSurfaceError(sim, sim.particles.targetA)).toBeLessThan(1e-6);
  });

  it('finishes the transition on basement.', () => {
    const sim = createSim(shapes, layout, N, false, cfg);
    advance(sim, { phase: 'morph', t: 0, p: 0, dir: 1 }, 5);
    expect(meanSurfaceError(sim, sim.particles.targetB)).toBeLessThan(0.02);
  });

  it('produces finite, non-negative heat, and the dot is hotter than the body', () => {
    const sim = createSim(shapes, layout, N, false, cfg);
    advance(sim, initialState(), 5);
    const P = sim.particles;
    let dotHeat = 0;
    let dotN = 0;
    let bodyHeat = 0;
    let bodyN = 0;
    for (let i = 0; i < P.capacity; i++) {
      expect(Number.isFinite(P.heat[i])).toBe(true);
      expect(P.heat[i]).toBeGreaterThanOrEqual(0);
      if (P.kind[i] === KIND_HALO) continue;
      if (P.isDot[i]) {
        dotHeat += P.heat[i];
        dotN++;
      } else {
        bodyHeat += P.heat[i];
        bodyN++;
      }
    }
    expect(dotHeat / dotN).toBeGreaterThan((1.5 * bodyHeat) / bodyN);
  });

  it('fades out particles that fall outside nActive', () => {
    const sim = createSim(shapes, layout, N, false, cfg);
    const state = advance(sim, initialState(), 4);
    setActiveCount(sim, 1000);
    advance(sim, state, 4);
    expect(sim.nHigh).toBe(1000);
    const out = new Float32Array(N * 5);
    const count = writeInstances(sim, out);
    expect(count).toBeLessThanOrEqual(1000);
    for (let i = 0; i < count * 5; i++) expect(Number.isFinite(out[i])).toBe(true);
  });
});
