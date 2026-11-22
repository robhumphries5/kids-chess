import type { MoveChoice } from '../../opponents/opponent';

/**
 * A small position with a goal. Answers are checked by the goal, never by matching one stored move:
 * any move that meets it is correct.
 */
export interface Puzzle {
  /** Which Puzzle Ladder theme it comes from. */
  theme: string;
  fen: string;
  /** Spoken when the puzzle starts, e.g. "Take the free piece!". */
  goal: string;
  /** Does this move (by the side to move in `fen`) achieve the goal? Illegal moves never do. */
  meetsGoal(move: MoveChoice): boolean;
  /** One known answer, kept only for Hint Steps. */
  hint: MoveChoice;
}
