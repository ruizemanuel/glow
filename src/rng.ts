export type Rng = () => number;

/** Deterministic linear congruential generator: returns values in [0, 1). */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Standard normal (Box–Muller). */
export function gaussian(rng: Rng): number {
  return Math.sqrt(-2 * Math.log(Math.max(1e-8, rng()))) * Math.cos(2 * Math.PI * rng());
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}
