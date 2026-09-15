import type { Config } from '../config';
import { clamp, gaussian, type Rng } from '../rng';
import type { ShapeGroup, ShapeSet } from '../shapes/build';
import { KIND_HALO } from '../shapes/sample';
import type { Layout } from '../view';
import { morphDelay } from './morph';
import { pairByColumns } from './pairing';

/** State of all particles in per-property arrays (SoA). 3D vectors are interleaved x, y, z. */
export interface Particles {
  capacity: number;
  kind: Uint8Array;
  isDot: Uint8Array;
  /** Targets in shape space, independent of layout. */
  shapeA: Float32Array;
  shapeB: Float32Array;
  /** Targets in world space (applyLayout). */
  targetA: Float32Array;
  targetB: Float32Array;
  travelA: Float32Array;
  travelB: Float32Array;
  normalA: Float32Array;
  normalB: Float32Array;
  /** 2D edge normal, interleaved x, y. */
  rimA: Float32Array;
  rimB: Float32Array;
  /** Distance to the edge, in iso units. */
  edgeA: Float32Array;
  edgeB: Float32Array;
  /** Distance from the halo to its edge, in iso units. */
  haloA: Float32Array;
  haloB: Float32Array;
  scatterDir: Float32Array;
  cloud: Float32Array;
  pos: Float32Array;
  vel: Float32Array;
  phase: Float32Array;
  phase2: Float32Array;
  speed: Float32Array;
  mass: Float32Array;
  size: Float32Array;
  lum: Float32Array;
  fuzz: Float32Array;
  buoyancy: Float32Array;
  introDelay: Float32Array;
  morphDelay: Float32Array;
  /** Dot only: 0 at the front (right) and 1 at the back. */
  trail: Float32Array;
  lock: Float32Array;
  lockVel: Float32Array;
  presence: Float32Array;
  flareGlow: Float32Array;
  heat: Float32Array;
  radius: Float32Array;
}

interface Entry {
  a: number;
  b: number;
  dot: 0 | 1;
  kind: number;
}

function pairGroups(groupA: ShapeGroup, groupB: ShapeGroup, dot: 0 | 1, entries: Entry[]): void {
  const A = groupA.points;
  const B = groupB.points;
  if (A.count !== B.count) throw new Error('Paired shape groups must have the same particle count.');
  let start = 0;
  while (start < A.count) {
    const kind = A.kind[start];
    let end = start;
    while (end < A.count && A.kind[end] === kind) end++;
    if (B.kind[start] !== kind || B.kind[end - 1] !== kind) throw new Error('Paired shape groups must share kind blocks.');
    const match = pairByColumns(A.x.subarray(start, end), A.y.subarray(start, end), B.x.subarray(start, end), B.y.subarray(start, end));
    for (let j = 0; j < end - start; j++) entries.push({ a: start + j, b: start + match[j], dot, kind });
    start = end;
  }
}

/**
 * Stratified shuffled order by (kind, dot): any prefix is a uniform sample of each stratum.
 * Returns indices into `strata`, sorted.
 */
export function stratifiedOrder(strata: ArrayLike<number>, rng: Rng): Int32Array {
  const n = strata.length;
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const list = groups.get(strata[i]);
    if (list) list.push(i);
    else groups.set(strata[i], [i]);
  }
  const keys = new Float64Array(n);
  for (const list of groups.values()) {
    for (let j = list.length - 1; j > 0; j--) {
      const k = Math.floor(rng() * (j + 1));
      [list[j], list[k]] = [list[k], list[j]];
    }
    for (let j = 0; j < list.length; j++) keys[list[j]] = (j + rng()) / list.length;
  }
  return Int32Array.from({ length: n }, (_, i) => i).sort((a, b) => keys[a] - keys[b]);
}

