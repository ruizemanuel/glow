import type { Mask, RasterFn } from './build';

/** Browser rasterizer: draws the paths with Path2D and thresholds alpha at 128. */
export const rasterizePaths: RasterFn = (parts, frame, size, margin) => {
  const frameW = frame.x1 - frame.x0;
  const frameH = frame.y1 - frame.y0;
  const pxPerUnit = (size - 2 * margin) / Math.max(frameW, frameH);
  const width = Math.ceil(frameW * pxPerUnit) + 2 * margin;
  const height = Math.ceil(frameH * pxPerUnit) + 2 * margin;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is unavailable for shape rasterization.');

  ctx.fillStyle = '#fff';
  for (const part of parts) {
    ctx.setTransform(pxPerUnit, 0, 0, pxPerUnit, margin + (part.dx - frame.x0) * pxPerUnit, margin + (part.dy - frame.y0) * pxPerUnit);
    ctx.fill(new Path2D(part.d));
  }

  const rgba = ctx.getImageData(0, 0, width, height).data;
  const data = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4 + 3] >= 128 ? 1 : 0;

  const mask: Mask = { width, height, data, pxPerUnit, margin };
  return mask;
};
