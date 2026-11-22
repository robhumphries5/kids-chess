// A Puzzle Session: an endless stream of puzzles for one Profile. Answers are checked by each
// puzzle's goal, never by matching a stored move. No level numbers, no fail screens.
import { Chess } from 'chess.js';
import type { MoveChoice } from '../opponents/opponent';
import type { PointsAwarded, PointsLedger } from './points';
import type { Puzzle } from './puzzles/puzzle';
import { pickOne, type Random } from './random';
import type { BoardChanged, Colour, MoveRejected, PromotionNeeded, Say, SoundCue } from './session';

/** Points by how many Hint Steps were needed: none, after step 1, after step 2, the app played it. */
const POINTS_BY_HINTS = [30, 20, 10, 0] as const;

const CHEERS = ['Well done!', 'Brilliant!', 'Yes! Super job!', 'Hooray! You did it!', 'Fantastic!'];
const NEARLY = 'Nearly! Try again!';
const FOLLOW_THE_ARROW = 'Nearly! Follow the arrow!';
const WATCH_THIS = 'Watch this!';
const NOW_YOU_KNOW = "Now you know! Let's try another.";

/** A new puzzle is on the board. The UI may pause before it (after a solve) and orients the board. */
export interface PuzzleStarted {
  type: 'puzzle-started';
  theme: string;
  /** The side the child plays in this puzzle (whoever is to move). */
  childColour: Colour;
}

/** The puzzle is done (it can never be failed). `points` is 30 / 20 / 10, or 0 if the app played it. */
export interface PuzzleSolved {
  type: 'puzzle-solved';
  points: number;
}

/** A legal move that didn't meet the goal. The board goes back (the board-changed that follows). */
export interface NotYet {
  type: 'not-yet';
  from: string;
  to: string;
}

/**
 * Gentle help after a wrong move, from the puzzle's one stored answer. Step 1: the right piece
 * (on `piece`) wobbles. Step 2: an arrow shows the answer `move`. Step 3: the app plays `move`
 * itself (the board-changed that follows) and the puzzle is done.
 */
export type HintStep =
  | { type: 'hint-step'; step: 1; piece: string }
  | { type: 'hint-step'; step: 2 | 3; move: { from: string; to: string } };

export type PuzzleSessionEvent =
  | HintStep
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
  /** Hint Steps given on the current puzzle. */
  let hints = 0;

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
    hints = 0;
    return [
      { type: 'puzzle-started', theme: puzzle.theme, childColour: chess.turn() === 'w' ? 'white' : 'black' },
      board(),
      { type: 'say', text: puzzle.goal },
    ];
  }

  /** A legal move that misses the goal: back it goes, with the next Hint Step. */
  function miss(move: MoveChoice): PuzzleSessionEvent[] {
    hints++;
    const { from, to } = puzzle.hint;
    const back: PuzzleSessionEvent[] = [{ type: 'not-yet', from: move.from, to: move.to }, board()];
    if (hints === 1) return [...back, { type: 'say', text: NEARLY }, { type: 'hint-step', step: 1, piece: from }];
    if (hints === 2) return [...back, { type: 'say', text: FOLLOW_THE_ARROW }, { type: 'hint-step', step: 2, move: { from, to } }];
    return [
      ...back,
      { type: 'say', text: WATCH_THIS },
      { type: 'hint-step', step: 3, move: { from, to } },
      ...finish(puzzle.hint, NOW_YOU_KNOW),
    ];
  }

  /** Plays a move that meets the goal, awards Points by the Hint Steps used, and starts the next puzzle. */
  function finish(move: MoveChoice, cheer: string): PuzzleSessionEvent[] {
    const played = chess.move(move);
    solved = true;
    const earned = POINTS_BY_HINTS[hints];
    return [
      board([played.from, played.to]),
      { type: 'sound', sound: hints === 3 ? (played.captured ? 'capture' : 'move') : 'win' },
      { type: 'puzzle-solved', points: earned },
      points.award(earned),
      { type: 'say', text: cheer },
      ...begin(),
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
        return miss(move);
      }
      return finish(move, pickOne(CHEERS, random));
    },
  };
}
