// Puzzle Ladder theme: "Make a new piece!". A pawn can promote. Checked by exact rules; no analyser needed.
import { Chess, type PieceSymbol, type Square } from 'chess.js';
import type { MoveChoice } from '../../opponents/opponent';
import { pickOne, type Random } from '../random';
import type { Puzzle } from './puzzle';

export const NEW_PIECE_THEME = 'make-a-new-piece';
const GOAL = 'Make a new piece!';

/**
 * The goal: the move promotes a pawn. Whatever the child picks in the Promotion Picker counts,
 * and promoting by taking a piece counts too.
 */
export function makesANewPiece(fen: string, move: MoveChoice): boolean {
  if (!move.promotion) return false;
  try {
    return new Chess(fen).move(move).isPromotion();
  } catch {
    return false;
  }
}

const FILES = 'abcdefgh';
const SQUARES: Square[] = FILES.split('').flatMap((file) => '12345678'.split('').map((rank) => `${file}${rank}` as Square));
const SEVENTH = SQUARES.filter((s) => s[1] === '7');
const BLACK_PIECES: PieceSymbol[] = ['q', 'r', 'b', 'n'];

/** Most positions drawn at random don't work, so keep drawing; this many is far more than ever needed. */
const MAX_TRIES = 10_000;

/**
 * A near-empty board: both kings and the child's pawn one step from the end. Sometimes an enemy
 * piece blocks the way straight on, or stands where the pawn could take it as it promotes.
 * The child plays white.
 */
export function generateNewPiecePuzzle(random: Random): Puzzle {
  for (let i = 0; i < MAX_TRIES; i++) {
    const fen = drawPosition(random);
    if (!fen) continue;
    const answers = new Chess(fen)
      .moves({ verbose: true })
      .filter((m) => m.promotion)
      .map((m) => ({ from: m.from, to: m.to }));
    if (answers.length === 0) continue;
    return {
      theme: NEW_PIECE_THEME,
      fen,
      goal: GOAL,
      meetsGoal: (move) => makesANewPiece(fen, move),
      // A queen when the app shows or plays it; the child's own choice can be anything.
      hint: { ...pickOne(answers, random), promotion: 'q' },
    };
  }
  throw new Error('Could not make a "Make a new piece!" puzzle');
}

/** A random legal position with white to move and neither side in check, or undefined. */
function drawPosition(random: Random): string | undefined {
  const chess = new Chess();
  chess.clear();
  const free = [...SQUARES];
  const place = (type: PieceSymbol, color: 'w' | 'b', from: Square[]): Square | undefined => {
    const allowed = from.filter((s) => free.includes(s) && (type !== 'p' || (s[1] !== '1' && s[1] !== '8')));
    if (allowed.length === 0) return undefined;
    const square = pickOne(allowed, random);
    free.splice(free.indexOf(square), 1);
    chess.put({ type, color }, square);
    return square;
  };

  const pawn = place('p', 'w', SEVENTH)!;
  const file = FILES.indexOf(pawn[0]);
  const ahead = `${pawn[0]}8` as Square;
  const diagonals = [file - 1, file + 1].filter((f) => f >= 0 && f < 8).map((f) => `${FILES[f]}8` as Square);
  // Sometimes something to take on the way, and sometimes the way straight on is blocked.
  if (random() < 0.4) place(pickOne(BLACK_PIECES, random), 'b', diagonals);
  if (random() < 0.3) place(pickOne(BLACK_PIECES, random), 'b', [ahead]);
  place('k', 'w', free);
  place('k', 'b', free);

  const fen = chess.fen();
  if (chess.inCheck() || chess.isGameOver()) return undefined;
  // Black must not be in check either, or the position couldn't have arisen with white to move.
  if (new Chess(fen.replace(' w ', ' b ')).inCheck()) return undefined;
  return fen;
}
