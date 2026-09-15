import type { Config } from '../config';
import { clamp, createRng, lerp, smoothstep } from '../rng';
import type { ShapeSet } from '../shapes/build';
import { KIND_HALO, KIND_RIM, KIND_VOLUME } from '../shapes/sample';
import type { Layout } from '../view';
import { createField, sampleField, updateField, type FlowField } from './field';
import { applyFlares, createFlareIO, createFlares, flareCandidates, resetFlares, updateFlares, type Flare } from './flares';
import { bodyTarget, dotCenter, localProgress } from './morph';
import { applyLayout, createParticles, dotCenters, type Particles } from './particles';
import { shapeBlend, type SceneState } from './state';
import { createTilt, updateTilt, type Tilt } from './tilt';

export interface Pointer {
  active: boolean;
  /** World position (z = 0 plane). */
  x: number;
  y: number;
  /** Normalized position on the canvas, [−1, 1], y downward. */
  nx: number;
  ny: number;
  strength: number;
}

export interface Sim {
  cfg: Config;
  particles: Particles;
  layout: Layout;
  field: FlowField;
  flares: Flare[];
  flareShape: 'A' | 'B' | null;
  candidatesA: Int32Array;
  candidatesB: Int32Array;
  dotA: [number, number];
  dotB: [number, number];
  tilt: Tilt;
  pointer: Pointer;
  nActive: number;
  nHigh: number;
  breatheMix: number;
  time: number;
}

function fieldExtent(layout: Layout): number {
  return Math.max(1.6, layout.wordScale + 0.3);
}

export function createSim(shapes: ShapeSet, layout: Layout, nActive: number, reduced: boolean, cfg: Config): Sim {
  const particles = createParticles(shapes, createRng(cfg.seed + 10), cfg);
  applyLayout(particles, layout);
  const centers = dotCenters(particles);
  const sim: Sim = {
    cfg,
    particles,
    layout,
    field: createField(32, fieldExtent(layout)),
    flares: createFlares(cfg.flares.count, cfg.flares.period),
    flareShape: null,
    candidatesA: flareCandidates(particles.kind, particles.targetA, particles.rimA, 'sphere'),
    candidatesB: flareCandidates(particles.kind, particles.targetB, particles.rimB, 'panel'),
    dotA: centers.a,
    dotB: centers.b,
    tilt: createTilt(),
    pointer: { active: false, x: 0, y: 0, nx: 0, ny: 0, strength: 0 },
    nActive: Math.min(nActive, particles.capacity),
    nHigh: Math.min(nActive, particles.capacity),
    breatheMix: 0,
    time: 0,
  };
  for (let i = 0; i < sim.nActive; i++) particles.presence[i] = 1;
  if (reduced) {
    particles.pos.set(particles.targetA);
    particles.lock.fill(1);
  }
  return sim;
}

export function setLayout(sim: Sim, layout: Layout): void {
  sim.layout = layout;
  applyLayout(sim.particles, layout);
  const centers = dotCenters(sim.particles);
  sim.dotA = centers.a;
  sim.dotB = centers.b;
  const extent = fieldExtent(layout);
  if (Math.abs(extent - sim.field.extent) > 1e-3) sim.field = createField(32, extent);
}

export function setActiveCount(sim: Sim, n: number): void {
  sim.nActive = clamp(Math.round(n), 1, sim.particles.capacity);
  sim.nHigh = Math.max(sim.nHigh, sim.nActive);
}

const fieldSample = new Float32Array(4);
const dotSample = new Float32Array(2);
const restTmp = new Float32Array(3);
const io = createFlareIO();

