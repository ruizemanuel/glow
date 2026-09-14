/** Orden por columnas: por x, en k columnas de igual cantidad, y dentro de cada una de arriba (y mayor) hacia abajo. */
function columnOrder(x: ArrayLike<number>, y: ArrayLike<number>, k: number): Int32Array {
  const n = x.length;
  const byX = Array.from({ length: n }, (_, i) => i).sort((a, b) => x[a] - x[b] || a - b);
  const out = new Int32Array(n);
  for (let c = 0; c < k; c++) {
    const start = Math.floor((c * n) / k);
    const end = Math.floor(((c + 1) * n) / k);
    const column = byX.slice(start, end).sort((a, b) => y[b] - y[a] || a - b);
    out.set(column, start);
  }
  return out;
}

/**
 * Empareja dos conjuntos de puntos del mismo tamaño preservando la vecindad aproximada.
 * Devuelve `match` con match[i] = índice en B del compañero del punto i de A.
 */
export function pairByColumns(ax: ArrayLike<number>, ay: ArrayLike<number>, bx: ArrayLike<number>, by: ArrayLike<number>): Int32Array {
  const n = ax.length;
  if (ay.length !== n || bx.length !== n || by.length !== n) {
    throw new Error(`pairByColumns needs equal-sized sets (got ${n} and ${bx.length}).`);
  }
  const k = Math.max(1, Math.round(Math.sqrt(n)));
  const orderA = columnOrder(ax, ay, k);
  const orderB = columnOrder(bx, by, k);
  const match = new Int32Array(n);
  for (let j = 0; j < n; j++) match[orderA[j]] = orderB[j];
  return match;
}
