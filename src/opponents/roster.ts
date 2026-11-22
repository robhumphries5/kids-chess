import type { Random } from '../core/random';
import type { Analyser } from '../engine/analyser';
import { sharedStockfish } from '../engine/stockfish-analyser';
import { createDragon } from './dragon';
import type { Opponent } from './opponent';
import { createPig } from './pig';
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
  create(tools?: OpponentTools): Opponent;
}

/** Every Opponent on the picker, weakest first. New Opponents are added here. */
export const OPPONENTS: readonly OpponentCharacter[] = [
  { id: 'snail', name: 'Sleepy Snail', create: ({ random } = {}) => createSnail(random) },
  { id: 'pig', name: 'Greedy Pig', create: ({ random } = {}) => createPig(random) },
  { id: 'dragon', name: 'Dragon', create: ({ random, analyser } = {}) => createDragon(analyser ?? sharedStockfish(), random) },
];

export function opponentById(id: string): OpponentCharacter | undefined {
  return OPPONENTS.find((o) => o.id === id);
}
