import type { Analyser } from '../engine/analyser';
import type { Random } from '../core/random';
import { createEngineOpponent } from './engine-opponent';
import type { Opponent } from './opponent';

/** Clever Cat: the engine at its weakest (a one-ply search), plus a big mistake about one move in eight. */
export function createCat(analyser: Analyser, random: Random = Math.random): Opponent {
  return createEngineOpponent({ id: 'cat', name: 'Clever Cat', search: { depth: 1 }, mistakeRate: 1 / 8 }, analyser, random);
}
