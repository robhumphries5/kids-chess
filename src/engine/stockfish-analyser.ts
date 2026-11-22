// The production engine analyser: Stockfish in a Web Worker, so searching never freezes the board.
// The engine files are copied into the build by build/stockfish-plugin.ts (no CDN), so the offline
// service worker precaches them like everything else.
import type { Analyser } from './analyser';
import { ENGINE_DIR, ENGINE_SCRIPT } from './engine-files';
import { createUciAnalyser, type UciEngine } from './uci-analyser';

/**
 * An Analyser backed by Stockfish. The Worker is only started on the first search, so creating one
 * costs nothing until an engine Opponent actually needs it. If the Worker fails, the next search
 * starts a fresh one.
 */
export function createStockfishAnalyser(): Analyser {
  let analyser: Analyser | undefined;
  return {
    analyse(fen, options) {
      analyser ??= createUciAnalyser(
        stockfishWorker(() => {
          analyser = undefined;
        }),
      );
      return analyser.analyse(fen, options);
    },
  };
}

let shared: Analyser | undefined;

/** One Stockfish for the whole app: Opponents share it rather than each loading their own. */
export function sharedStockfish(): Analyser {
  return (shared ??= createStockfishAnalyser());
}

function stockfishWorker(onFailed: () => void): UciEngine {
  // Relative to the page, so it works under the GitHub Pages sub-path. The engine finds its WASM next to it.
  const worker = new Worker(new URL(`${ENGINE_DIR}/${ENGINE_SCRIPT}`, document.baseURI));
  let listener: (line: string) => void = () => {};
  worker.onmessage = (e: MessageEvent) => {
    // The engine also posts non-text download progress; only text lines are UCI output.
    if (typeof e.data === 'string') listener(e.data);
  };
  worker.onerror = () => {
    worker.terminate();
    onFailed();
  };
  return {
    send: (command) => worker.postMessage(command),
    onLine: (callback) => {
      listener = callback;
    },
  };
}
