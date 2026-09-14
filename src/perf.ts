export interface PerfParams {
  interval: number;
  slowMs: number;
  fastMs: number;
  decrease: number;
  increase: number;
}

export interface Perf {
  /** FPS mostrado (promedio del último segundo), o null si todavía no hay dato. */
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

/** Registra el intervalo entre frames. Devuelve true cuando se actualizó `fps`. */
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

/** Cada `interval` segundos ajusta la cantidad activa según el tiempo de frame. Devuelve true si cambió. */
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
