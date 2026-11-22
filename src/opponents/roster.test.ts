import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { OPPONENTS, opponentById } from './roster';
import { seededRandom } from '../core/random';
import { createFakeAnalyser } from '../engine/fake-analyser';

const START = new Chess().fen();
/** Engine-backed Opponents get a scripted analyser, never real Stockfish. */
const tools = () => ({ random: seededRandom(1), analyser: createFakeAnalyser({ [START]: [['e2e4', { cp: 30 }]] }) });

describe('Opponent roster', () => {
  it('offers the Sleepy Snail, the Greedy Pig and the Dragon, weakest first', () => {
    expect(OPPONENTS.map((o) => o.name)).toEqual(['Sleepy Snail', 'Greedy Pig', 'Dragon']);
  });

  it('each has a fixed place on the six-step ladder: Snail weakest, Dragon strongest', () => {
    expect(OPPONENTS.map((o) => [o.id, o.strength])).toEqual([
      ['snail', 1],
      ['pig', 2],
      ['dragon', 6],
    ]);
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
