import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { OPPONENTS, opponentById } from './roster';
import { seededRandom } from '../core/random';
import { createFakeAnalyser } from '../engine/fake-analyser';
import { pointsForResult } from '../core/game-rewards';

const START = new Chess().fen();
/** Engine-backed Opponents get a scripted analyser, never real Stockfish. */
const tools = () => ({ random: seededRandom(1), analyser: createFakeAnalyser({ [START]: [['e2e4', { cp: 30 }]] }) });

describe('Opponent roster', () => {
  it('offers all six Opponents, weakest first', () => {
    expect(OPPONENTS.map((o) => o.name)).toEqual(['Sleepy Snail', 'Greedy Pig', 'Silly Puppy', 'Clever Cat', 'Wise Owl', 'Dragon']);
  });

  it('each has a fixed place on the six-step ladder: Snail weakest, Dragon strongest', () => {
    expect(OPPONENTS.map((o) => [o.id, o.strength])).toEqual([
      ['snail', 1],
      ['pig', 2],
      ['puppy', 3],
      ['cat', 4],
      ['owl', 5],
      ['dragon', 6],
    ]);
  });

  it('beating each one earns Points on the strength scale: Snail 50 up to Dragon 175', () => {
    expect(OPPONENTS.map((o) => [o.id, pointsForResult('won', o.strength)])).toEqual([
      ['snail', 50],
      ['pig', 75],
      ['puppy', 100],
      ['cat', 125],
      ['owl', 150],
      ['dragon', 175],
    ]);
  });

  it('the engine Opponents ask their analyser for a move', async () => {
    for (const id of ['puppy', 'cat', 'owl']) {
      const analyser = createFakeAnalyser({ [START]: [['g1f3', { cp: 25 }]] });
      const choice = await opponentById(id)!.create({ analyser, random: () => 0.99 }).pickMove(START);
      expect(choice).toEqual({ from: 'g1', to: 'f3' });
      expect(analyser.calls).toHaveLength(1);
    }
  });

  it('each character makes an Opponent with its own id and name', () => {
    for (const character of OPPONENTS) {
      const opponent = character.create(tools());
      expect(opponent.id).toBe(character.id);
      expect(opponent.name).toBe(character.name);
    }
  });

  it('every Opponent plays a legal opening move', async () => {
    const fen = START;
    for (const character of OPPONENTS) {
      const choice = await character.create(tools()).pickMove(fen);
      expect(new Chess(fen).move(choice)).toBeTruthy();
    }
  });

  it('the Dragon plays the move its analyser rates best', async () => {
    const analyser = createFakeAnalyser({ [START]: [['g1f3', { cp: 25 }]] });
    const choice = await opponentById('dragon')!.create({ analyser }).pickMove(START);
    expect(choice).toEqual({ from: 'g1', to: 'f3' });
    expect(analyser.calls).toHaveLength(1);
  });

  it('finds a character by id, and nothing for an unknown id', () => {
    expect(opponentById('pig')?.name).toBe('Greedy Pig');
    expect(opponentById('unicorn')).toBeUndefined();
  });
});
