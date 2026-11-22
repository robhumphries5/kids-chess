/// <reference types="node" />
// The one suite that runs real Stockfish (the same lite single-threaded build the app bundles, via its
// Node entry point) to check the UCI analyser speaks its language. Everything else uses the fake.
import { createRequire } from 'node:module';
import { afterAll, describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { createUciAnalyser, type UciEngine } from './uci-analyser';

interface NodeStockfish {
  listener: (line: string) => void;
  processCommand(command: string): void;
  terminate(): void;
}

const loadStockfish = createRequire(import.meta.url)('stockfish') as (flavour: string) => NodeStockfish;
const stockfish = loadStockfish('lite-single');
const engine: UciEngine = {
  send: (command) => stockfish.processCommand(command),
  onLine: (callback) => {
    stockfish.listener = callback;
  },
};
const analyser = createUciAnalyser(engine, { timeoutMs: 20_000 });

afterAll(() => stockfish.terminate());

describe('UCI analyser with real Stockfish', () => {
  it('finds a checkmate in one, scored as mate', async () => {
    // White to play: Qg7 is mate (the queen is guarded by the king on f6).
    const fen = '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1';
    const [best] = await analyser.analyse(fen, { depth: 8 });
    const chess = new Chess(fen);
    chess.move(best.move);
    expect(chess.isCheckmate()).toBe(true);
    expect(best.score).toEqual({ mate: 1 });
  }, 30_000);

  it('gives several legal candidates when asked, best first', async () => {
    const fen = new Chess().fen();
    const candidates = await analyser.analyse(fen, { depth: 6, candidates: 3 });
    expect(candidates).toHaveLength(3);
    for (const c of candidates) expect(new Chess(fen).move(c.move)).toBeTruthy();
    const cps = candidates.map((c) => ('cp' in c.score ? c.score.cp : NaN));
    expect([...cps].sort((a, b) => b - a)).toEqual(cps);
  }, 30_000);
});
