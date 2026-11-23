import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { createPuppy } from './puppy';
import { createFakeAnalyser, type ScriptedCandidates } from '../engine/fake-analyser';
import type { Analyser } from '../engine/analyser';
import { seededRandom } from '../core/random';

const START = new Chess().fen();

/** The engine's view of the start: e4 is best, a few are fine, and some give a lot away. */
const START_CANDIDATES: ScriptedCandidates = [
  ['e2e4', { cp: 30 }],
  ['d2d4', { cp: 28 }],
  ['g1f3', { cp: 25 }],
  ['c2c4', { cp: 20 }],
  ['a2a3', { cp: -5 }],
  ['f2f3', { cp: -250 }],
  ['g2g4', { cp: -300 }],
];
const BAD = new Set(['f2f3', 'g2g4']);

const uci = (m: { from: string; to: string; promotion?: string }) => m.from + m.to + (m.promotion ?? '');

describe('Silly Puppy', () => {
  it('plays the engine’s best move, except for a big mistake about one move in three', async () => {
    const puppy = createPuppy(createFakeAnalyser({ [START]: START_CANDIDATES }), seededRandom(5));
    const runs = 600;
    let bad = 0;
    for (let i = 0; i < runs; i++) {
      const move = uci(await puppy.pickMove(START));
      if (BAD.has(move)) bad++;
      else expect(move).toBe('e2e4');
    }
    expect(bad / runs).toBeGreaterThan(0.28);
    expect(bad / runs).toBeLessThan(0.39);
  });

  it('its mistakes are big ones: never a move that is only a little worse', async () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const move = uci(await createPuppy(createFakeAnalyser({ [START]: START_CANDIDATES }), seededRandom(seed)).pickMove(START));
      seen.add(move);
    }
    expect(seen).toEqual(new Set(['e2e4', 'f2f3', 'g2g4']));
  });

  it('when nothing gives much away, its mistake is the worst move it can see', async () => {
    const calm: ScriptedCandidates = [
      ['e2e4', { cp: 30 }],
      ['d2d4', { cp: 28 }],
      ['a2a3', { cp: -10 }],
    ];
    const seen = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      seen.add(uci(await createPuppy(createFakeAnalyser({ [START]: calm }), seededRandom(seed)).pickMove(START)));
    }
    expect(seen).toEqual(new Set(['e2e4', 'a2a3']));
  });

  it('counts being checkmated as the biggest mistake of all', async () => {
    const fen = '4k3/8/8/8/8/8/5PPP/6K1 w - - 0 1';
    const candidates: ScriptedCandidates = [
      ['g1f1', { cp: 0 }],
      ['h2h3', { mate: -3 }],
      ['f2f3', { cp: -400 }],
    ];
    const seen = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      seen.add(uci(await createPuppy(createFakeAnalyser({ [fen]: candidates }), seededRandom(seed)).pickMove(fen)));
    }
    expect(seen).toEqual(new Set(['g1f1', 'h2h3', 'f2f3']));
  });

  it('asks the engine about every legal move when it is about to make a mistake', async () => {
    const analyser = createFakeAnalyser({ [START]: START_CANDIDATES });
    const puppy = createPuppy(analyser, seededRandom(5));
    for (let i = 0; i < 30; i++) await puppy.pickMove(START);
    const wide = analyser.calls.filter((c) => (c.options?.candidates ?? 1) > 1);
    expect(wide.length).toBeGreaterThan(0);
    for (const call of wide) expect(call.options?.candidates).toBe(20);
  });

  it('still plays a legal move if the engine fails, so the game is never stuck', async () => {
    const broken: Analyser = { analyse: () => Promise.reject(new Error('engine failed to load')) };
    for (let seed = 1; seed <= 10; seed++) {
      const choice = await createPuppy(broken, seededRandom(seed)).pickMove(START);
      expect(new Chess(START).move(choice)).toBeTruthy();
    }
  });

  it('never plays an illegal move, even if the engine suggests one', async () => {
    const analyser = createFakeAnalyser({ [START]: [['e2e5', { cp: 900 }], ['e1e3', { cp: -900 }]] });
    for (let seed = 1; seed <= 20; seed++) {
      const choice = await createPuppy(analyser, seededRandom(seed)).pickMove(START);
      expect(new Chess(START).move(choice)).toBeTruthy();
    }
  });
});
