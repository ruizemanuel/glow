import { clamp, smoothstep } from '../rng';
import { KIND_HALO } from '../shapes/sample';
import { hash3 } from './field';

export interface Flare {
  period: number;
  offset: number;
  cycle: number;
  /** Index of the source particle, or −1. */
  source: number;
  height: number;
  handedness: number;
  age: number;
  energy: number;
}

export interface FlareTiming {
  active: number;
  rise: number;
  fall: number;
}

export function createFlares(count: number, period: number): Flare[] {
  return Array.from({ length: count }, (_, i) => ({
    period,
    offset: 0.3 + (period * i) / count,
    cycle: -1,
    source: -1,
    height: 0.5,
    handedness: 1,
    age: 0,
    energy: 0,
  }));
}

export function resetFlares(flares: Flare[]): void {
  for (const f of flares) {
    f.cycle = -1;
    f.source = -1;
    f.energy = 0;
  }
}

/** Halo particles whose edge faces outward: radially on the sphere, up/down on the panel. */
export function flareCandidates(kind: Uint8Array, target: Float32Array, rim: Float32Array, mode: 'sphere' | 'panel'): Int32Array {
  const list: number[] = [];
  for (let i = 0; i < kind.length; i++) {
    if (kind[i] !== KIND_HALO) continue;
    const nx = rim[i * 2];
    const ny = rim[i * 2 + 1];
    if (nx === 0 && ny === 0) continue;
    const x = target[i * 3];
    const y = target[i * 3 + 1];
    if (mode === 'sphere') {
      const r = Math.hypot(x, y);
      if (r > 1e-6 && (x * nx + y * ny) / r > 0.55) list.push(i);
    } else if (Math.abs(ny) > 0.6 && y * ny > 0) {
      list.push(i);
    }
  }
  if (list.length === 0) throw new Error('No outward-facing flare sources were found.');
  return Int32Array.from(list);
}

/** Advances the emitters. On each new cycle, picks a source far from the others. */
export function updateFlares(flares: Flare[], time: number, candidates: Int32Array, target: Float32Array, separation: number, timing: FlareTiming): void {
  for (let f = 0; f < flares.length; f++) {
    const fl = flares[f];
    const local = time + fl.offset;
    const cycle = Math.floor(local / fl.period);
    if (cycle !== fl.cycle) {
      fl.cycle = cycle;
      let best = -1;
      for (let k = 0; k < 24; k++) {
        const slot = Math.floor(((hash3(cycle, f, 97 + 17 * k) + 1) / 2) * candidates.length);
        const pick = candidates[Math.min(candidates.length - 1, slot)];
        let nearest = Infinity;
        for (let g = 0; g < flares.length; g++) {
          const other = flares[g];
          if (g === f || other.source < 0) continue;
          const dx = target[pick * 3] - target[other.source * 3];
          const dy = target[pick * 3 + 1] - target[other.source * 3 + 1];
          nearest = Math.min(nearest, Math.hypot(dx, dy));
        }
        if (nearest > best) {
          best = nearest;
          fl.source = pick;
        }
        if (nearest > separation) break;
      }
      fl.height = 0.5 + 0.06 * (hash3(cycle, f, 113) + 1);
      fl.handedness = hash3(cycle, f, 151) < 0 ? -1 : 1;
    }
    fl.age = local - cycle * fl.period;
    fl.energy = smoothstep(fl.age / timing.rise) * smoothstep((timing.active - fl.age) / timing.fall);
  }
}

/** Per-particle input/output: rest position (modified for the halo) and edge peel-off accumulators. */
export interface FlareIO {
  x: number;
  y: number;
  z: number;
  peelX: number;
  peelY: number;
  peelZ: number;
  energy: number;
  release: number;
}

export function createFlareIO(): FlareIO {
  return { x: 0, y: 0, z: 0, peelX: 0, peelY: 0, peelZ: 0, energy: 0, release: 0 };
}

/**
 * Applies the active flares to particle i.
 * The halo near the source follows an outward arc and returns; the inner edge peels off slightly.
 */
export function applyFlares(
  io: FlareIO,
  flares: Flare[],
  target: Float32Array,
  rim: Float32Array,
  i: number,
  isHalo: boolean,
  rimFactor: number,
  lockK: number,
  phase: number,
  phase2: number,
  speed: number,
  unit: number,
  strength: number,
): void {
  io.energy = 0;
  io.release = 0;
  const tx = target[i * 3];
  const ty = target[i * 3 + 1];
  const rnx = rim[i * 2];
  const rny = rim[i * 2 + 1];
  let px = 0;
  let py = 0;
  let pz = 0;

  for (const fl of flares) {
    const energy = fl.energy * strength;
    if (energy < 0.001 || fl.source < 0) continue;
    const s = fl.source;
    const snx = rim[s * 2];
    const sny = rim[s * 2 + 1];
    if (rnx * snx + rny * sny < 0.25) continue;
    const dist = Math.hypot(tx - target[s * 3], ty - target[s * 3 + 1]) / unit;
    const outer = isHalo ? 0.46 : 0.34;
    const inner = isHalo ? 0.18 : 0.1;
    if (dist >= outer) continue;

    const w = clamp((fl.age - (phase / (2 * Math.PI)) * 0.65) / (2.35 + 0.15 * speed), 0, 1);
    const life = smoothstep(w / 0.085) * smoothstep((1 - w) / 0.18);
    const influence = (1 - smoothstep((dist - inner) / (outer - inner))) * energy * (isHalo ? 1 : lockK) * life;
    if (influence <= 0) continue;
    const rise = w < 0.28 ? smoothstep(w / 0.28) : 1 - smoothstep((w - 0.28) / 0.72);
    const reach = rise * (fl.height + 0.026 * Math.cos(phase2)) * unit;
    const arc = Math.sin(Math.PI * w);
    const curl = 0.24 * fl.handedness * arc * arc * unit;
    const wobble = 0.055 * Math.sin(phase2 + 2 * w) * rise * unit;

    if (isHalo) {
      const gx = target[s * 3] + snx * reach - sny * (curl + wobble);
      const gy = target[s * 3 + 1] + sny * reach + snx * (curl + wobble);
      const gz = target[s * 3 + 2] + 0.32 * reach + 0.1 * fl.handedness * arc * unit + wobble;
      io.x += (gx - io.x) * influence;
      io.y += (gy - io.y) * influence;
      io.z += (gz - io.z) * influence;
      io.energy = Math.max(io.energy, influence);
    } else {
      const f = influence * rimFactor;
      const out = 0.11 * rise * (0.55 + 0.45 * Math.sin(phase2) ** 2) * f * unit;
      const side = 0.14 * curl * f;
      px += rnx * out - rny * side;
      py += rny * out + rnx * side;
      pz += 0.07 * rise * f * unit;
      io.release = Math.max(io.release, f);
    }
  }

  const len = Math.hypot(px, py);
  const cap = 0.11 * unit;
  const k = len > cap ? cap / len : 1;
  io.peelX = px * k;
  io.peelY = py * k;
  io.peelZ = Math.min(0.09 * unit, pz);
}
