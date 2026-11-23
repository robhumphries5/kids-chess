// A Hungry Pieces session: one chosen piece eats every apple, level after level. No enemies, no
// level numbers shown, never failed. Points go through the Points ledger once per finished level.
import { fewestMoves, generateLevel, pieceMoves, pointsForMoves, type HungryLevel, type HungryPiece, type Square } from './hungry-pieces';
import type { PointsAwarded, PointsLedger } from './points';
import { pickOne, type Random } from './random';
import type { Say, SoundCue } from './session';

const YUM = ['Yum!', 'Crunch!', 'Munch, munch!', 'Delicious!', 'Mmm, tasty apple!'];
const CHEERS = ['Brilliant!', 'Hooray!', 'Well done!', 'Fantastic!'];

/** A new level is on the board. The UI may pause before it (after a level is finished). */
export interface LevelStarted {
  type: 'level-started';
  /** Counts from 1. For the session's own use and tests; never shown to the child. */
  level: number;
  apples: number;
}

/** How the board looks now. `dests` are the squares the piece can move to. */
export interface HungryBoard {
  type: 'hungry-board';
  piece: HungryPiece;
  square: Square;
  apples: Square[];
  dests: Square[];
  /** Moves used so far on this level. */
  moves: number;
  lastMove?: [Square, Square];
}

export interface AppleEaten {
  type: 'apple-eaten';
  square: Square;
  /** Apples still to eat. */
  left: number;
}

/** The last apple is eaten. `points` were awarded by moves used compared with the fewest possible. */
export interface LevelFinished {
  type: 'level-finished';
  moves: number;
  fewest: number;
  points: number;
}

/** The piece can't move there. Nothing changed. */
export interface HungryMoveRejected {
  type: 'move-rejected';
  to: Square;
}

export type HungrySessionEvent =
  | LevelStarted
  | HungryBoard
  | AppleEaten
  | LevelFinished
  | HungryMoveRejected
  | PointsAwarded
  | Say
  | SoundCue;

export interface HungrySessionOptions {
  piece: HungryPiece;
  /** The Profile's Points. */
  points: PointsLedger;
  /** Picks the cheerful lines, and lays out levels unless `nextLevel` is given. */
  random?: Random;
  /** Level `n` (from 1) for the piece. Defaults to a generated level. */
  nextLevel?: (n: number, piece: HungryPiece) => HungryLevel;
}

export interface HungrySession {
  start(): HungrySessionEvent[];
  /** Move the hungry piece to `to`. */
  move(to: Square): HungrySessionEvent[];
}

export function createHungrySession({
  piece,
  points,
  random = Math.random,
  nextLevel = (n, p) => generateLevel(n, p, random),
}: HungrySessionOptions): HungrySession {
  let level = 0;
  let square: Square;
  let apples: Square[] = [];
  let moves = 0;
  let fewest = 0;

  function board(lastMove?: [Square, Square]): HungryBoard {
    return {
      type: 'hungry-board',
      piece,
      square,
      apples: [...apples],
      dests: pieceMoves(piece, square, new Set(apples)),
      moves,
      lastMove,
    };
  }

  function begin(): HungrySessionEvent[] {
    level++;
    const layout = nextLevel(level, piece);
    square = layout.start;
    apples = layout.apples.filter((a) => a !== layout.start);
    moves = 0;
    // Generated levels are always solvable; a hand-made one that isn't is a bug, not the child's fault.
    fewest = fewestMoves(layout) ?? Infinity;
    return [
      { type: 'level-started', level, apples: apples.length },
      board(),
      { type: 'say', text: apples.length === 1 ? 'Eat the apple!' : 'Eat all the apples!' },
    ];
  }

  function finish(): HungrySessionEvent[] {
    const earned = pointsForMoves(moves, fewest);
    const awarded = points.award(earned);
    const inMoves = `${moves} ${moves === 1 ? 'move' : 'moves'}`;
    const text =
      moves <= fewest
        ? `${pickOne(CHEERS, random)} All gone in ${inMoves}. That's the fewest possible!`
        : `${pickOne(CHEERS, random)} All gone in ${inMoves}!`;
    return [
      { type: 'level-finished', moves, fewest, points: earned },
      awarded,
      { type: 'sound', sound: 'win' },
      { type: 'say', text },
      ...begin(),
    ];
  }

  return {
    start: begin,
    move(to) {
      const from = square;
      if (!pieceMoves(piece, from, new Set(apples)).includes(to)) return [{ type: 'move-rejected', to }, board()];
      square = to;
      moves++;
      if (!apples.includes(to)) return [board([from, to]), { type: 'sound', sound: 'move' }];
      apples = apples.filter((a) => a !== to);
      const eaten: HungrySessionEvent[] = [{ type: 'apple-eaten', square: to, left: apples.length }, board([from, to])];
      if (apples.length === 0) return [...eaten, ...finish()];
      return [...eaten, { type: 'sound', sound: 'capture' }, { type: 'say', text: pickOne(YUM, random) }];
    },
  };
}
