import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { createDragon } from './dragon';
import { createFakeAnalyser } from '../engine/fake-analyser';
import type { Analyser } from '../engine/analyser';
import { seededRandom } from '../core/random';

const START = new Chess().fen();

describe('Dragon', () => {
  it('plays the engine’s best move', async () => {
    const analyser = createFakeAnalyser({
      [START]: [
        ['d2d4', { cp: 30 }],
        ['e2e4', { cp: 25 }],
      ],
    });
    expect(await createDragon(analyser).pickMove(START)).toEqual({ from: 'd2', to: 'd4' });
  });

  it('takes a checkmate the engine finds, including one by promoting', async () => {
    const fen = 'k7/2K1P3/8/8/8/8/8/8 w - - 0 1';
    const analyser = createFakeAnalyser({ [fen]: [['e7e8q', { mate: 1 }]] });
    expect(await createDragon(analyser).pickMove(fen)).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
  });

  it('thinks hard: a long, deep search every move, never a quick one', async () => {
    const analyser = createFakeAnalyser({ [START]: [['e2e4', { cp: 30 }]] });
    await createDragon(analyser).pickMove(START);
    expect(analyser.calls).toHaveLength(1);
    const { options } = analyser.calls[0];
    expect(options?.timeMs ?? 0).toBeGreaterThanOrEqual(1000);
    expect(options?.depth ?? Infinity).toBeGreaterThanOrEqual(15);
  });

  it('still plays a legal move if the engine fails, so the game is never stuck', async () => {
    const broken: Analyser = { analyse: () => Promise.reject(new Error('engine failed to load')) };
    const choice = await createDragon(broken, seededRandom(1)).pickMove(START);
    expect(new Chess(START).move(choice)).toBeTruthy();
  });

  it('never plays an illegal move, even if the engine suggests one', async () => {
    const analyser = createFakeAnalyser({ [START]: [['e2e5', { cp: 900 }]] });
    const choice = await createDragon(analyser, seededRandom(1)).pickMove(START);
    expect(new Chess(START).move(choice)).toBeTruthy();
  });
});
