// Puzzle Ladder theme 1: "Take the free piece!". Checked by exact rules; no analyser needed.
import { Chess, type PieceSymbol, type Square } from 'chess.js';
import type { MoveChoice } from '../../opponents/opponent';
import { pickOne, type Random } from '../random';
import type { Puzzle } from './puzzle';

export const FREE_PIECE_THEME = 'take-the-free-piece';
const GOAL = 'Take the free piece!';

/**
 * The goal: the move captures something, and the capturing piece can't then be taken back.
 * Any capture like that counts, not just the one the puzzle was built around.
 */
export function takesAFreePiece(fen: string, move: MoveChoice): boolean {
  const chess = new Chess(fen);
  let played;
  try {
    played = chess.move(move);
  } catch {
    return false;
  }
  if (!played.captured) return false;
  // A quick look first; only if something attacks the square, check it could legally take back.
  if (!chess.isAttacked(played.to, chess.turn())) return true;
  return !chess.moves({ verbose: true }).some((reply) => reply.to === played.to);
}

const SQUARES: Square[] = 'abcdefgh'
  .split('')
  .flatMap((file) => '12345678'.split('').map((rank) => `${file}${rank}` as Square));

const ATTACKERS: PieceSymbol[] = ['q', 'r', 'b', 'n'];
const TARGETS: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p'];

/** Most positions drawn at random don't work, so keep drawing; this many is far more than ever needed. */
const MAX_TRIES = 10_000;

/**
 * A near-empty board: both kings, one of the child's pieces, one enemy piece it can take for free,
 * and sometimes one more enemy piece. The child plays white.
 */
export function generateFreePiecePuzzle(random: Random): Puzzle {
  for (let i = 0; i < MAX_TRIES; i++) {
    const fen = drawPosition(random);
    if (!fen) continue;
    const answers = new Chess(fen)
      .moves({ verbose: true })
      .filter((m) => m.captured)
      .map((m) => ({ from: m.from, to: m.to }))
      .filter((m) => takesAFreePiece(fen, m));
    if (answers.length === 0) continue;
    return {
      theme: FREE_PIECE_THEME,
      fen,
      goal: GOAL,
      meetsGoal: (move) => takesAFreePiece(fen, move),
      hint: pickOne(answers, random),
    };
  }
  throw new Error('Could not make a "Take the free piece!" puzzle');
}

/** A random legal position with white to move and neither side in check, or undefined. */
function drawPosition(random: Random): string | undefined {
  const chess = new Chess();
  chess.clear();
  const free = [...SQUARES];
  const place = (type: PieceSymbol, color: 'w' | 'b', from: Square[] = free): Square | undefined => {
    const allowed = type === 'p' ? from.filter((s) => s[1] !== '1' && s[1] !== '8') : from;
    if (allowed.length === 0) return undefined;
    const square = pickOne(allowed, random);
    free.splice(free.indexOf(square), 1);
    chess.put({ type, color }, square);
    return square;
  };

  place('k', 'w');
  place('k', 'b');
  const attacker = place(pickOne(ATTACKERS, random), 'w')!;
  // The target goes somewhere the attacker can already reach, so there is something to take.
  const reach = chess.moves({ square: attacker, verbose: true }).map((m) => m.to);
  if (!place(pickOne(TARGETS, random), 'b', reach.filter((s) => free.includes(s)))) return undefined;
  if (random() < 0.4) place(pickOne(TARGETS, random), 'b');

  const fen = chess.fen();
  if (chess.inCheck() || chess.isGameOver()) return undefined;
  // Black must not be in check either, or the position couldn't have arisen with white to move.
  if (new Chess(fen.replace(' w ', ' b ')).inCheck()) return undefined;
  return fen;
}
