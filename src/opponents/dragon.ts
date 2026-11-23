import type { Analyser } from '../engine/analyser';
import type { Random } from '../core/random';
import { createEngineOpponent } from './engine-opponent';
import type { Opponent } from './opponent';

/** Dragon's search: long and deep enough to be a real challenge for a grown-up. */
const DRAGON_SEARCH = { timeMs: 1500, depth: 18 } as const;

/** Dragon: the strongest Opponent. Plays the engine's best move after a full search, every move. */
export function createDragon(analyser: Analyser, random: Random = Math.random): Opponent {
  return createEngineOpponent({ id: 'dragon', name: 'Dragon', search: DRAGON_SEARCH, mistakeRate: 0 }, analyser, random);
}
