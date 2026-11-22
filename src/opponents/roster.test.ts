import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { OPPONENTS, opponentById } from './roster';
import { seededRandom } from '../core/random';

describe('Opponent roster', () => {
  it('offers the Sleepy Snail and the Greedy Pig, weakest first', () => {
    expect(OPPONENTS.map((o) => o.name)).toEqual(['Sleepy Snail', 'Greedy Pig']);
  });

  it('each character makes an Opponent with its own id and name', () => {
    for (const character of OPPONENTS) {
      const opponent = character.create(seededRandom(1));
      expect(opponent.id).toBe(character.id);
      expect(opponent.name).toBe(character.name);
    }
  });

  it('every Opponent plays a legal opening move', async () => {
    const fen = new Chess().fen();
    for (const character of OPPONENTS) {
      const choice = await character.create(seededRandom(1)).pickMove(fen);
      expect(new Chess(fen).move(choice)).toBeTruthy();
    }
  });

  it('finds a character by id, and nothing for an unknown id', () => {
    expect(opponentById('pig')?.name).toBe('Greedy Pig');
    expect(opponentById('unicorn')).toBeUndefined();
  });
});
