// A Puzzle Session: an endless stream of puzzles for one Profile. Answers are checked by each
// puzzle's goal, never by matching a stored move. No level numbers, no fail screens.
import { Chess } from 'chess.js';
import type { MoveChoice } from '../opponents/opponent';
import type { PointsAwarded, PointsLedger } from './points';
import type { Puzzle } from './puzzles/puzzle';
import { pickOne, type Random } from './random';
import type { BoardChanged, Colour, MoveRejected, PromotionNeeded, Say, SoundCue } from './session';

/** Points for solving with no mistakes. Hint Steps (later) lower this to 20 / 10 / 0. */
const SOLVE_POINTS = 30;

const CHEERS = ['Well done!', 'Brilliant!', 'Yes! Super job!', 'Hooray! You did it!', 'Fantastic!'];
const TRY_AGAIN = 'Try again!';

/** A new puzzle is on the board. The UI may pause before it (after a solve) and orients the board. */
export interface PuzzleStarted {
  type: 'puzzle-started';
  theme: string;
  /** The side the child plays in this puzzle (whoever is to move). */
  childColour: Colour;
}

export interface PuzzleSolved {
  type: 'puzzle-solved';
}

/** A legal move that didn't meet the goal. The board goes back (the board-changed that follows). */
export interface NotYet {
  type: 'not-yet';
  from: string;
  to: string;
}

export type PuzzleSessionEvent =
  | PuzzleStarted
  | BoardChanged
  | Say
  | SoundCue
  | MoveRejected
  | PromotionNeeded
  | NotYet
  | PuzzleSolved
  | PointsAwarded;

export interface PuzzleSessionOptions {
  /** Where puzzles come from; called once per puzzle, for ever. */
  nextPuzzle: () => Puzzle;
  /** The Profile's Points. */
  points: PointsLedger;
  /** Picks which cheerful line to say. */
  random?: Random;
}

export interface PuzzleSession {
  start(): Promise<PuzzleSessionEvent[]>;
  move(move: MoveChoice): Promise<PuzzleSessionEvent[]>;
}

export function createPuzzleSession({ nextPuzzle, points, random = Math.random }: PuzzleSessionOptions): PuzzleSession {
  let puzzle: Puzzle;
  let chess: Chess;
  let solved = false;

  function board(lastMove?: [string, string]): BoardChanged {
    const childToMove = !solved;
    const dests: Record<string, string[]> = {};
    if (childToMove) {
      for (const m of chess.moves({ verbose: true })) {
        const list = (dests[m.from] ??= []);
        if (!list.includes(m.to)) list.push(m.to);
      }
    }
    return {
      type: 'board-changed',
      fen: chess.fen(),
      lastMove,
      turn: chess.turn() === 'w' ? 'white' : 'black',
      check: chess.inCheck(),
      childToMove,
      dests,
    };
  }

  function begin(): PuzzleSessionEvent[] {
    puzzle = nextPuzzle();
    chess = new Chess(puzzle.fen);
    solved = false;
    return [
      { type: 'puzzle-started', theme: puzzle.theme, childColour: chess.turn() === 'w' ? 'white' : 'black' },
      board(),
      { type: 'say', text: puzzle.goal },
    ];
  }

  return {
    async start() {
      return begin();
    },

    async move(move) {
      const candidates = solved ? [] : chess.moves({ verbose: true }).filter((m) => m.from === move.from && m.to === move.to);
      if (!move.promotion && candidates.some((m) => m.promotion)) {
        return [{ type: 'promotion-needed', from: move.from, to: move.to }];
      }
      if (!candidates.some((m) => m.promotion === move.promotion)) {
        return [{ type: 'move-rejected', from: move.from, to: move.to }, board()];
      }
      if (!puzzle.meetsGoal(move)) {
        return [{ type: 'not-yet', from: move.from, to: move.to }, board(), { type: 'say', text: TRY_AGAIN }];
      }
      const played = chess.move(move);
      solved = true;
      return [
        board([played.from, played.to]),
        { type: 'sound', sound: 'win' },
        { type: 'puzzle-solved' },
        points.award(SOLVE_POINTS),
        { type: 'say', text: pickOne(CHEERS, random) },
        ...begin(),
      ];
    },
  };
}
