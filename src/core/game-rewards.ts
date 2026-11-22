// What a finished game against an Opponent earns. Every game earns something; nothing is taken away.
import type { GameResult } from './session';

const WIN_BASE = 50;
const WIN_STEP = 25;
const GOOD_TRY = 10;

/**
 * Points for a game's result. A win earns 50 against the weakest Opponent (strength 1) and 25 more
 * for each step up the ladder. Losing or drawing earns 10 good-try Points.
 */
export function pointsForResult(result: GameResult, strength: number): number {
  if (result !== 'won') return GOOD_TRY;
  return WIN_BASE + WIN_STEP * (Math.max(1, Math.floor(strength)) - 1);
}
