import { moveFromUci, type AnalyseOptions, type Analyser, type Candidate, type Score } from './analyser';

/** Scripted candidates for one position, best first, as [UCI move, score]: e.g. ['e7e8q', { mate: 1 }]. */
export type ScriptedCandidates = readonly (readonly [uci: string, score: Score])[];

export interface FakeAnalyser extends Analyser {
  /** Every analyse call, in order. */
  calls: { fen: string; options?: AnalyseOptions }[];
}

/**
 * The test double for the engine analyser: answers from a script of positions (by FEN) instead of
 * running Stockfish. A position not in the script has no candidates. Answers are cut to the
 * number of candidates asked for (default 1), as the real engine would.
 */
export function createFakeAnalyser(script: Readonly<Record<string, ScriptedCandidates>>): FakeAnalyser {
  const calls: FakeAnalyser['calls'] = [];
  return {
    calls,
    async analyse(fen, options) {
      calls.push({ fen, options });
      const scripted = script[fen] ?? [];
      return scripted.slice(0, options?.candidates ?? 1).map(([uci, score]): Candidate => ({ move: moveFromUci(uci), score }));
    },
  };
}
