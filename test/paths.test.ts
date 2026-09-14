import { describe, expect, it } from 'vitest';
import { B_GLYPH, DOT, isoComposition, WORD_BODY, wordComposition } from '../src/shapes/paths';

const subpaths = (d: string) => d.match(/M/g)?.length ?? 0;

describe('paths', () => {
  it('tiene la cantidad esperada de subtrazos', () => {
    expect(subpaths(B_GLYPH)).toBe(2);
    expect(subpaths(WORD_BODY)).toBe(12);
    expect(subpaths(DOT)).toBe(1);
  });

  it('arma el isotipo con el punto a la derecha de la b', () => {
    const iso = isoComposition(0.6);
    expect(iso.dot[0].bbox.x0).toBeCloseTo(11.918, 3);
    expect(iso.frame.x1).toBeCloseTo(15.091, 3);
    expect(iso.dot[0].bbox.y1).toBeCloseTo(14.765, 3);
  });

  it('deja el punto del wordmark en su lugar', () => {
    const word = wordComposition();
    expect(word.dot[0].dx).toBe(0);
    expect(word.frame.x1).toBe(107);
  });
});
