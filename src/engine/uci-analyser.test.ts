import { describe, expect, it, vi } from 'vitest';
import { createUciAnalyser, type UciEngine } from './uci-analyser';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * A pretend UCI engine: `reply` maps each command to the lines it prints back (asynchronously, as a
 * Worker would). Every command received is recorded in `sent`.
 */
function scriptedEngine(reply: (command: string) => string[]): UciEngine & { sent: string[] } {
  let listener: (line: string) => void = () => {};
  const sent: string[] = [];
  return {
    sent,
    send(command) {
      sent.push(command);
      const lines = reply(command);
      setTimeout(() => lines.forEach((l) => listener(l)));
    },
    onLine(callback) {
      listener = callback;
    },
  };
}

/** Answers the handshake; `go` prints `search` lines. */
function engineThatSearches(search: string[]) {
  return scriptedEngine((command) => {
    if (command === 'uci') return ['id name Fake', 'uciok'];
    if (command === 'isready') return ['readyok'];
    if (command.startsWith('go')) return search;
    return [];
  });
}

describe('UCI analyser', () => {
  it('returns scored candidate moves for a position, best first', async () => {
    const engine = engineThatSearches([
      'info depth 1 seldepth 1 multipv 1 score cp 20 nodes 20 pv d2d4',
      'info depth 1 seldepth 1 multipv 2 score cp 10 nodes 20 pv g1f3',
      'info depth 2 seldepth 2 multipv 1 score cp 35 nodes 90 pv e2e4 e7e5',
      'info depth 2 seldepth 2 multipv 2 score cp 30 nodes 90 pv d2d4 d7d5',
      'bestmove e2e4 ponder e7e5',
    ]);
    const candidates = await createUciAnalyser(engine).analyse(START, { candidates: 2 });
    expect(candidates).toEqual([
      { move: { from: 'e2', to: 'e4' }, score: { cp: 35 } },
      { move: { from: 'd2', to: 'd4' }, score: { cp: 30 } },
    ]);
  });

  it('sends the position and search limits to the engine', async () => {
    const engine = engineThatSearches(['info depth 1 multipv 1 score cp 0 pv e2e4', 'bestmove e2e4']);
    await createUciAnalyser(engine).analyse(START, { depth: 12, timeMs: 800, candidates: 3 });
    expect(engine.sent).toContain('setoption name MultiPV value 3');
    expect(engine.sent).toContain(`position fen ${START}`);
    expect(engine.sent).toContain('go depth 12 movetime 800');
  });

  it('reports mate scores and promotions', async () => {
    const engine = engineThatSearches([
      'info depth 3 multipv 1 score mate 1 pv b7b8q',
      'info depth 3 multipv 2 score mate -2 pv b7b8n a1a2',
      'bestmove b7b8q',
    ]);
    const candidates = await createUciAnalyser(engine).analyse('k7/1P6/8/8/8/8/8/K7 w - - 0 1', { candidates: 2 });
    expect(candidates).toEqual([
      { move: { from: 'b7', to: 'b8', promotion: 'q' }, score: { mate: 1 } },
      { move: { from: 'b7', to: 'b8', promotion: 'n' }, score: { mate: -2 } },
    ]);
  });

  it('returns no candidates when the side to move has no moves', async () => {
    const engine = engineThatSearches(['info depth 0 score mate 0', 'bestmove (none)']);
    expect(await createUciAnalyser(engine).analyse('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1')).toEqual([]);
  });

  it('runs searches one after another, each with its own answer', async () => {
    let searches = 0;
    const engine = scriptedEngine((command) => {
      if (command === 'uci') return ['uciok'];
      if (command === 'isready') return ['readyok'];
      if (command.startsWith('go')) {
        searches++;
        return searches === 1
          ? ['info depth 5 multipv 1 score cp 40 pv e2e4', 'bestmove e2e4']
          : ['info depth 5 multipv 1 score cp -10 pv g8f6', 'bestmove g8f6'];
      }
      return [];
    });
    const analyser = createUciAnalyser(engine);
    const [first, second] = await Promise.all([analyser.analyse(START), analyser.analyse(START)]);
    expect(first).toEqual([{ move: { from: 'e2', to: 'e4' }, score: { cp: 40 } }]);
    expect(second).toEqual([{ move: { from: 'g8', to: 'f6' }, score: { cp: -10 } }]);
    expect(engine.sent.filter((c) => c === 'uci')).toHaveLength(1);
  });

  it('gives up with an error if the engine never answers, so a game is not stuck waiting', async () => {
    vi.useFakeTimers();
    try {
      const silent = scriptedEngine(() => []);
      const result = createUciAnalyser(silent, { timeoutMs: 5000 }).analyse(START);
      const failed = expect(result).rejects.toThrow(/engine/i);
      await vi.advanceTimersByTimeAsync(5001);
      await failed;
    } finally {
      vi.useRealTimers();
    }
  });
});
