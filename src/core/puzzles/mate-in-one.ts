// Puzzle Ladder theme: "Checkmate in one!" with a queen or a rook. Checked by exact rules; no analyser needed.
import { Chess, type PieceSymbol, type Square } from 'chess.js';
import type { MoveChoice } from '../../opponents/opponent';
import { pickOne, type Random } from '../random';
import type { Puzzle } from './puzzle';

export const MATE_IN_ONE_THEME = 'checkmate-in-one';
const GOAL = 'Checkmate in one!';

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

const FILES = 'abcdefgh';
const SQUARES: Square[] = FILES.split('').flatMap((file) => '12345678'.split('').map((rank) => `${file}${rank}` as Square));
/** A lone king can only be mated on the edge of the board. */
const EDGE = SQUARES.filter((s) => s[0] === 'a' || s[0] === 'h' || s[1] === '1' || s[1] === '8');
const MATERS: PieceSymbol[] = ['q', 'r'];

/** Most positions drawn at random don't work, so keep drawing; this many is far more than ever needed. */
const MAX_TRIES = 10_000;

/**
 * A near-empty board: both kings, the child's queen or rook, and sometimes a pawn or two
 * hemming in the enemy king on its back rank. The child plays white.
 */
export function generateMateInOnePuzzle(random: Random): Puzzle {
  for (let i = 0; i < MAX_TRIES; i++) {
    const fen = drawPosition(random);
    if (!fen) continue;
    // chess.js marks a mating move with '#'; the tests check these all meet the goal.
    const mates = new Chess(fen).moves({ verbose: true }).filter((m) => m.san.endsWith('#'));
    // Keep it simple: the queen or rook mates, never a king stepping aside (a discovered mate).
    if (mates.length === 0 || mates.some((m) => m.piece === 'k')) continue;
    const answers = mates.map((m) => ({ from: m.from, to: m.to }));
    return {
      theme: MATE_IN_ONE_THEME,
      fen,
      goal: GOAL,
      meetsGoal: (move) => deliversCheckmate(fen, move),
      hint: pickOne(answers, random),
    };
  }
  throw new Error('Could not make a "Checkmate in one!" puzzle');
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

  const king = place('k', 'b', EDGE)!;
  if (king[1] === '8' && random() < 0.5) {
    // A pawn or two in front of the king, hemming it in on the back rank.
    const inFront = neighbours(king).filter((s) => s[1] === '7');
    const pawns = 1 + Math.floor(random() * 2);
    for (let p = 0; p < pawns; p++) place('p', 'b', inFront);
  }
  // Mostly the child's king stands close by to help, as in most real mates; sometimes anywhere.
  place('k', 'w', random() < 0.8 ? SQUARES.filter((s) => distance(s, king) === 2) : free);
  place(pickOne(MATERS, random), 'w', free);

  const fen = chess.fen();
  if (chess.inCheck() || chess.isGameOver()) return undefined;
  // Black must not be in check either, or the position couldn't have arisen with white to move.
  if (new Chess(fen.replace(' w ', ' b ')).inCheck()) return undefined;
  return fen;
}

/** How many king steps apart two squares are. */
function distance(a: Square, b: Square): number {
  return Math.max(Math.abs(FILES.indexOf(a[0]) - FILES.indexOf(b[0])), Math.abs(Number(a[1]) - Number(b[1])));
}

function neighbours(square: Square): Square[] {
  return SQUARES.filter((s) => distance(s, square) === 1);
}

