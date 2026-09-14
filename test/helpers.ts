import type { Mask, RasterFn } from '../src/shapes/build';

/** Máscara con un rectángulo interior [x0, x1) × [y0, y1). */
export function rectMask(width: number, height: number, x0: number, y0: number, x1: number, y1: number): Uint8Array {
  const m = new Uint8Array(width * height);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * width + x] = 1;
  return m;
}

/** Rasterizador falso para Node: rellena el bounding box de cada trazo. */
export const bboxRaster: RasterFn = (parts, frame, size, margin) => {
  const frameW = frame.x1 - frame.x0;
  const frameH = frame.y1 - frame.y0;
  const pxPerUnit = (size - 2 * margin) / Math.max(frameW, frameH);
  const width = Math.ceil(frameW * pxPerUnit) + 2 * margin;
  const height = Math.ceil(frameH * pxPerUnit) + 2 * margin;
  const data = new Uint8Array(width * height);
  for (const part of parts) {
    const x0 = Math.floor(margin + (part.bbox.x0 - frame.x0) * pxPerUnit);
    const x1 = Math.ceil(margin + (part.bbox.x1 - frame.x0) * pxPerUnit);
    const y0 = Math.floor(margin + (part.bbox.y0 - frame.y0) * pxPerUnit);
    const y1 = Math.ceil(margin + (part.bbox.y1 - frame.y0) * pxPerUnit);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data[y * width + x] = 1;
  }
  const mask: Mask = { width, height, data, pxPerUnit, margin };
  return mask;
};
