import type { Config } from '../config';
import { createRng } from '../rng';
import { chamferDistance } from './distance';
import { embed, sphereRadiusFor, type Embedded, type ShapePoints } from './embed';
import { isoComposition, wordComposition, type BBox, type Composition, type PathPart } from './paths';
import { KIND_RIM, sampleShape, type Sample2D } from './sample';

export interface Mask {
  width: number;
  height: number;
  /** 1 = interior. */
  data: Uint8Array;
  /** Pixels per SVG unit. */
  pxPerUnit: number;
  margin: number;
}

/** Draws the paths into a mask whose frame is `frame`: px = margin + (X − frame.x0) · pxPerUnit. */
export type RasterFn = (parts: PathPart[], frame: BBox, size: number, margin: number) => Mask;

export interface ShapeGroup {
  points: ShapePoints;
  embedded: Embedded;
}

export interface ShapeSet {
  iso: { body: ShapeGroup; dot: ShapeGroup };
  word: { body: ShapeGroup; dot: ShapeGroup };
  sphereRadius: number;
  /** Half-side of the isotype in SVG units: defines the "iso unit". */
  isoHalfSvg: number;
  /** Half-width of the wordmark in SVG units. */
  wordHalfSvg: number;
  /** Half-height of the wordmark in normalized space. */
  wordHalfHeight: number;
}

function toShapeSpace(s: Sample2D, mask: Mask, frame: BBox, halfSvg: number, isoHalfSvg: number): ShapePoints {
  const n = s.count;
  const cx = (frame.x0 + frame.x1) / 2;
  const cy = (frame.y0 + frame.y1) / 2;
  const pxPerShape = mask.pxPerUnit * halfSvg;
  const p: ShapePoints = {
    count: n,
    x: new Float32Array(n),
    y: new Float32Array(n),
    ox: new Float32Array(n),
    oy: new Float32Array(n),
    oz: new Float32Array(n),
    nx: new Float32Array(n),
    ny: new Float32Array(n),
    edge: new Float32Array(n),
    depth: s.depth,
    kind: s.kind,
  };
  for (let i = 0; i < n; i++) {
    const X = frame.x0 + (s.x[i] - mask.margin) / mask.pxPerUnit;
    const Y = frame.y0 + (s.y[i] - mask.margin) / mask.pxPerUnit;
    p.x[i] = (X - cx) / halfSvg;
    p.y[i] = (cy - Y) / halfSvg;
    p.ox[i] = s.ox[i] / pxPerShape;
    p.oy[i] = -s.oy[i] / pxPerShape;
    p.oz[i] = s.oz[i] / pxPerShape;
    p.nx[i] = s.nx[i];
    p.ny[i] = -s.ny[i];
    p.edge[i] = s.edge[i] / mask.pxPerUnit / isoHalfSvg;
  }
  return p;
}

function samplePart(
  raster: RasterFn,
  parts: PathPart[],
  comp: Composition,
  n: number,
  halfSvg: number,
  isoHalfSvg: number,
  seed: number,
  cfg: Config,
): ShapePoints {
  const mask = raster(parts, comp.frame, cfg.shapes.rasterSize, cfg.shapes.rasterMargin);
  const dist = chamferDistance(mask.data, mask.width, mask.height);
  const halo = { meanPx: cfg.shapes.haloMeanSvg * mask.pxPerUnit, maxPx: cfg.shapes.haloMaxSvg * mask.pxPerUnit };
  const s = sampleShape(mask.data, dist, mask.width, mask.height, n, cfg.kinds, halo, createRng(seed));
  return toShapeSpace(s, mask, comp.frame, halfSvg, isoHalfSvg);
}

function maxRimRadius(groups: ShapePoints[]): number {
  let r = 0;
  for (const g of groups) {
    for (let i = 0; i < g.count; i++) {
      if (g.kind[i] === KIND_RIM) r = Math.max(r, Math.hypot(g.x[i], g.y[i]));
    }
  }
  return r;
}

export function buildShapes(raster: RasterFn, nMax: number, cfg: Config): ShapeSet {
  const dotCount = Math.round(nMax * cfg.particles.dotFraction);
  const bodyCount = nMax - dotCount;

  const iso = isoComposition(cfg.shapes.isoDotGap);
  const word = wordComposition();
  const isoHalfSvg = Math.max(iso.frame.x1 - iso.frame.x0, iso.frame.y1 - iso.frame.y0) / 2;
  const wordHalfSvg = (word.frame.x1 - word.frame.x0) / 2;

  const isoBody = samplePart(raster, iso.body, iso, bodyCount, isoHalfSvg, isoHalfSvg, cfg.seed + 1, cfg);
  const isoDot = samplePart(raster, iso.dot, iso, dotCount, isoHalfSvg, isoHalfSvg, cfg.seed + 2, cfg);
  const wordBody = samplePart(raster, word.body, word, bodyCount, wordHalfSvg, isoHalfSvg, cfg.seed + 3, cfg);
  const wordDot = samplePart(raster, word.dot, word, dotCount, wordHalfSvg, isoHalfSvg, cfg.seed + 4, cfg);

  const sphereRadius = sphereRadiusFor(maxRimRadius([isoBody, isoDot]), cfg.shapes.sphereMargin, cfg.camDist);
  const sphere = { type: 'sphere', radius: sphereRadius, camDist: cfg.camDist } as const;
  const panel = { type: 'panel', curve: cfg.shapes.panelCurve, thickness: cfg.shapes.panelThickness } as const;

  return {
    iso: {
      body: { points: isoBody, embedded: embed(isoBody, sphere) },
      dot: { points: isoDot, embedded: embed(isoDot, sphere) },
    },
    word: {
      body: { points: wordBody, embedded: embed(wordBody, panel) },
      dot: { points: wordDot, embedded: embed(wordDot, panel) },
    },
    sphereRadius,
    isoHalfSvg,
    wordHalfSvg,
    wordHalfHeight: (word.frame.y1 - word.frame.y0) / 2 / wordHalfSvg,
  };
}
