import { describe, expect, it } from 'vitest';
import { initialState, reduce, shapeBlend, type SceneState } from '../src/sim/state';

const timing = { intro: 3.5, morph: 3 };
const tick = (s: SceneState, dt: number) => reduce(s, { type: 'tick', dt }, timing);
const toggle = (s: SceneState) => reduce(s, { type: 'toggle' }, timing);

function run(s: SceneState, seconds: number, dt = 0.1): SceneState {
  let out = s;
  for (let t = 0; t < seconds - 1e-9; t += dt) out = tick(out, dt);
  return out;
}

describe('state machine', () => {
  it('starts in intro and moves to idleB', () => {
    let s = initialState();
    expect(s.phase).toBe('intro');
    s = run(s, 3.4);
    expect(s.phase).toBe('intro');
    s = run(s, 0.2);
    expect(s.phase).toBe('idleB');
  });

  it('ignores the toggle during intro', () => {
    const s = initialState();
    expect(toggle(s)).toBe(s);
  });

  it('goes through idleB → morph → idleWord → morph → idleB', () => {
    let s = run(initialState(), 3.6);
    s = toggle(s);
    expect(s).toMatchObject({ phase: 'morph', p: 0, dir: 1 });
    s = run(s, 1.5);
    expect(s.phase).toBe('morph');
    expect(s.p).toBeCloseTo(0.5, 5);
    s = run(s, 1.6);
    expect(s).toMatchObject({ phase: 'idleWord', p: 1 });
    s = toggle(s);
    expect(s).toMatchObject({ phase: 'morph', p: 1, dir: -1 });
    s = run(s, 3.1);
    expect(s).toMatchObject({ phase: 'idleB', p: 0 });
  });

  it('reverses direction mid-transition without jumping', () => {
    let s = toggle(run(initialState(), 3.6));
    s = run(s, 1.2);
    const p = s.p;
    s = toggle(s);
    expect(s.dir).toBe(-1);
    expect(s.p).toBe(p);
    s = run(s, 1.3);
    expect(s.phase).toBe('idleB');
  });

  it('with intro 0 moves to idleB on the first tick', () => {
    const s = reduce(initialState(), { type: 'tick', dt: 0.016 }, { intro: 0, morph: 0.6 });
    expect(s.phase).toBe('idleB');
  });

  it('shapeBlend reflects the current shape', () => {
    expect(shapeBlend({ phase: 'idleB', t: 0, p: 0, dir: 1 })).toBe(0);
    expect(shapeBlend({ phase: 'morph', t: 0, p: 0.3, dir: 1 })).toBe(0.3);
    expect(shapeBlend({ phase: 'idleWord', t: 0, p: 1, dir: 1 })).toBe(1);
  });
});
