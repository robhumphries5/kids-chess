import type { Random } from '../core/random';
import type { Opponent } from './opponent';
import { createPig } from './pig';
import { createSnail } from './snail';

/**
 * An Opponent the child can pick. `create` makes a fresh Opponent for one game. Its strength is fixed
 * by the character: nothing about past results is passed in, so it never adapts.
 */
export interface OpponentCharacter {
  id: string;
  /** Spoken when tapped on the Opponent picker. */
  name: string;
  create(random?: Random): Opponent;
}

/** Every Opponent on the picker, weakest first. New Opponents are added here. */
export const OPPONENTS: readonly OpponentCharacter[] = [
  { id: 'snail', name: 'Sleepy Snail', create: createSnail },
  { id: 'pig', name: 'Greedy Pig', create: createPig },
];

export function opponentById(id: string): OpponentCharacter | undefined {
  return OPPONENTS.find((o) => o.id === id);
}
