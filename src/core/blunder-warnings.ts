// Blunder Warnings: after the child's move, can the Opponent now checkmate, or win a queen, rook,
// bishop or knight? Pure: no DOM, and the engine comes in through the Analyser seam, so tests use the
// fake. The simple tactic checks say what could happen; the analyser's scores, when it answers, say
// whether the child's move really made things worse (so no warning for a loss no move could avoid).
import { Chess, type Move, type PieceSymbol } from 'chess.js';
import type { Analyser, Score } from '../engine/analyser';
import type { MoveChoice } from '../opponents/opponent';
import type { KindSwitches } from './profiles';
import { matesInOne, PIECE_NAMES, PIECE_VALUES, winningCaptures } from './tactics';

/** The four kinds of Blunder Warning, each with its own per-Profile switch. */
export type BlunderKind = keyof KindSwitches;

export interface Blunder {
  kind: BlunderKind;
  /** Why, to be spoken: e.g. "The knight could take your queen!" */
  reason: string;
  /** The Opponent's move it warns about, as [from, to], to point at on the board. */
  threat: [string, string];
}

/** A quick look is enough: the child is waiting to see the Opponent's reply. */
const SEARCH = { depth: 10, timeMs: 300 } as const;

/** How much worse (in centipawns) than the best move a move must be before each kind is warned about. */
const WORSE_BY: Readonly<Record<BlunderKind, number>> = { checkmate: 300, queen: 600, rook: 300, bishopKnight: 200 };

const PIECE_KINDS: Partial<Record<PieceSymbol, BlunderKind>> = { q: 'queen', r: 'rook', b: 'bishopKnight', n: 'bishopKnight' };

/**
 * Whether playing `move` in `fen` (the child to move) deserves a Blunder Warning, and why. Checkmate
 * comes first, then the biggest piece. Only kinds switched on are reported. `move` must be legal.
 */
export async function findBlunder(
  fen: string,
  move: MoveChoice,
  analyser: Analyser,
  switches: KindSwitches,
): Promise<Blunder | undefined> {
  const chess = new Chess(fen);
  const played = chess.move(move);
  const after = chess.fen();
  if (chess.isGameOver()) return undefined;

  const found = [...mateBlunders(after), ...pieceBlunders(after, played)].filter((b) => switches[b.kind]);
  if (found.length === 0) return undefined;

  const worseBy = await howMuchWorse(analyser, fen, after);
  return found.find((b) => worseBy === undefined || worseBy >= WORSE_BY[b.kind]);
}

function mateBlunders(after: string): Blunder[] {
  return matesInOne(after).slice(0, 1).map((m) => ({
    kind: 'checkmate',
    reason: `The ${PIECE_NAMES[m.piece]} could checkmate you!`,
    threat: [m.from, m.to],
  }));
}

/** The child's pieces the Opponent can now win, biggest first, each taken by its cheapest attacker. */
function pieceBlunders(after: string, played: Move): Blunder[] {
  /** What the child's move took: losing a piece worth no more than that is a fair swap. */
  const took = played.captured ? PIECE_VALUES[played.captured] : 0;
  return winningCaptures(after)
    .filter((c) => PIECE_KINDS[c.captured!] && PIECE_VALUES[c.captured!] > took)
    .sort((a, b) => PIECE_VALUES[b.captured!] - PIECE_VALUES[a.captured!] || PIECE_VALUES[a.piece] - PIECE_VALUES[b.piece])
    .map((c) => ({
      kind: PIECE_KINDS[c.captured!]!,
      reason: `The ${PIECE_NAMES[c.piece]} could take your ${PIECE_NAMES[c.captured!]}!`,
      threat: [c.from, c.to],
    }));
}

/**
 * How many centipawns worse the child's move is than their best, by the analyser; undefined when it
 * can't say (no answer, or it failed), and then the tactic checks decide alone.
 */
async function howMuchWorse(analyser: Analyser, before: string, after: string): Promise<number | undefined> {
  try {
    const [best] = await analyser.analyse(before, SEARCH);
    const [reply] = await analyser.analyse(after, SEARCH);
    if (!best || !reply) return undefined;
    // The reply's score is from the Opponent's side.
    return centipawns(best.score) + centipawns(reply.score);
  } catch {
    return undefined;
  }
}

/** A mate counts as more than any material. */
function centipawns(score: Score): number {
  if ('cp' in score) return score.cp;
  return score.mate > 0 ? 10_000 : -10_000;
}
