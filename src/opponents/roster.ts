import type { Random } from '../core/random';
import type { Analyser } from '../engine/analyser';
import { sharedStockfish } from '../engine/stockfish-analyser';
import { createCat } from './cat';
import { createDragon } from './dragon';
import type { Opponent } from './opponent';
import { createOwl } from './owl';
import { createPig } from './pig';
import { createPuppy } from './puppy';
import { createSnail } from './snail';

/** What an Opponent may be made with. Tests pass a seeded `random` and a fake `analyser`. */
export interface OpponentTools {
  random?: Random;
  /** For engine-backed Opponents. Defaults to the app's shared Stockfish. */
  analyser?: Analyser;
}

/**
 * An Opponent the child can pick. `create` makes a fresh Opponent for one game. Its strength is fixed
 * by the character: nothing about past results is passed in, so it never adapts.
 */
export interface OpponentCharacter {
  id: string;
  /** Spoken when tapped on the Opponent picker. */
  name: string;
  /**
   * Its fixed place on the ladder, 1 (Sleepy Snail) to 6 (Dragon), whether or not the Opponents in
   * between exist yet. Sets the Points for beating it, so adding an Opponent never changes another's.
   */
  strength: number;
  create(tools?: OpponentTools): Opponent;
}

/** Every Opponent on the picker, weakest first. New Opponents are added here. */
export const OPPONENTS: readonly OpponentCharacter[] = [
  { id: 'snail', name: 'Sleepy Snail', strength: 1, create: ({ random } = {}) => createSnail(random) },
  { id: 'pig', name: 'Greedy Pig', strength: 2, create: ({ random } = {}) => createPig(random) },
  { id: 'puppy', name: 'Silly Puppy', strength: 3, create: ({ random, analyser } = {}) => createPuppy(analyser ?? sharedStockfish(), random) },
  { id: 'cat', name: 'Clever Cat', strength: 4, create: ({ random, analyser } = {}) => createCat(analyser ?? sharedStockfish(), random) },
  { id: 'owl', name: 'Wise Owl', strength: 5, create: ({ random, analyser } = {}) => createOwl(analyser ?? sharedStockfish(), random) },
  { id: 'dragon', name: 'Dragon', strength: 6, create: ({ random, analyser } = {}) => createDragon(analyser ?? sharedStockfish(), random) },
];

export function opponentById(id: string): OpponentCharacter | undefined {
  return OPPONENTS.find((o) => o.id === id);
}
