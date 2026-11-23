// Simple tactic checks on a position, by exact rules (no engine). Shared by the help features:
// Blunder Warnings, and later Missed-Chance Alerts and Move Colours.
import { Chess, type Move, type PieceSymbol } from 'chess.js';

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

/**
 * Captures the side to move in `fen` can make that win material: the target can't be taken back, or
 * the capturing piece is worth less than its target. Kings are never targets (that's check).
 */
export function winningCaptures(fen: string): Move[] {
  const chess = new Chess(fen);
  return chess.moves({ verbose: true }).filter((m) => {
    if (!m.captured) return false;
    if (PIECE_VALUES[m.piece] < PIECE_VALUES[m.captured]) return true;
    chess.move(m);
    const canTakeBack = chess.moves({ verbose: true }).some((reply) => reply.to === m.to);
    chess.undo();
    return !canTakeBack;
  });
}
