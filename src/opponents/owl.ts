import type { Analyser } from '../engine/analyser';
import type { Random } from '../core/random';
import { createEngineOpponent } from './engine-opponent';
import type { Opponent } from './opponent';

/** Wise Owl: low club level. The engine's best move from a short, fixed-depth search; no deliberate mistakes. */
export function createOwl(analyser: Analyser, random: Random = Math.random): Opponent {
  return createEngineOpponent({ id: 'owl', name: 'Wise Owl', search: { depth: 5 }, mistakeRate: 0 }, analyser, random);
}
