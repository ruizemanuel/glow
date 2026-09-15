// All tunable parameters of the experiment.

export const CONFIG = {
  seed: 73031,

  particles: {
    nMax: 24000,
    capDesktop: 24000,
    capMobile: 12000,
    minDesktop: 8000,
    minMobile: 5000,
    mobileBreakpoint: 640,
    dotFraction: 0.08,
  },

  kinds: { surface: 0.65, volume: 0.2, rim: 0.03, halo: 0.12 },

  shapes: {
    rasterSize: 1024,
    rasterMargin: 8,
    /** Mean and max of the halo offset, in SVG units. */
    haloMeanSvg: 0.49,
    haloMaxSvg: 3.4,
    isoDotGap: 0.93,
    sphereMargin: 0.008,
    panelCurve: 0.18,
    panelThickness: 0.04,
  },

  camDist: 6.3,

  layout: {
    isoFraction: 0.55,
    wordWidthFraction: 0.88,
    wordHeightFraction: 0.4,
    centerY: 0.47,
  },

  timing: { intro: 3.5, morph: 3.0, morphReduced: 0.6 },

  morph: { spread: 0.6, scatter: 0.35, dotArcLift: 0.25, dotTrailSoftness: 0.6 },

  spring: { kLoose: 5.2, kTight: 46, dampLoose: 3.15, dampTight: 8.8 },

  breathe: { b: 1.0, word: 0.45 },

  flares: { count: 5, period: 4.8, active: 3.65, rise: 0.32, fall: 0.4, word: 0.5 },

  tilt: { b: 0.13, word: 0.05, stiffness: 24, damping: 7.5 },

  heat: { dotBoost: 2.6, dotEmissive: 0.75, pulseAmp: 0.12, pulseFreq: 1.3, word: 2.4 },

  render: {
    maxDpr: 2,
    /** Base radius of a particle, in world units. */
    particleRadius: 0.012,
    sizeIso: 1.0,
    sizeWord: 0.85,
    minRadiusPx: 0.75,
    bloomStrength: 0.9,
    exposure: 1.2,
    grain: 0.015,
  },

  perf: { interval: 2, slowMs: 20, fastMs: 15, decrease: 0.1, increase: 0.05 },
};

export type Config = typeof CONFIG;
