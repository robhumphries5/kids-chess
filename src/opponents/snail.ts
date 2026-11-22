import { Chess } from 'chess.js';
import { pickOne, type Random } from '../core/random';
import type { Opponent, PromotionPiece } from './opponent';

/** Sleepy Snail: plays a uniformly random legal move. */
export function createSnail(random: Random = Math.random): Opponent {
  return {
    id: 'snail',
    name: 'Sleepy Snail',
    async pickMove(fen) {
      const move = pickOne(new Chess(fen).moves({ verbose: true }), random);
      return { from: move.from, to: move.to, promotion: move.promotion as PromotionPiece | undefined };
    },
  };
}
