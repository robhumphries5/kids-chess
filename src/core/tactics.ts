// Simple tactic checks on a position, by exact rules (no engine). Shared by the help features:
// Blunder Warnings, and later Missed-Chance Alerts and Move Colours.
import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';

/** Rough worth in centipawns, for deciding whether a capture wins material. */
export const PIECE_VALUES: Readonly<Record<PieceSymbol, number>> = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 };

/** How a piece is named when spoken. */
export const PIECE_NAMES: Readonly<Record<PieceSymbol, string>> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

/** Moves that checkmate straight away for the side to move in `fen`. */
export function matesInOne(fen: string): Move[] {
  return new Chess(fen).moves({ verbose: true }).filter((m) => m.san.endsWith('#'));
}

/** A move to look at, as the board or an Opponent gives it. */
export interface MoveSpec {
  from: string;
  to: string;
  promotion?: string;
}

/**
 * What a capture by the side to move in `fen` wins, in centipawns, once both sides have finished
 * swapping pieces on that square (each side takes back with its cheapest piece, or stops when
 * taking back would lose more). Positive wins material, 0 is an even swap, negative loses it.
 * Null when the move is illegal or captures nothing.
 */
export function captureGain(fen: string, move: MoveSpec): number | null {
  const chess = new Chess(fen);
  let played: Move;
  try {
    played = chess.move(move);
  } catch {
    return null;
  }
  if (!played.captured) return null;
  return PIECE_VALUES[played.captured] + promotionBonus(played) - swapGain(chess, played.to);
}

/** What the side to move can win by starting (or carrying on) the swaps on `square`, never below 0. */
function swapGain(chess: Chess, square: Square): number {
  const target = chess.get(square);
  if (!target) return 0;
  const takers = chess.moves({ verbose: true }).filter((m) => m.to === square && m.captured);
  if (takers.length === 0) return 0;
  // The cheapest piece goes first; the king only when nothing else can.
  const cheapest = takers.reduce((a, b) => (order(b) < order(a) ? b : a));
  chess.move(cheapest);
  const gain = PIECE_VALUES[target.type] + promotionBonus(cheapest) - swapGain(chess, square);
  chess.undo();
  return Math.max(0, gain);
}

/**
 * Is this move by the side to move in `fen` a winning fork? The moved piece must attack two or
 * more enemy pieces (the king counts), and whatever the other side replies, the mover can then
 * come out ahead in material (or checkmate). That also means the forking piece isn't simply lost.
 */
export function isWinningFork(fen: string, move: MoveSpec): boolean {
  const chess = new Chess(fen);
  let played: Move;
  try {
    played = chess.move(move);
  } catch {
    return false;
  }
  const enemy = chess.turn();
  const attacked = SQUARES.filter((s) => chess.get(s)?.color === enemy && chess.attackers(s, played.color).includes(played.to));
  if (attacked.length < 2) return false;
  const replies = chess.moves({ verbose: true });
  // A checkmate or stalemate isn't a fork.
  if (replies.length === 0) return false;
  return replies.every((reply) => {
    chess.move(reply);
    const lost = reply.captured ? PIECE_VALUES[reply.captured] : 0;
    const comesOutAhead = bestFollowUp(chess) - lost > 0;
    chess.undo();
    return comesOutAhead;
  });
}

/** The most the side to move can win with one capture (after swaps), or Infinity if it can checkmate. */
function bestFollowUp(chess: Chess): number {
  let best = 0;
  for (const m of chess.moves({ verbose: true })) {
    if (m.san.endsWith('#')) return Infinity;
    if (!m.captured) continue;
    chess.move(m);
    best = Math.max(best, PIECE_VALUES[m.captured] + promotionBonus(m) - swapGain(chess, m.to));
    chess.undo();
  }
  return best;
}

const SQUARES: Square[] = 'abcdefgh'
  .split('')
  .flatMap((file) => '12345678'.split('').map((rank) => `${file}${rank}` as Square));

function order(move: Move): number {
  return move.piece === 'k' ? Infinity : PIECE_VALUES[move.piece];
}

function promotionBonus(move: Move): number {
  return move.promotion ? PIECE_VALUES[move.promotion] - PIECE_VALUES.p : 0;
}

/** Could the side to move in `fen` take the piece on `square` and win material doing it? */
export function canBeTakenForFree(fen: string, square: Square): boolean {
  const chess = new Chess(fen);
  // A quick look first; only if something attacks the square, look at each capture there.
  if (!chess.isAttacked(square, chess.turn())) return false;
  return winningCapturesOn(chess, chess.moves({ verbose: true }).filter((m) => m.to === square)).length > 0;
}

/**
 * Captures the side to move in `fen` can make that win material: the target can't be taken back, or
 * the capturing piece is worth less than its target. Kings are never targets (that's check).
 */
export function winningCaptures(fen: string): Move[] {
  const chess = new Chess(fen);
  return winningCapturesOn(chess, chess.moves({ verbose: true }));
}

/** Those of `moves` (legal in `chess`) that are winning captures. */
function winningCapturesOn(chess: Chess, moves: Move[]): Move[] {
  return moves.filter((m) => {
    if (!m.captured) return false;
    if (PIECE_VALUES[m.piece] < PIECE_VALUES[m.captured]) return true;
    chess.move(m);
    const canTakeBack = chess.moves({ verbose: true }).some((reply) => reply.to === m.to);
    chess.undo();
    return !canTakeBack;
  });
}
