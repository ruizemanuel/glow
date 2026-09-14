import type { Config } from './config';

export interface Layout {
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  /** Tamaño del lienzo en píxeles de dispositivo. */
  width: number;
  height: number;
  /** Píxeles de dispositivo por unidad de mundo. */
  pxPerUnit: number;
  centerX: number;
  centerY: number;
  /** Escala mundo del wordmark (el isotipo tiene escala 1). */
  wordScale: number;
  /** Unidades de mundo por "unidad iso" en cada forma. */
  unitA: number;
  unitB: number;
  mobile: boolean;
}

export interface LayoutShapes {
  /** Semialto del wordmark en espacio normalizado (y ∈ [−h, h]). */
  wordHalfHeight: number;
  isoHalfSvg: number;
  wordHalfSvg: number;
}

export function computeLayout(cssWidth: number, cssHeight: number, devicePixelRatio: number, shapes: LayoutShapes, cfg: Config): Layout {
  const dpr = Math.min(Math.max(devicePixelRatio, 1), cfg.render.maxDpr);
  const width = Math.max(1, Math.round(cssWidth * dpr));
  const height = Math.max(1, Math.round(cssHeight * dpr));
  const pxPerUnit = (cfg.layout.isoFraction * Math.min(width, height)) / 2;
  const byWidth = (cfg.layout.wordWidthFraction * width) / 2 / pxPerUnit;
  const byHeight = (cfg.layout.wordHeightFraction * height) / (2 * shapes.wordHalfHeight) / pxPerUnit;
  const wordScale = Math.min(byWidth, byHeight);
  return {
    cssWidth,
    cssHeight,
    dpr,
    width,
    height,
    pxPerUnit,
    centerX: width / 2,
    centerY: height * cfg.layout.centerY,
    wordScale,
    unitA: 1,
    unitB: (wordScale * shapes.isoHalfSvg) / shapes.wordHalfSvg,
    mobile: cssWidth < cfg.particles.mobileBreakpoint,
  };
}

/**
 * Rotación de inclinación: primero yaw (eje Y), después pitch (eje X).
 * x' = x·cos(yaw) + z·sin(yaw); z' = z·cos(yaw) − x·sin(yaw); y'' = y·cos(pitch) − z'·sin(pitch); z'' = y·sin(pitch) + z'·cos(pitch)
 */
export function rotate(yaw: number, pitch: number, x: number, y: number, z: number, out: Float32Array | number[]): void {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const u = Math.cos(pitch);
  const l = Math.sin(pitch);
  const x1 = x * c + z * s;
  const z1 = z * c - x * s;
  out[0] = x1;
  out[1] = y * u - z1 * l;
  out[2] = y * l + z1 * u;
}

/** La misma rotación que `rotate`, como mat3 en orden por columnas para GLSL. */
export function tiltMatrix(yaw: number, pitch: number): Float32Array {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const u = Math.cos(pitch);
  const l = Math.sin(pitch);
  return Float32Array.from([c, l * s, -u * s, 0, u, l, s, -l * c, u * c]);
}

/** Proyección de un punto ya rotado a píxeles de dispositivo (y hacia abajo). */
export function projectToScreen(layout: Layout, camDist: number, x: number, y: number, z: number): [number, number] {
  const s = camDist / Math.max(1.6, camDist - z);
  return [layout.centerX + x * s * layout.pxPerUnit, layout.centerY - y * s * layout.pxPerUnit];
}

/** Punto del puntero (px CSS) a coordenadas de mundo en el plano z = 0. */
export function screenToWorld(layout: Layout, cssX: number, cssY: number): [number, number] {
  return [(cssX * layout.dpr - layout.centerX) / layout.pxPerUnit, (layout.centerY - cssY * layout.dpr) / layout.pxPerUnit];
}