export function stepSim(sim: Sim, state: SceneState, dt: number, reduced: boolean): void {
  const { cfg, layout, particles: P } = sim;
  sim.time += dt;
  const time = sim.time;

  const morphing = state.phase === 'morph';
  const onB = state.phase === 'idleWord';
  const idle = state.phase === 'idleB' || onB;
  const blend = smoothstep(shapeBlend(state));
  const unit = lerp(layout.unitA, layout.unitB, blend);

  sim.breatheMix += ((idle && !reduced ? 1 : 0) - sim.breatheMix) * (1 - Math.exp(-1.8 * dt));
  const breatheAmp = lerp(cfg.breathe.b, cfg.breathe.word, blend) * sim.breatheMix;

  const pointer = sim.pointer;
  pointer.strength += ((pointer.active && !reduced ? 1 : 0) - pointer.strength) * Math.min(1, 4 * dt);
  updateTilt(
    sim.tilt,
    dt,
    time,
    pointer.active,
    pointer.nx,
    pointer.ny,
    { max: lerp(cfg.tilt.b, cfg.tilt.word, blend), stiffness: cfg.tilt.stiffness, damping: cfg.tilt.damping },
    reduced,
  );
  updateField(sim.field, reduced ? 0 : time);

  let flareStrength = 0;
  const flareTarget = onB ? P.targetB : P.targetA;
  const flareRim = onB ? P.rimB : P.rimA;
  const flareUnit = onB ? layout.unitB : layout.unitA;
  if (idle && !reduced) {
    const shape = onB ? 'B' : 'A';
    if (sim.flareShape !== shape) {
      resetFlares(sim.flares);
      sim.flareShape = shape;
    }
    updateFlares(sim.flares, time, onB ? sim.candidatesB : sim.candidatesA, flareTarget, 0.72 * flareUnit, cfg.flares);
    flareStrength = (onB ? cfg.flares.word : 1) * sim.breatheMix;
  }

  const cssPxPerUnit = layout.pxPerUnit / layout.dpr;
  const swirlRadius2 = clamp(70 / cssPxPerUnit, 0.18, 0.4) ** 2;

  const cy = Math.cos(sim.tilt.yaw);
  const sy = Math.sin(sim.tilt.yaw);
  const cp = Math.cos(sim.tilt.pitch);
  const sp = Math.sin(sim.tilt.pitch);
  const cosT = Math.cos(0.065 * time);
  const sinT = Math.sin(0.065 * time);

  const dotQ = morphing ? smoothstep(state.p) : onB ? 1 : 0;
  dotCenter(dotSample, dotQ, sim.dotA[0], sim.dotA[1], sim.dotB[0], sim.dotB[1], cfg.morph.dotArcLift * lerp(layout.unitA, layout.unitB, 0.5));
  const dotSwing = Math.sin(Math.PI * dotQ);
  const sizeShape = lerp(cfg.render.sizeIso, cfg.render.sizeWord, blend);
  const heatShape = lerp(1, cfg.heat.word, blend);
  const pulse = 1 + cfg.heat.pulseAmp * Math.sin(cfg.heat.pulseFreq * time);
  const presenceRate = Math.min(1, 2 * dt);
  const glowRate = 1 - Math.exp(-4 * dt);
  const spring = cfg.spring;

  sim.nHigh = Math.max(sim.nHigh, sim.nActive);
  for (let i = 0; i < sim.nHigh; i++) {
    const i3 = i * 3;
    const kind = P.kind[i];
    const isHalo = kind === KIND_HALO;
    const isDot = P.isDot[i] === 1;

    const presenceTarget = i < sim.nActive ? 1 : 0;
    P.presence[i] = reduced ? presenceTarget : P.presence[i] + (presenceTarget - P.presence[i]) * presenceRate;

    // Rest target for the current state.
    let q: number;
    if (morphing) q = reduced ? (state.p < 0.5 ? 0 : 1) : isDot ? dotQ : localProgress(state.p, P.morphDelay[i], cfg.morph.spread);
    else q = onB ? 1 : 0;

    let rx: number;
    let ry: number;
    let rz: number;
    if (morphing && !reduced && isDot) {
      rx = dotSample[0] + lerp(P.targetA[i3] - sim.dotA[0], P.targetB[i3] - sim.dotB[0], dotQ);
      ry = dotSample[1] + lerp(P.targetA[i3 + 1] - sim.dotA[1], P.targetB[i3 + 1] - sim.dotB[1], dotQ);
      rz = lerp(P.targetA[i3 + 2], P.targetB[i3 + 2], dotQ);
    } else if (morphing && !reduced) {
      bodyTarget(
        restTmp,
        P.targetA[i3],
        P.targetA[i3 + 1],
        P.targetA[i3 + 2],
        P.targetB[i3],
        P.targetB[i3 + 1],
        P.targetB[i3 + 2],
        P.scatterDir[i3],
        P.scatterDir[i3 + 1],
        P.scatterDir[i3 + 2],
        q,
        cfg.morph.scatter * unit,
      );
      rx = restTmp[0];
      ry = restTmp[1];
      rz = restTmp[2];
    } else {
      const src = q >= 0.5 ? P.targetB : P.targetA;
      rx = src[i3];
      ry = src[i3 + 1];
      rz = src[i3 + 2];
    }
    const travel = lerp(P.travelA[i], P.travelB[i], q);
    const edge = lerp(P.edgeA[i], P.edgeB[i], q);

    // Initial formation.
    if (reduced) {
      P.lock[i] = 1;
      P.lockVel[i] = 0;
    } else {
      const lockTarget = state.phase === 'intro' && state.t <= P.introDelay[i] ? 0 : 1;
      P.lockVel[i] += (11 * (lockTarget - P.lock[i]) - 6.8 * P.lockVel[i]) * dt;
      P.lock[i] = clamp(P.lock[i] + P.lockVel[i] * dt, 0, 1);
    }
    const k = smoothstep(P.lock[i]);

    // Breathing.
    const phase = P.phase[i];
    const phase2 = P.phase2[i];
    const c = time * P.speed[i];
    sampleField(sim.field, rx, ry, fieldSample);
    const amount = breatheAmp * k;
    const room = smoothstep(travel / (0.012 * unit));
    const fuzz = reduced ? 0 : P.fuzz[i] * Math.min(1, travel / (0.008 * unit)) * unit;
    let ox = fieldSample[0] * amount * room + fuzz * Math.sin(0.81 * c + 3 * ry + phase);
    let oy = fieldSample[1] * amount * room + fuzz * Math.sin(0.73 * c + 3 * rx + phase2);
    const offset = Math.hypot(ox, oy);
    if (offset > travel) {
      ox *= travel / offset;
      oy *= travel / offset;
    }
    const glow = fieldSample[3] * amount;
    io.x = rx + ox;
    io.y = ry + oy;
    io.z = rz + fieldSample[2] * amount * (0.75 + 0.25 * room) * P.buoyancy[i] + fuzz * Math.cos(0.67 * c + 3 * rx + phase);

    // Flares.
    io.peelX = 0;
    io.peelY = 0;
    io.peelZ = 0;
    io.energy = 0;
    io.release = 0;
    if (flareStrength > 0.001 && (isHalo || edge < 0.085)) {
      const rimFactor = 1 - smoothstep(edge / 0.085);
      applyFlares(io, sim.flares, flareTarget, flareRim, i, isHalo, rimFactor, k, phase, phase2, P.speed[i], flareUnit, flareStrength);
    }
    P.flareGlow[i] = reduced ? 0 : P.flareGlow[i] + (io.energy - P.flareGlow[i]) * glowRate;

    // Final target: from the cloud toward rest, according to lock.
    const wx = P.cloud[i3] * cosT + P.cloud[i3 + 2] * sinT + 0.21 * Math.sin(0.29 * c + phase) + 0.07 * Math.cos(0.43 * c + phase2);
    const wy = P.cloud[i3 + 1] + 0.18 * Math.cos(0.24 * c + phase2) + 0.08 * Math.sin(0.47 * c + phase);
    const wz = P.cloud[i3 + 2] * cosT - P.cloud[i3] * sinT + 0.21 * Math.sin(0.23 * c + phase2);
    const follow = isHalo ? Math.max(k, P.flareGlow[i]) : k;
    const gx = lerp(wx, io.x + io.peelX, follow);
    const gy = lerp(wy, io.y + io.peelY, follow);
    const gz = lerp(wz, io.z + io.peelZ, follow);

    // Spring.
    const loose = morphing && !reduced ? 1 - 0.85 * Math.sin(Math.PI * q) : 1;
    const lk = k * loose;
    let stiffness = lerp(spring.kLoose, isHalo ? lerp(17, 42, io.energy) : spring.kTight, lk) / P.mass[i];
    if (isDot && morphing) stiffness *= 1 - cfg.morph.dotTrailSoftness * P.trail[i] * dotSwing;
    const damping = Math.exp(-lerp(spring.dampLoose, isHalo ? lerp(5.5, 7, io.energy) : spring.dampTight, lk) * dt);
    const wander = reduced ? 0 : lerp(0.075, 0.002 * Math.min(1, travel / (0.008 * unit)), k);
    const px = P.pos[i3];
    const py = P.pos[i3 + 1];
    const pz = P.pos[i3 + 2];
    let ax = (gx - px) * stiffness + Math.sin(2.8 * py + 0.4 * c + phase) * wander;
    let ay = (gy - py) * stiffness + Math.cos(2.6 * pz + 0.38 * c + phase2) * wander;
    let az = (gz - pz) * stiffness + Math.sin(2.7 * px - 0.35 * c + phase) * wander;

    if (pointer.strength > 0.001) {
      const depth = (cfg.camDist - pz) / cfg.camDist;
      const lx = px - pointer.x * depth;
      const ly = py - pointer.y * depth;
      const d2 = lx * lx + ly * ly;
      if (d2 < swirlRadius2) {
        const f = (1 - d2 / swirlRadius2) ** 2 * pointer.strength;
        const h = (f * lerp(1, 0.16 * Math.min(1, travel / (0.008 * unit)), k)) / Math.sqrt(d2 + 0.008);
        ax += (lx - 0.4 * ly) * h;
        ay += (ly + 0.4 * lx) * h;
        az -= 0.04 * f;
      }
    }

    if (reduced) {
      P.pos[i3] = gx;
      P.pos[i3 + 1] = gy;
      P.pos[i3 + 2] = gz;
      P.vel[i3] = 0;
      P.vel[i3 + 1] = 0;
      P.vel[i3 + 2] = 0;
    } else {
      P.vel[i3] = (P.vel[i3] + ax * dt) * damping;
      P.vel[i3 + 1] = (P.vel[i3 + 1] + ay * dt) * damping;
      P.vel[i3 + 2] = (P.vel[i3 + 2] + az * dt) * damping;
      P.pos[i3] = px + P.vel[i3] * dt;
      P.pos[i3 + 1] = py + P.vel[i3 + 1] * dt;
      P.pos[i3 + 2] = pz + P.vel[i3 + 2] * dt;
    }

    // Heat.
    const nx = lerp(P.normalA[i3], P.normalB[i3], q);
    const ny = lerp(P.normalA[i3 + 1], P.normalB[i3 + 1], q);
    const nz = lerp(P.normalA[i3 + 2], P.normalB[i3 + 2], q);
    const rnx = nx * cy + nz * sy;
    const rnz = nz * cy - nx * sy;
    const rny = ny * cp - rnz * sp;
    const facing = ny * sp + rnz * cp;
    const light = Math.max(0, -0.35 * rnx + 0.48 * rny + 0.8 * facing);
    let bright = 0.16 + 0.27 * Math.max(0, facing) + 0.57 * light + 0.04 * (1 - smoothstep(edge / 0.031));
    // The dot glows on its own: it depends little on lighting.
    if (isDot) bright += (1 - bright) * cfg.heat.dotEmissive;
    if (kind === KIND_VOLUME) bright *= 0.4;
    else if (kind === KIND_RIM) bright *= 0.9;
    else if (isHalo) bright = 0.8 * bright * Math.exp(-lerp(P.haloA[i], P.haloB[i], q) / 0.24) + 0.85 * P.flareGlow[i];

    const depth01 = clamp((P.pos[i3 + 2] + 1.6) / 3.2, 0, 1);
    const flicker = reduced ? 0.84 : 0.85 + 0.04 * Math.sin(1.1 * c + phase) + 0.02 * Math.sin(2.1 * c + phase2);
    let heat = 1.6 * P.presence[i] * P.lum[i] * lerp(0.43, bright, k) * flicker * (1 + glow) * (0.53 + 0.68 * depth01) * (1 - 0.18 * io.release);
    if (isDot) heat *= cfg.heat.dotBoost * pulse;
    else heat *= heatShape;
    P.heat[i] = Math.max(0, heat);
    P.radius[i] = cfg.render.particleRadius * P.size[i] * sizeShape * (0.89 + 0.19 * depth01) * (1 + 0.24 * P.flareGlow[i]);
  }

  while (sim.nHigh > sim.nActive && P.presence[sim.nHigh - 1] < 0.005) sim.nHigh--;
}

/** Writes the visible instances as [x, y, z, radius, heat] and returns how many there are. */
export function writeInstances(sim: Sim, out: Float32Array): number {
  const P = sim.particles;
  let n = 0;
  for (let i = 0; i < sim.nHigh; i++) {
    if (P.heat[i] < 0.002) continue;
    const o = n * 5;
    out[o] = P.pos[i * 3];
    out[o + 1] = P.pos[i * 3 + 1];
    out[o + 2] = P.pos[i * 3 + 2];
    out[o + 3] = P.radius[i];
    out[o + 4] = P.heat[i];
    n++;
  }
  return n;
}
