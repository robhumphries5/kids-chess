// Missed-Chance Alerts: at the start of the child's turn, has the Opponent left a treat (a checkmate,
// or a free queen, rook, bishop or knight)? Pure: no DOM, and the engine comes in through the Analyser
// seam, so tests use the fake. The simple tactic checks say what could be won; the analyser's scores,
// when it answers, say whether taking it really is good (so no alert for a capture that walks into a trap).
import { Chess, type Move, type PieceSymbol } from 'chess.js';
import type { Analyser, Score } from '../engine/analyser';
import type { KindSwitches } from './profiles';
import { matesInOne, PIECE_NAMES, PIECE_VALUES, winningCaptures } from './tactics';

/** The four kinds of Missed-Chance Alert, each with its own per-Profile switch. */
export type MissedChanceKind = keyof KindSwitches;

export interface MissedChance {
  kind: MissedChanceKind;
  /** To be spoken: says what there is to find, never where or with which piece. */
  text: string;
}

/** A quick look is enough: the child is about to choose a move. */
const SEARCH = { depth: 10, timeMs: 300 } as const;

/** How much worse (in centipawns) than the best move taking may score and still count as a treat. */
const TREAT_WITHIN = 200;

const PIECE_KINDS: Partial<Record<PieceSymbol, MissedChanceKind>> = { q: 'queen', r: 'rook', b: 'bishopKnight', n: 'bishopKnight' };

const CHECKMATE_TEXT = 'Ooh! You can checkmate! Can you find it?';
const takeText = (piece: PieceSymbol) => `Ooh! You can take a ${PIECE_NAMES[piece]}! Can you find it?`;

/**
 * What good thing the side to move in `fen` (the child) could find, if any: checkmate first, then the
 * biggest free piece. Only kinds switched on are reported.
 */
export async function findMissedChance(
  fen: string,
  analyser: Analyser,
  switches: KindSwitches,
): Promise<MissedChance | undefined> {
  if (new Chess(fen).isGameOver()) return undefined;
  // A mate in one needs no second opinion.
  if (switches.checkmate && matesInOne(fen).length > 0) return { kind: 'checkmate', text: CHECKMATE_TEXT };

  const treats = freeCaptures(fen).filter((c) => switches[PIECE_KINDS[c.captured!]!]);
  if (treats.length === 0) return undefined;

  const best = await bestScore(analyser, fen);
  for (const capture of treats) {
    if (best === undefined || (await isWorthTaking(analyser, capture, best))) {
      return { kind: PIECE_KINDS[capture.captured!]!, text: takeText(capture.captured!) };
    }
  }
  return undefined;
}

/** Captures that win a queen, rook, bishop or knight, biggest target first. */
function freeCaptures(fen: string): Move[] {
  return winningCaptures(fen)
    .filter((c) => PIECE_KINDS[c.captured!])
    .sort((a, b) => PIECE_VALUES[b.captured!] - PIECE_VALUES[a.captured!]);
}

/** The best the side to move can do, by the analyser; undefined when it can't say. */
async function bestScore(analyser: Analyser, fen: string): Promise<number | undefined> {
  try {
    const [best] = await analyser.analyse(fen, SEARCH);
    return best && centipawns(best.score);
  } catch {
    return undefined;
  }
}

/** Whether taking scores about as well as the best move. When the analyser can't say, the piece check stands. */
async function isWorthTaking(analyser: Analyser, capture: Move, best: number): Promise<boolean> {
  try {
    const [reply] = await analyser.analyse(capture.after, SEARCH);
    if (!reply) return true;
    // The reply's score is from the Opponent's side.
    return -centipawns(reply.score) >= best - TREAT_WITHIN;
  } catch {
    return true;
  }
}

/** A mate counts as more than any material. */
function centipawns(score: Score): number {
  if ('cp' in score) return score.cp;
  return score.mate > 0 ? 10_000 : -10_000;
}
