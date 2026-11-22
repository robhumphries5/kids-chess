import { moveFromUci, type AnalyseOptions, type Analyser, type Candidate, type Score } from './analyser';

/** A UCI engine as a text pipe: commands in, output lines out. Stockfish's Worker is one. */
export interface UciEngine {
  send(command: string): void;
  onLine(callback: (line: string) => void): void;
}

export interface UciAnalyserOptions {
  /** How long a search may take beyond its own time limit before it is given up as failed. */
  timeoutMs?: number;
}

/**
 * An Analyser that speaks UCI to `engine`. Searches run one at a time, in the order asked for. A
 * search the engine never finishes (say, the engine failed to load) rejects after a timeout.
 */
export function createUciAnalyser(engine: UciEngine, { timeoutMs = 10_000 }: UciAnalyserOptions = {}): Analyser {
  let waiting: { until: (line: string) => boolean; resolve: () => void } | undefined;
  let collect: ((line: string) => void) | undefined;

  engine.onLine((line) => {
    collect?.(line);
    if (waiting?.until(line)) {
      const { resolve } = waiting;
      waiting = undefined;
      resolve();
    }
  });

  /** Send `command` and wait for the line that answers it. */
  function ask(command: string, until: (line: string) => boolean): Promise<void> {
    return new Promise((resolve) => {
      waiting = { until, resolve };
      engine.send(command);
    });
  }

  let ready: Promise<void> | undefined;
  let queue: Promise<unknown> = Promise.resolve();

  async function search(fen: string, options: AnalyseOptions): Promise<Candidate[]> {
    ready ??= ask('uci', (l) => l === 'uciok');
    await ready;
    engine.send(`setoption name MultiPV value ${options.candidates ?? 1}`);
    await ask('isready', (l) => l === 'readyok');
    engine.send(`position fen ${fen}`);

    const byRank = new Map<number, Candidate>();
    collect = (line) => {
      const info = parseInfo(line);
      if (info) byRank.set(info.rank, info.candidate);
    };
    await ask(goCommand(options), (l) => l.startsWith('bestmove'));
    collect = undefined;
    return [...byRank.entries()].sort(([a], [b]) => a - b).map(([, c]) => c);
  }

  /** `search`, or an error if the engine hasn't answered in time. Afterwards the engine is reset. */
  function searchInTime(fen: string, options: AnalyseOptions): Promise<Candidate[]> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        waiting = undefined;
        collect = undefined;
        ready = undefined;
        engine.send('stop');
        reject(new Error('The chess engine did not answer in time'));
      }, timeoutMs + (options.timeMs ?? 0));
    });
    return Promise.race([search(fen, options), timeout]).finally(() => clearTimeout(timer));
  }

  return {
    analyse(fen, options = {}) {
      const result = queue.then(() => searchInTime(fen, options));
      queue = result.catch(() => {});
      return result;
    },
  };
}

function goCommand({ depth, timeMs }: AnalyseOptions): string {
  const limits = [depth !== undefined ? `depth ${depth}` : '', timeMs !== undefined ? `movetime ${timeMs}` : ''];
  const parts = limits.filter(Boolean);
  return parts.length ? `go ${parts.join(' ')}` : 'go depth 10';
}

/** One `info … multipv N score … pv …` line as a ranked candidate; other lines give nothing. */
function parseInfo(line: string): { rank: number; candidate: Candidate } | undefined {
  if (!line.startsWith('info ')) return undefined;
  const words = line.split(' ');
  const at = (key: string) => words.indexOf(key);
  const pvAt = at('pv');
  const scoreAt = at('score');
  if (pvAt < 0 || scoreAt < 0 || !words[pvAt + 1]) return undefined;
  const value = Number(words[scoreAt + 2]);
  const score: Score = words[scoreAt + 1] === 'mate' ? { mate: value } : { cp: value };
  const rank = at('multipv') >= 0 ? Number(words[at('multipv') + 1]) : 1;
  return { rank, candidate: { move: moveFromUci(words[pvAt + 1]), score } };
}
