import { describe, expect, it } from 'vitest';
import { resolveColour } from './colour';
import { seededRandom } from './random';

describe('Colour choice', () => {
  it('white and black are kept as chosen', () => {
    expect(resolveColour('white', () => 0.99)).toBe('white');
    expect(resolveColour('black', () => 0)).toBe('black');
  });

  it('🎲 picks white or black from the random source', () => {
    expect(resolveColour('random', () => 0.1)).toBe('white');
    expect(resolveColour('random', () => 0.9)).toBe('black');
  });

  it('🎲 gives both colours over several games', () => {
    const random = seededRandom(5);
    const colours = new Set(Array.from({ length: 20 }, () => resolveColour('random', random)));
    expect(colours).toEqual(new Set(['white', 'black']));
  });
});
