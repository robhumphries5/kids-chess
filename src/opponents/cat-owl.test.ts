import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { createCat } from './cat';
import { createOwl } from './owl';
import { createFakeAnalyser, type ScriptedCandidates } from '../engine/fake-analyser';
import type { Analyser } from '../engine/analyser';
import { seededRandom } from '../core/random';

const START = new Chess().fen();
const START_CANDIDATES: ScriptedCandidates = [
  ['e2e4', { cp: 30 }],
  ['d2d4', { cp: 28 }],
  ['g2g4', { cp: -300 }],
];
const uci = (m: { from: string; to: string; promotion?: string }) => m.from + m.to + (m.promotion ?? '');

/** Play `moves` moves from the start and count the big mistakes (g4). */
async function mistakes(create: (a: Analyser) => { pickMove(fen: string): Promise<{ from: string; to: string }> }, moves: number) {
  const analyser = createFakeAnalyser({ [START]: START_CANDIDATES });
  const opponent = create(analyser);
  let count = 0;
  for (let i = 0; i < moves; i++) if (uci(await opponent.pickMove(START)) === 'g2g4') count++;
  return { count, analyser };
}

describe('Clever Cat', () => {
  it('plays the best move from the weakest, one-ply search', async () => {
    const analyser = createFakeAnalyser({ [START]: START_CANDIDATES });
    const cat = createCat(analyser, () => 0.99);
    expect(await cat.pickMove(START)).toEqual({ from: 'e2', to: 'e4' });
    expect(analyser.calls[0].options).toEqual({ depth: 1 });
  });

  it('makes an occasional big mistake: about one move in eight', async () => {
    const { count } = await mistakes((a) => createCat(a, seededRandom(11)), 800);
    expect(count / 800).toBeGreaterThan(0.08);
    expect(count / 800).toBeLessThan(0.17);
  });

  it('keeps the same settings move after move, however the games go', async () => {
    const { analyser } = await mistakes((a) => createCat(a, seededRandom(3)), 200);
    const ordinary = analyser.calls.filter((c) => (c.options?.candidates ?? 1) === 1);
    expect(ordinary.length).toBeGreaterThan(150);
    for (const call of ordinary) expect(call.options).toEqual({ depth: 1 });
  });
});

describe('Wise Owl', () => {
  it('plays the best move from a short, fixed-depth search', async () => {
    const analyser = createFakeAnalyser({ [START]: START_CANDIDATES });
    expect(await createOwl(analyser, seededRandom(1)).pickMove(START)).toEqual({ from: 'e2', to: 'e4' });
    expect(analyser.calls[0].options).toEqual({ depth: 5 });
  });

  it('never makes a deliberate mistake, and keeps the same settings every move', async () => {
    const { count, analyser } = await mistakes((a) => createOwl(a, seededRandom(4)), 200);
    expect(count).toBe(0);
    for (const call of analyser.calls) expect(call.options).toEqual({ depth: 5 });
  });

  it('is stronger than the Cat: it searches deeper', async () => {
    const catCalls = createFakeAnalyser({ [START]: START_CANDIDATES });
    const owlCalls = createFakeAnalyser({ [START]: START_CANDIDATES });
    await createCat(catCalls, () => 0.99).pickMove(START);
    await createOwl(owlCalls).pickMove(START);
    expect(owlCalls.calls[0].options!.depth!).toBeGreaterThan(catCalls.calls[0].options!.depth!);
  });
});
