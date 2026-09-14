/** Máscara con un rectángulo interior [x0, x1) × [y0, y1). */
export function rectMask(width: number, height: number, x0: number, y0: number, x1: number, y1: number): Uint8Array {
  const m = new Uint8Array(width * height);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * width + x] = 1;
  return m;
}
