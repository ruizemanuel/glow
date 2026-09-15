/** Color ramp for mapped heat (h' ∈ [0, 1]). */
export const RAMP_STOPS: ReadonlyArray<readonly [number, string]> = [
  [0.0, '#000000'],
  [0.18, '#3c0800'],
  [0.45, '#ff4d00'],
  [0.78, '#ffb347'],
  [1.0, '#fff4e0'],
];

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

/** Evaluates the ramp in TypeScript (an exact mirror of the generated GLSL). */
export function rampColor(h: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, h));
  for (let i = 1; i < RAMP_STOPS.length; i++) {
    const [t1, c1] = RAMP_STOPS[i];
    if (x <= t1) {
      const [t0, c0] = RAMP_STOPS[i - 1];
      const a = hexToRgb(c0);
      const b = hexToRgb(c1);
      const u = (x - t0) / (t1 - t0);
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    }
  }
  return hexToRgb(RAMP_STOPS[RAMP_STOPS.length - 1][1]);
}

const f = (v: number) => v.toFixed(5);

/** Generates the GLSL function `vec3 ramp(float x)` from RAMP_STOPS. */
export function rampGlsl(): string {
  const lines = ['vec3 ramp(float x) {', '  x = clamp(x, 0.0, 1.0);'];
  for (let i = 1; i < RAMP_STOPS.length; i++) {
    const [t0, c0] = RAMP_STOPS[i - 1];
    const [t1, c1] = RAMP_STOPS[i];
    const a = hexToRgb(c0).map(f).join(', ');
    const b = hexToRgb(c1).map(f).join(', ');
    lines.push(`  if (x <= ${f(t1)}) return mix(vec3(${a}), vec3(${b}), (x - ${f(t0)}) / ${f(t1 - t0)});`);
  }
  const last = hexToRgb(RAMP_STOPS[RAMP_STOPS.length - 1][1]).map(f).join(', ');
  lines.push(`  return vec3(${last});`, '}');
  return lines.join('\n');
}
