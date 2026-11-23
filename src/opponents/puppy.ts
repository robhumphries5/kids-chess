import type { Analyser } from '../engine/analyser';
import type { Random } from '../core/random';
import { createEngineOpponent } from './engine-opponent';
import type { Opponent } from './opponent';

/** Silly Puppy: a decent move most of the time, but a big mistake about one move in three. */
export function createPuppy(analyser: Analyser, random: Random = Math.random): Opponent {
  return createEngineOpponent({ id: 'puppy', name: 'Silly Puppy', search: { depth: 4 }, mistakeRate: 1 / 3 }, analyser, random);
}
