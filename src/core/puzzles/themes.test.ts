import { describe, expect, it } from 'vitest';
import { seededRandom } from '../random';
import { PUZZLE_THEMES, randomThemePuzzle } from './themes';

describe('Puzzle themes', () => {
  it('are listed in Puzzle Ladder order', () => {
    expect(PUZZLE_THEMES.map((t) => t.id)).toEqual(['take-the-free-piece', 'checkmate-in-one']);
  });

  it('each makes puzzles of its own theme', () => {
    for (const theme of PUZZLE_THEMES) {
      expect(theme.generate(seededRandom(1)).theme).toBe(theme.id);
    }
  });

  it('until the Puzzle Ladder decides, puzzles come from every theme', () => {
    const random = seededRandom(5);
    const seen = new Set(Array.from({ length: 30 }, () => randomThemePuzzle(random).theme));
    expect([...seen].sort()).toEqual(PUZZLE_THEMES.map((t) => t.id).sort());
  });
});
