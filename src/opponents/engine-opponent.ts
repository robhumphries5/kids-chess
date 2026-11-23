import { Chess } from 'chess.js';
import type { AnalyseOptions, Analyser, Candidate, Score } from '../engine/analyser';
import { pickOne, type Random } from '../core/random';
import type { MoveChoice, Opponent, PromotionPiece } from './opponent';

/**
 * How an engine-backed Opponent plays. Fixed per character: nothing about past games goes in, so
 * it never secretly goes easy (or hard).
 */
export interface EngineStyle {
  id: string;
  name: string;
  /** The search for its ordinary moves: it plays the best move this search finds. */
  search: AnalyseOptions;
  /** The chance, each move, that it makes a big mistake instead. 0 for never. */
  mistakeRate: number;
}

/** A mistake gives away at least this much: about a bishop or a knight, or more. */
const BIG_MISTAKE_CP = 200;
/** A quick look at every legal move, to find the ones that give something away. */
const MISTAKE_DEPTH = 6;
/** A mate is worth more than any amount of material; a quicker mate more than a slower one. */
const MATE_CP = 100_000;

/** A score as centipawns for the side to move, with mates beyond any material. */
function centipawns(score: Score): number {
  if ('cp' in score) return score.cp;
  return score.mate > 0 ? MATE_CP - score.mate : -MATE_CP - score.mate;
}

/** An Opponent that plays the engine's best move, except for a big mistake at its fixed rate. */
export function createEngineOpponent(style: EngineStyle, analyser: Analyser, random: Random = Math.random): Opponent {
  return {
    id: style.id,
    name: style.name,
    async pickMove(fen) {
      const legal = new Chess(fen).moves({ verbose: true });
      const legalOnly = (candidates: Candidate[]) =>
        candidates.filter(({ move: m }) => legal.some((l) => l.from === m.from && l.to === m.to && l.promotion === m.promotion));
      try {
        if (random() < style.mistakeRate) {
          const seen = legalOnly(await analyser.analyse(fen, { depth: MISTAKE_DEPTH, candidates: legal.length }));
          const mistake = pickMistake(seen, random);
          if (mistake) return mistake;
        } else {
          const [best] = legalOnly(await analyser.analyse(fen, style.search));
          if (best) return best.move;
        }
      } catch {
        // The engine failed (say, it didn't load): fall through so the game can go on.
      }
      // Only if the engine can't answer. Better a weaker move than a game that never continues.
      const move = pickOne(legal, random);
      return { from: move.from, to: move.to, promotion: move.promotion as PromotionPiece | undefined };
    },
  };
}

/** A random move that gives a lot away, or, if none does, the worst move seen. */
function pickMistake(candidates: Candidate[], random: Random): MoveChoice | undefined {
  if (!candidates.length) return undefined;
  const scored = candidates.map((c) => ({ move: c.move, cp: centipawns(c.score) }));
  const best = Math.max(...scored.map((c) => c.cp));
  const big = scored.filter((c) => c.cp <= best - BIG_MISTAKE_CP);
  if (big.length) return pickOne(big, random).move;
  return scored.reduce((worst, c) => (c.cp < worst.cp ? c : worst)).move;
}
