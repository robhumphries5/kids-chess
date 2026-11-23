// Puzzle Ladder theme: "Is it really free?". Some enemy pieces are defended and some aren't; the
// child must take one that wins material. Checked by exact rules; no analyser needed.
import { Chess, type PieceSymbol, type Square } from 'chess.js';
import type { MoveChoice } from '../../opponents/opponent';
import { pickOne, type Random } from '../random';
import { captureGain, PIECE_VALUES } from '../tactics';
import type { Puzzle } from './puzzle';

export const REALLY_FREE_THEME = 'is-it-really-free';
const GOAL = 'Is it really free? Find a good piece to take!';

/**
 * The goal: the move captures something and comes out ahead once any swaps on that square are
 * over (the capturing piece isn't lost for something worth less). Any such capture counts.
 */
export function winsMaterial(fen: string, move: MoveChoice): boolean {
  return (captureGain(fen, move) ?? 0) > 0;
}

const FILES = 'abcdefgh';
const SQUARES: Square[] = FILES.split('').flatMap((file) => '12345678'.split('').map((rank) => `${file}${rank}` as Square));
const ATTACKERS: PieceSymbol[] = ['q', 'r', 'b', 'n'];
const TARGETS: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p'];

/** Most positions drawn at random don't work, so keep drawing; this many is far more than ever needed. */
const MAX_TRIES = 10_000;

/**
 * A near-empty board: both kings, one or two of the child's pieces, a bait piece guarded by a pawn
 * (taking it loses the capturer for less) and a piece that can be taken for a gain. The child plays white.
 */
export function generateReallyFreePuzzle(random: Random): Puzzle {
  for (let i = 0; i < MAX_TRIES; i++) {
    const fen = drawPosition(random);
    if (!fen) continue;
    const captures = new Chess(fen).moves({ verbose: true }).filter((m) => m.captured);
    const gains = captures.map((m) => ({ move: { from: m.from, to: m.to }, gain: captureGain(fen, m) ?? 0 }));
    const answers = gains.filter((g) => g.gain > 0).map((g) => g.move);
    if (answers.length === 0 || !gains.some((g) => g.gain < 0)) continue;
    return {
      theme: REALLY_FREE_THEME,
      fen,
      goal: GOAL,
      meetsGoal: (move) => winsMaterial(fen, move),
      hint: pickOne(answers, random),
    };
  }
  throw new Error('Could not make an "Is it really free?" puzzle');
}

/** A random legal position with white to move and neither side in check, or undefined. */
function drawPosition(random: Random): string | undefined {
  const chess = new Chess();
  chess.clear();
  const free = [...SQUARES];
  const place = (type: PieceSymbol, color: 'w' | 'b', from: Square[] = free): Square | undefined => {
    const allowed = from.filter((s) => free.includes(s) && (type !== 'p' || (s[1] !== '1' && s[1] !== '8')));
    if (allowed.length === 0) return undefined;
    const square = pickOne(allowed, random);
    free.splice(free.indexOf(square), 1);
    chess.put({ type, color }, square);
    return square;
  };
  const reach = (square: Square) => chess.moves({ square, verbose: true }).map((m) => m.to);

  place('k', 'w');
  place('k', 'b');
  const attacker = pickOne(ATTACKERS, random);
  const attackerSquare = place(attacker, 'w')!;
  // The bait is worth less than the attacker and guarded by a pawn, so taking it loses the attacker.
  const bait = place(pickOne(TARGETS.filter((t) => PIECE_VALUES[t] < PIECE_VALUES[attacker]), random), 'b', reach(attackerSquare));
  if (!bait) return undefined;
  if (!place('p', 'b', pawnGuards(bait))) return undefined;
  // Sometimes a second piece of the child's, so the answer isn't always the same piece.
  const second = random() < 0.4 ? place(pickOne(ATTACKERS, random), 'w') : undefined;
  const takers = second ? [attackerSquare, second] : [attackerSquare];
  if (!place(pickOne(TARGETS, random), 'b', reach(pickOne(takers, random)))) return undefined;

  const fen = chess.fen();
  if (chess.inCheck() || chess.isGameOver()) return undefined;
  // Black must not be in check either, or the position couldn't have arisen with white to move.
  if (new Chess(fen.replace(' w ', ' b ')).inCheck()) return undefined;
  return fen;
}

/** Squares from which a black pawn guards `square` (black pawns take downwards). */
function pawnGuards(square: Square): Square[] {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]) + 1;
  return [file - 1, file + 1].filter((f) => f >= 0 && f < 8 && rank <= 7).map((f) => `${FILES[f]}${rank}` as Square);
}
