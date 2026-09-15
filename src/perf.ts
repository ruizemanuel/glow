export interface PerfParams {
  interval: number;
  slowMs: number;
  fastMs: number;
  decrease: number;
  increase: number;
}

export interface Perf {
  /** Displayed FPS (average of the last second), or null if no data yet. */
  fps: number | null;
  frameEma: number;
  sinceAdapt: number;
  fpsFrames: number;
  fpsTime: number;
  nActive: number;
}

export function createPerf(nActive: number): Perf {
  return { fps: null, frameEma: 16.67, sinceAdapt: 0, fpsFrames: 0, fpsTime: 0, nActive };
}

/** Records the interval between frames. Returns true when `fps` was updated. */
export function recordFrame(p: Perf, frameMs: number): boolean {
  p.frameEma += 0.05 * (frameMs - p.frameEma);
  p.fpsFrames++;
  p.fpsTime += frameMs;
  if (p.fpsTime < 1000) return false;
  p.fps = Math.round((1000 * p.fpsFrames) / p.fpsTime);
  p.fpsFrames = 0;
  p.fpsTime = 0;
  return true;
}

/** Every `interval` seconds, adjusts the active count based on frame time. Returns true if it changed. */
export function adaptCount(p: Perf, dtSec: number, nMin: number, nCap: number, params: PerfParams): boolean {
  p.sinceAdapt += dtSec;
  const before = p.nActive;
  if (p.nActive > nCap) p.nActive = nCap;
  if (p.sinceAdapt >= params.interval) {
    p.sinceAdapt = 0;
    if (p.frameEma > params.slowMs) p.nActive = Math.max(nMin, Math.round(p.nActive * (1 - params.decrease)));
    else if (p.frameEma < params.fastMs) p.nActive = Math.min(nCap, Math.round(p.nActive * (1 + params.increase)));
  }
  return p.nActive !== before;
}
