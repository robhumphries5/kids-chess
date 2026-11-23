// Puzzle Ladder theme: simple forks. One move attacks two enemy pieces that can't both be saved.
// Checked by exact rules; no analyser needed.
import { Chess, type PieceSymbol, type Square } from 'chess.js';
import type { MoveChoice } from '../../opponents/opponent';
import { pickOne, type Random } from '../random';
import { captureGain, isWinningFork, matesInOne } from '../tactics';
import type { Puzzle } from './puzzle';

export const FORK_THEME = 'simple-fork';
const GOAL = 'Attack two pieces at once!';

const SQUARES: Square[] = 'abcdefgh'
  .split('')
  .flatMap((file) => '12345678'.split('').map((rank) => `${file}${rank}` as Square));

/** Knights are the classic forkers, so they come up most. */
const FORKERS: PieceSymbol[] = ['n', 'n', 'n', 'q', 'b', 'r'];
const TARGETS: PieceSymbol[] = ['q', 'r', 'b', 'n'];

/** Most positions drawn at random don't work, so keep drawing; this many is far more than ever needed. */
const MAX_TRIES = 10_000;

/**
 * A near-empty board: both kings, the child's forking piece one move from a square that attacks
 * two enemy pieces (often the king and a rook or queen), and nothing to take for free before the
 * fork. Any winning fork counts, not just the one the puzzle was built around. The child plays white.
 */
export function generateForkPuzzle(random: Random): Puzzle {
  for (let i = 0; i < MAX_TRIES; i++) {
    const drawn = drawPosition(random);
    if (!drawn) continue;
    const { fen, fork } = drawn;
    if (!isWinningFork(fen, fork)) continue;
    // The fork must be the idea: nothing to take for a gain and no checkmate on offer first.
    const captures = new Chess(fen).moves({ verbose: true }).filter((m) => m.captured);
    if (captures.some((m) => (captureGain(fen, m) ?? 0) > 0)) continue;
    if (matesInOne(fen).length > 0) continue;
    return {
      theme: FORK_THEME,
      fen,
      goal: GOAL,
      meetsGoal: (move: MoveChoice) => isWinningFork(fen, move),
      hint: fork,
    };
  }
  throw new Error('Could not make a "simple fork" puzzle');
}

/** A random legal position with white to move, neither side in check, and the fork it was built around. */
function drawPosition(random: Random): { fen: string; fork: MoveChoice } | undefined {
  const chess = new Chess();
  chess.clear();
  const free = [...SQUARES];
  const place = (type: PieceSymbol, color: 'w' | 'b', from: Square[] = free): Square | undefined => {
    const allowed = from.filter((s) => free.includes(s));
    if (allowed.length === 0) return undefined;
    const square = pickOne(allowed, random);
    free.splice(free.indexOf(square), 1);
    chess.put({ type, color }, square);
    return square;
  };
  const lift = (square: Square) => {
    chess.remove(square);
    free.push(square);
  };

  // Stand the forker on the fork square first, to see what it would attack from there.
  const forker = pickOne(FORKERS, random);
  const forkSquare = place(forker, 'w')!;
  const attackedFromFork = () => free.filter((s) => chess.attackers(s, 'w').includes(forkSquare));
  if (random() < 0.6) {
    if (!place('k', 'b', attackedFromFork())) return undefined;
  } else {
    place('k', 'b');
    if (!place(pickOne(TARGETS, random), 'b', attackedFromFork())) return undefined;
  }
  if (!place(pickOne(TARGETS, random), 'b', attackedFromFork())) return undefined;

  // Then move it back to a square it could reach the fork square from.
  lift(forkSquare);
  const starts = free.filter((s) => {
    chess.put({ type: forker, color: 'w' }, s);
    const reaches = chess.attackers(forkSquare, 'w').includes(s);
    chess.remove(s);
    return reaches;
  });
  const start = place(forker, 'w', starts.filter((s) => s !== forkSquare));
  if (!start) return undefined;
  place('k', 'w');

  const fen = chess.fen();
  if (chess.inCheck() || chess.isGameOver()) return undefined;
  // Black must not be in check either, or the position couldn't have arisen with white to move.
  if (new Chess(fen.replace(' w ', ' b ')).inCheck()) return undefined;
  return { fen, fork: { from: start, to: forkSquare } };
}
