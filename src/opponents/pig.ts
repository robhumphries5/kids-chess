import { Chess } from 'chess.js';
import { pickOne, type Random } from '../core/random';
import type { Opponent, PromotionPiece } from './opponent';

/** Greedy Pig: a random capture if there is one, else a random legal move. */
export function createPig(random: Random = Math.random): Opponent {
  return {
    id: 'pig',
    name: 'Greedy Pig',
    async pickMove(fen) {
      const moves = new Chess(fen).moves({ verbose: true });
      const captures = moves.filter((m) => m.isCapture());
      const move = pickOne(captures.length ? captures : moves, random);
      return { from: move.from, to: move.to, promotion: move.promotion as PromotionPiece | undefined };
    },
  };
}