export function createParticles(shapes: ShapeSet, rng: Rng, cfg: Config): Particles {
  const entries: Entry[] = [];
  pairGroups(shapes.iso.body, shapes.word.body, 0, entries);
  pairGroups(shapes.iso.dot, shapes.word.dot, 1, entries);
  const n = entries.length;
  const order = stratifiedOrder(
    entries.map((e) => e.kind * 2 + e.dot),
    rng,
  );

  const f3 = () => new Float32Array(n * 3);
  const f2 = () => new Float32Array(n * 2);
  const f1 = () => new Float32Array(n);
  const P: Particles = {
    capacity: n,
    kind: new Uint8Array(n),
    isDot: new Uint8Array(n),
    shapeA: f3(),
    shapeB: f3(),
    targetA: f3(),
    targetB: f3(),
    travelA: f1(),
    travelB: f1(),
    normalA: f3(),
    normalB: f3(),
    rimA: f2(),
    rimB: f2(),
    edgeA: f1(),
    edgeB: f1(),
    haloA: f1(),
    haloB: f1(),
    scatterDir: f3(),
    cloud: f3(),
    pos: f3(),
    vel: f3(),
    phase: f1(),
    phase2: f1(),
    speed: f1(),
    mass: f1(),
    size: f1(),
    lum: f1(),
    fuzz: f1(),
    buoyancy: f1(),
    introDelay: f1(),
    morphDelay: f1(),
    trail: f1(),
    lock: f1(),
    lockVel: f1(),
    presence: f1(),
    flareGlow: f1(),
    heat: f1(),
    radius: f1(),
  };

  const isoToWordUnits = shapes.wordHalfSvg / shapes.isoHalfSvg;
  let dotMinX = Infinity;
  let dotMaxX = -Infinity;

  for (let i = 0; i < n; i++) {
    const e = entries[order[i]];
    const gA = e.dot ? shapes.iso.dot : shapes.iso.body;
    const gB = e.dot ? shapes.word.dot : shapes.word.body;
    const a = e.a;
    const b = e.b;
    const i2 = i * 2;
    const i3 = i * 3;

    P.kind[i] = e.kind;
    P.isDot[i] = e.dot;
    P.shapeA.set([gA.embedded.tx[a], gA.embedded.ty[a], gA.embedded.tz[a]], i3);
    P.shapeB.set([gB.embedded.tx[b], gB.embedded.ty[b], gB.embedded.tz[b]], i3);
    P.normalA.set([gA.embedded.nx[a], gA.embedded.ny[a], gA.embedded.nz[a]], i3);
    P.normalB.set([gB.embedded.nx[b], gB.embedded.ny[b], gB.embedded.nz[b]], i3);
    P.rimA[i2] = gA.points.nx[a];
    P.rimA[i2 + 1] = gA.points.ny[a];
    P.rimB[i2] = gB.points.nx[b];
    P.rimB[i2 + 1] = gB.points.ny[b];
    P.edgeA[i] = gA.points.edge[a];
    P.edgeB[i] = gB.points.edge[b];
    P.haloA[i] = Math.hypot(gA.points.ox[a], gA.points.oy[a]);
    P.haloB[i] = Math.hypot(gB.points.ox[b], gB.points.oy[b]) * isoToWordUnits;

    const gx = gaussian(rng);
    const gy = gaussian(rng);
    const gz = gaussian(rng);
    const gl = Math.hypot(gx, gy, gz) || 1;
    P.scatterDir.set([gx / gl, gy / gl, gz / gl], i3);
    P.cloud.set(
      [0.65 * clamp(gaussian(rng), -2.3, 2.3), 0.54 * clamp(gaussian(rng), -2.3, 2.3), 0.7 * clamp(gaussian(rng), -2.3, 2.3)],
      i3,
    );
    P.pos.set(P.cloud.subarray(i3, i3 + 3), i3);

    const halo = e.kind === KIND_HALO;
    P.phase[i] = rng() * Math.PI * 2;
    P.phase2[i] = rng() * Math.PI * 2;
    P.speed[i] = 0.65 + 0.7 * rng();
    P.mass[i] = 0.8 + 0.4 * rng();
    P.size[i] = (halo ? 0.36 : 0.43) + Math.pow(rng(), 2.5) * (halo ? 0.5 : 0.72);
    P.lum[i] = 0.46 + 0.7 * rng();
    P.fuzz[i] = 0.0015 + 0.004 * Math.pow(rng(), 2.5);
    P.buoyancy[i] = 0.88 + 0.55 * (P.mass[i] - 0.8);
    P.introDelay[i] = 1.2 * rng() + (0.6 * (1 - clamp(gA.points.y[a], -1, 1))) / 2;
    P.morphDelay[i] = e.dot ? 0 : morphDelay(gB.points.x[b], rng(), cfg.morph.spread);

    if (e.dot) {
      dotMinX = Math.min(dotMinX, gA.points.x[a]);
      dotMaxX = Math.max(dotMaxX, gA.points.x[a]);
    }
  }

  const dotRange = Math.max(1e-6, dotMaxX - dotMinX);
  for (let i = 0; i < n; i++) {
    if (!P.isDot[i]) continue;
    const e = entries[order[i]];
    P.trail[i] = 1 - (shapes.iso.dot.points.x[e.a] - dotMinX) / dotRange;
  }

  return P;
}

/** Recomputes world-space targets and travel distances for a layout. */
export function applyLayout(P: Particles, layout: Layout): void {
  for (let i = 0; i < P.capacity; i++) {
    const i3 = i * 3;
    for (let c = 0; c < 3; c++) {
      P.targetA[i3 + c] = P.shapeA[i3 + c];
      P.targetB[i3 + c] = P.shapeB[i3 + c] * layout.wordScale;
    }
    if (P.kind[i] === KIND_HALO) {
      P.travelA[i] = 0.03 * layout.unitA;
      P.travelB[i] = 0.03 * layout.unitB;
    } else {
      P.travelA[i] = clamp((P.edgeA[i] - 0.0078) * 0.4, 0, 0.014) * layout.unitA;
      P.travelB[i] = clamp((P.edgeB[i] - 0.0078) * 0.4, 0, 0.014) * layout.unitB;
    }
  }
}

/** Mean center of the dot in each shape (world x, y). */
export function dotCenters(P: Particles): { a: [number, number]; b: [number, number] } {
  let ax = 0;
  let ay = 0;
  let bx = 0;
  let by = 0;
  let count = 0;
  for (let i = 0; i < P.capacity; i++) {
    if (!P.isDot[i]) continue;
    ax += P.targetA[i * 3];
    ay += P.targetA[i * 3 + 1];
    bx += P.targetB[i * 3];
    by += P.targetB[i * 3 + 1];
    count++;
  }
  const k = 1 / Math.max(1, count);
  return { a: [ax * k, ay * k], b: [bx * k, by * k] };
}
