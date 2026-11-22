import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { createPig } from './pig';
import { seededRandom } from '../core/random';

function isLegal(fen: string, choice: { from: string; to: string; promotion?: string }): boolean {
  return new Chess(fen)
    .moves({ verbose: true })
    .some((m) => m.from === choice.from && m.to === choice.to && m.promotion === choice.promotion);
}

describe('Greedy Pig', () => {
  it('always captures when a capture is available', async () => {
    // White's only captures: the rook on d1 can take the knight on d5, the bishop on b2 can take the pawn on g7.
    const fen = '4k3/6p1/8/3n4/8/8/1B6/3RK3 w - - 0 1';
    const captures = new Set(['d1d5', 'b2g7']);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const choice = await createPig(seededRandom(seed)).pickMove(fen);
      seen.add(choice.from + choice.to);
    }
    expect(seen).toEqual(captures);
  });

  it('captures with a promotion when that is its only capture, choosing a piece', async () => {
    // The pawn on b7 can take the rook on a8 (promoting); nothing else captures.
    const fen = 'r6k/1P6/8/8/8/8/8/1K6 w - - 0 1';
    for (let seed = 1; seed <= 10; seed++) {
      const choice = await createPig(seededRandom(seed)).pickMove(fen);
      expect(choice.from + choice.to).toBe('b7a8');
      expect(choice.promotion).toBeDefined();
    }
  });

  it('plays a legal move when there is nothing to capture', async () => {
    const fen = new Chess().fen();
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const choice = await createPig(seededRandom(seed)).pickMove(fen);
      expect(isLegal(fen, choice)).toBe(true);
      seen.add(choice.from + choice.to);
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it('only ever plays legal moves over a whole game', async () => {
    const pig = createPig(seededRandom(7));
    const chess = new Chess();
    for (let ply = 0; ply < 120 && !chess.isGameOver(); ply++) {
      const fen = chess.fen();
      const choice = await pig.pickMove(fen);
      expect(isLegal(fen, choice), `illegal ${JSON.stringify(choice)} in ${fen}`).toBe(true);
      chess.move(choice);
    }
  });

  it('is deterministic for a given seed', async () => {
    const fen = '4k3/6p1/8/3n4/8/8/1B6/3RK3 w - - 0 1';
    const a = await createPig(seededRandom(3)).pickMove(fen);
    const b = await createPig(seededRandom(3)).pickMove(fen);
    expect(a).toEqual(b);
  });
});
