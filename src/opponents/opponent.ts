/** A move as squares, e.g. { from: 'e2', to: 'e4' }. `promotion` is set only for pawn promotions. */
export interface MoveChoice {
  from: string;
  to: string;
  promotion?: PromotionPiece;
}

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

/**
 * The common move-picking interface every Opponent implements.
 * Asynchronous so engine-backed Opponents (Stockfish in a Worker) fit the same shape.
 */
export interface Opponent {
  id: string;
  name: string;
  /** Pick a legal move for the side to move in `fen`. */
  pickMove(fen: string): Promise<MoveChoice>;
}
