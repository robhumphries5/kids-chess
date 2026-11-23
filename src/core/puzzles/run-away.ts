// Puzzle Ladder theme: "Run away!". One of the child's pieces is attacked. Checked by exact rules; no analyser needed.
import { Chess, type PieceSymbol, type Square } from 'chess.js';
import type { MoveChoice } from '../../opponents/opponent';
import { pickOne, type Random } from '../random';
import { canBeTakenForFree, winningCaptures } from '../tactics';
import type { Puzzle } from './puzzle';

export const RUN_AWAY_THEME = 'run-away';
const GOAL = 'Run away!';

/**
 * The goal: after the move, the attacked piece (on `attacked`) can no longer be taken for free.
 * Any way of saving it counts: moving it somewhere safe, blocking the attack, or defending it.
 */
export function leavesItSafe(fen: string, attacked: Square, move: MoveChoice): boolean {
  const chess = new Chess(fen);
  let played;
  try {
    played = chess.move(move);
  } catch {
    return false;
  }
  const square = played.from === attacked ? played.to : attacked;
  // Nothing attacks it at all: safe, without the slower look at each capture.
  if (!chess.isAttacked(square, chess.turn())) return true;
  return !canBeTakenForFree(chess.fen(), square);
}

const SQUARES: Square[] = 'abcdefgh'
  .split('')
  .flatMap((file) => '12345678'.split('').map((rank) => `${file}${rank}` as Square));

const RUNNERS: PieceSymbol[] = ['q', 'r', 'b', 'n'];
const ATTACKERS: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p'];
const HELPERS: PieceSymbol[] = ['r', 'b', 'n'];

/** Most positions drawn at random don't work, so keep drawing; this many is far more than ever needed. */
const MAX_TRIES = 10_000;

/**
 * A near-empty board: both kings, one of the child's pieces with an enemy piece attacking it, and
 * sometimes one more of the child's pieces that could help. The child plays white.
 */
export function generateRunAwayPuzzle(random: Random): Puzzle {
  for (let i = 0; i < MAX_TRIES; i++) {
    const drawn = drawPosition(random);
    if (!drawn) continue;
    const { fen, attacked } = drawn;
    // The piece really is in danger.
    if (!canBeTakenForFree(fen.replace(' w ', ' b '), attacked)) continue;
    // Keep the lesson about running away: nothing free for the child to take instead.
    if (winningCaptures(fen).length > 0) continue;
    const moves = new Chess(fen).moves({ verbose: true }).map((m) => ({ from: m.from, to: m.to }));
    const runs = moves.filter((m) => m.from === attacked && leavesItSafe(fen, attacked, m));
    if (runs.length === 0) continue;
    return {
      theme: RUN_AWAY_THEME,
      fen,
      goal: GOAL,
      meetsGoal: (move) => leavesItSafe(fen, attacked, move),
      // The hint wobbles the piece in danger and shows it running somewhere safe.
      hint: pickOne(runs, random),
    };
  }
  throw new Error('Could not make a "Run away!" puzzle');
}

/** A random legal position with white to move and neither side in check, or undefined. */
function drawPosition(random: Random): { fen: string; attacked: Square } | undefined {
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

  place('k', 'w');
  place('k', 'b');
  const attacked = place(pickOne(RUNNERS, random), 'w')!;
  // The attacker goes somewhere it could take the piece from.
  const type = pickOne(ATTACKERS, random);
  const from = free.filter((s) => attacks(chess, type, s, attacked));
  if (!place(type, 'b', from)) return undefined;
  if (random() < 0.5) place(pickOne(HELPERS, random), 'w');

  const fen = chess.fen();
  if (chess.inCheck() || chess.isGameOver()) return undefined;
  // Black must not be in check either, or the position couldn't have arisen with white to move.
  if (new Chess(fen.replace(' w ', ' b ')).inCheck()) return undefined;
  return { fen, attacked };
}

/** Would a black `type` on `square` attack `target`? */
function attacks(chess: Chess, type: PieceSymbol, square: Square, target: Square): boolean {
  if (type === 'p' && (square[1] === '1' || square[1] === '8')) return false;
  chess.put({ type, color: 'b' }, square);
  const hits = chess.attackers(target, 'b').includes(square);
  chess.remove(square);
  return hits;
}
