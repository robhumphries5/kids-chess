// The Puzzle Ladder's themes, easiest first. Each new theme joins this list as its ticket lands.
import { pickOne, type Random } from '../random';
import { FREE_PIECE_THEME, generateFreePiecePuzzle } from './free-piece';
import { generateMateInOnePuzzle, MATE_IN_ONE_THEME } from './mate-in-one';
import type { Puzzle } from './puzzle';

export interface PuzzleTheme {
  id: string;
  generate(random: Random): Puzzle;
}

export const PUZZLE_THEMES: readonly PuzzleTheme[] = [
  { id: FREE_PIECE_THEME, generate: generateFreePiecePuzzle },
  { id: MATE_IN_ONE_THEME, generate: generateMateInOnePuzzle },
];

/** A puzzle from any theme, picked at random. Stands in until the Puzzle Ladder level picks the theme. */
export function randomThemePuzzle(random: Random): Puzzle {
  return pickOne(PUZZLE_THEMES, random).generate(random);
}
