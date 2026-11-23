import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { deliversCheckmate } from './mate-in-one';

// White: Kg6, Qa7. Black: Kh8. Four different mates: Qa8, Qb8, Qg7 and Qh7.
const FOUR_MATES = '7k/Q7/6K1/8/8/8/8/8 w - - 0 1';

describe('"Checkmate in one!" goal', () => {
  it('every checkmating move meets the goal, not just one stored answer', () => {
    for (const to of ['a8', 'b8', 'g7', 'h7']) {
      expect(deliversCheckmate(FOUR_MATES, { from: 'a7', to }), to).toBe(true);
    }
  });

  it('a check that is not mate does not', () => {
    expect(new Chess(FOUR_MATES).move({ from: 'a7', to: 'd4' }).san).toBe('Qd4+');
    expect(deliversCheckmate(FOUR_MATES, { from: 'a7', to: 'd4' })).toBe(false);
  });

  it('a move that gives no check does not', () => {
    expect(deliversCheckmate(FOUR_MATES, { from: 'a7', to: 'a6' })).toBe(false);
  });

  it('an illegal move does not', () => {
    expect(deliversCheckmate(FOUR_MATES, { from: 'a7', to: 'h1' })).toBe(false);
    expect(deliversCheckmate(FOUR_MATES, { from: 'g6', to: 'g7' })).toBe(false);
  });

  it('a back-rank mate with a rook counts', () => {
    const backRank = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1';
    expect(deliversCheckmate(backRank, { from: 'a1', to: 'a8' })).toBe(true);
  });

  it('works for black to move as well', () => {
    const blackToMove = 'r5k1/8/8/8/8/8/5PPP/6K1 b - - 0 1';
    expect(deliversCheckmate(blackToMove, { from: 'a8', to: 'a1' })).toBe(true);
  });
});
