export type Phase = 'intro' | 'idleB' | 'morph' | 'idleWord';

export interface SceneState {
  phase: Phase;
  /** Segundos desde que empezó la fase actual. */
  t: number;
  /** Progreso de la transición: 0 = b., 1 = basement. */
  p: number;
  dir: 1 | -1;
}

export type SceneEvent = { type: 'tick'; dt: number } | { type: 'toggle' };

export interface Timing {
  intro: number;
  morph: number;
}

export function initialState(): SceneState {
  return { phase: 'intro', t: 0, p: 0, dir: 1 };
}

export function reduce(s: SceneState, e: SceneEvent, timing: Timing): SceneState {
  if (e.type === 'toggle') {
    switch (s.phase) {
      case 'intro':
        return s;
      case 'idleB':
        return { phase: 'morph', t: 0, p: 0, dir: 1 };
      case 'idleWord':
        return { phase: 'morph', t: 0, p: 1, dir: -1 };
      case 'morph':
        return { ...s, dir: s.dir === 1 ? -1 : 1 };
    }
  }

  const t = s.t + e.dt;
  switch (s.phase) {
    case 'intro':
      return t >= timing.intro ? { phase: 'idleB', t: 0, p: 0, dir: 1 } : { ...s, t };
    case 'morph': {
      const p = s.p + (s.dir * e.dt) / timing.morph;
      if (p >= 1) return { phase: 'idleWord', t: 0, p: 1, dir: 1 };
      if (p <= 0) return { phase: 'idleB', t: 0, p: 0, dir: 1 };
      return { ...s, t, p };
    }
    default:
      return { ...s, t };
  }
}

/** Mezcla global entre formas: 0 en b., 1 en basement. */
export function shapeBlend(s: SceneState): number {
  return s.phase === 'idleWord' ? 1 : s.phase === 'morph' ? s.p : 0;
}
