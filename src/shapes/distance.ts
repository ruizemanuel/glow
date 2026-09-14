const DIAGONAL = Math.SQRT2;

/**
 * Transformada de distancia chamfer (costos 1 y √2) en dos pasadas.
 * Devuelve, para cada píxel interior (mask = 1), la distancia al píxel exterior más cercano.
 * Los píxeles exteriores valen 0 y todo lo que está fuera del lienzo cuenta como exterior.
 */
export function chamferDistance(mask: Uint8Array, width: number, height: number): Float32Array {
  const d = new Float32Array(width * height);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? 1e9 : 0;

  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= width || y >= height ? 0 : d[y * width + x];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (d[i] === 0) continue;
      d[i] = Math.min(
        d[i],
        at(x - 1, y) + 1,
        at(x, y - 1) + 1,
        at(x - 1, y - 1) + DIAGONAL,
        at(x + 1, y - 1) + DIAGONAL,
      );
    }
  }

  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (d[i] === 0) continue;
      d[i] = Math.min(
        d[i],
        at(x + 1, y) + 1,
        at(x, y + 1) + 1,
        at(x + 1, y + 1) + DIAGONAL,
        at(x - 1, y + 1) + DIAGONAL,
      );
    }
  }

  return d;
}
