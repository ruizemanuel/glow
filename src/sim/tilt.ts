import { valueNoise3 } from './field';

export interface Tilt {
  yaw: number;
  pitch: number;
  vYaw: number;
  vPitch: number;
}

export function createTilt(): Tilt {
  return { yaw: 0, pitch: 0, vYaw: 0, vPitch: 0 };
}

export interface TiltParams {
  max: number;
  stiffness: number;
  damping: number;
}

/**
 * Spring-driven tilt toward slow noise plus the pointer position.
 * pointerNx, pointerNy ∈ [−1, 1] (y downward). `max` scales everything relative to the reference max of 0.13 rad.
 */
export function updateTilt(
  t: Tilt,
  dt: number,
  time: number,
  pointerActive: boolean,
  pointerNx: number,
  pointerNy: number,
  params: TiltParams,
  reduced: boolean,
): void {
  if (reduced) {
    t.yaw = 0;
    t.pitch = 0;
    t.vYaw = 0;
    t.vPitch = 0;
    return;
  }
  const k = params.max / 0.13;
  const targetYaw = (0.085 * valueNoise3(0.12 * time, 11, 3) + (pointerActive ? 0.13 * pointerNx : 0)) * k;
  const targetPitch = (0.035 * valueNoise3(17, 0.14 * time, 3) + (pointerActive ? 0.06 * pointerNy : 0)) * k;
  const decay = Math.exp(-params.damping * dt);
  t.vYaw = (t.vYaw + params.stiffness * (targetYaw - t.yaw) * dt) * decay;
  t.vPitch = (t.vPitch + params.stiffness * (targetPitch - t.pitch) * dt) * decay;
  t.yaw += t.vYaw * dt;
  t.pitch += t.vPitch * dt;
}
