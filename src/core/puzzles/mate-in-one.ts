// Puzzle Ladder theme: "Checkmate in one!" with a queen or a rook. Checked by exact rules; no analyser needed.
import { Chess } from 'chess.js';
import type { MoveChoice } from '../../opponents/opponent';

/** The goal: the move checkmates. Any mate counts, not just the one the puzzle was built around. */
export function deliversCheckmate(fen: string, move: MoveChoice): boolean {
  const chess = new Chess(fen);
  try {
    chess.move(move);
  } catch {
    return false;
  }
  return chess.isCheckmate();
}
