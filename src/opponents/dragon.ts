import { Chess } from 'chess.js';
import type { Analyser } from '../engine/analyser';
import { pickOne, type Random } from '../core/random';
import type { MoveChoice, Opponent, PromotionPiece } from './opponent';

/** Dragon's search: long and deep enough to be a real challenge for a grown-up. */
const DRAGON_SEARCH = { timeMs: 1500, depth: 18 } as const;

/** Dragon: the strongest Opponent. Plays the engine's best move after a full search, every move. */
export function createDragon(analyser: Analyser, random: Random = Math.random): Opponent {
  return {
    id: 'dragon',
    name: 'Dragon',
    async pickMove(fen) {
      const legal = new Chess(fen).moves({ verbose: true });
      const isLegal = (m: MoveChoice) => legal.some((l) => l.from === m.from && l.to === m.to && l.promotion === m.promotion);
      try {
        const [best] = await analyser.analyse(fen, DRAGON_SEARCH);
        if (best && isLegal(best.move)) return best.move;
      } catch {
        // The engine failed (say, it didn't load): fall through so the game can go on.
      }
      // Only if the engine can't answer. Better a weaker move than a game that never continues.
      const move = pickOne(legal, random);
      return { from: move.from, to: move.to, promotion: move.promotion as PromotionPiece | undefined };
    },
  };
}
