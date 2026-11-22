import type { MoveChoice, PromotionPiece } from '../opponents/opponent';

/**
 * The engine analyser seam: "analyse this position → scored candidate moves". The production version
 * is Stockfish in a Web Worker (`stockfish-analyser.ts`); tests use `createFakeAnalyser`. Nothing
 * outside `src/engine/` talks to Stockfish directly.
 */
export interface Analyser {
  /** Candidate moves for the side to move in `fen`, best first. Empty when there are no legal moves. */
  analyse(fen: string, options?: AnalyseOptions): Promise<Candidate[]>;
}

export interface AnalyseOptions {
  /** Search no deeper than this many plies. */
  depth?: number;
  /** Search for at most this long. */
  timeMs?: number;
  /** How many candidate moves to return (the engine's MultiPV). Defaults to 1. */
  candidates?: number;
}

export interface Candidate {
  move: MoveChoice;
  score: Score;
}

/**
 * From the point of view of the side to move: `cp` in centipawns (100 ≈ a pawn), or `mate` in that
 * many moves (positive: the side to move mates; negative: it gets mated).
 */
export type Score = { cp: number } | { mate: number };

/** A move in UCI notation (e.g. 'e2e4', 'e7e8q') as squares. */
export function moveFromUci(uci: string): MoveChoice {
  const move: MoveChoice = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
  if (uci.length > 4) move.promotion = uci[4] as PromotionPiece;
  return move;
}
