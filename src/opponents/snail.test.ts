import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { createSnail } from './snail';
import { seededRandom } from '../core/random';

/** Play a whole game of Snail against itself, checking every move is legal. */
async function playOut(seed: number, maxPlies = 200): Promise<string[]> {
  const snail = createSnail(seededRandom(seed));
  const chess = new Chess();
  const sans: string[] = [];
  while (!chess.isGameOver() && sans.length < maxPlies) {
    const legal = chess.moves({ verbose: true });
    const choice = await snail.pickMove(chess.fen());
    const match = legal.find((m) => m.from === choice.from && m.to === choice.to && m.promotion === choice.promotion);
    expect(match, `illegal move ${JSON.stringify(choice)} in ${chess.fen()}`).toBeDefined();
    sans.push(chess.move(choice).san);
  }
  return sans;
}

describe('Sleepy Snail', () => {
  it('only ever plays legal moves', async () => {
    for (let seed = 1; seed <= 5; seed++) await playOut(seed, 80);
  });

  it('is deterministic for a given seed', async () => {
    expect(await playOut(42, 40)).toEqual(await playOut(42, 40));
  });

  it('plays different moves with different seeds', async () => {
    const firstMoves = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) {
      const choice = await createSnail(seededRandom(seed)).pickMove(new Chess().fen());
      firstMoves.add(choice.from + choice.to);
    }
    // 20 legal first moves; a uniform pick over 50 seeds should hit plenty of them.
    expect(firstMoves.size).toBeGreaterThan(10);
  });

  it('picks a promotion piece when it promotes', async () => {
    // White can promote on b8 (four choices) or move the king.
    const fen = '7k/1P6/8/8/8/8/8/K7 w - - 0 1';
    const pieces = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const choice = await createSnail(seededRandom(seed)).pickMove(fen);
      if (choice.from === 'b7') pieces.add(choice.promotion ?? 'none');
    }
    expect(pieces.has('none')).toBe(false);
    expect(pieces.size).toBeGreaterThan(1);
  });
});
