/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Plugin } from 'vite';
import { ENGINE_DIR, ENGINE_LICENCE, ENGINE_SCRIPT, ENGINE_WASM } from '../src/engine/engine-files.ts';

export interface EngineFile {
  /** Path in the build output (and on the dev server), relative to the page. */
  fileName: string;
  /** Where it is in node_modules. */
  sourcePath: string;
}

/** The Stockfish files the app needs, from the installed `stockfish` package. */
export function engineFiles(): EngineFile[] {
  const resolve = createRequire(import.meta.url).resolve;
  return [
    { fileName: `${ENGINE_DIR}/${ENGINE_SCRIPT}`, sourcePath: resolve(`stockfish/bin/${ENGINE_SCRIPT}`) },
    { fileName: `${ENGINE_DIR}/${ENGINE_WASM}`, sourcePath: resolve(`stockfish/bin/${ENGINE_WASM}`) },
    { fileName: `${ENGINE_DIR}/${ENGINE_LICENCE}`, sourcePath: resolve(`stockfish/${ENGINE_LICENCE}`) },
  ];
}

const CONTENT_TYPES: Record<string, string> = { js: 'text/javascript', wasm: 'application/wasm', txt: 'text/plain' };

/**
 * Copies Stockfish into the build under `engine/`, so it is served from our own origin (no CDN) and
 * the offline service worker precaches it with everything else. The dev server serves the same paths.
 */
export function stockfishEngine(): Plugin {
  const files = engineFiles();
  return {
    name: 'kids-chess-stockfish',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = new URL(req.url ?? '/', 'http://dev').pathname;
        const file = files.find((f) => path.endsWith('/' + f.fileName));
        if (!file) return next();
        res.setHeader('Content-Type', CONTENT_TYPES[file.fileName.split('.').pop()!] ?? 'application/octet-stream');
        res.end(readFileSync(file.sourcePath));
      });
    },
    generateBundle() {
      for (const f of files) this.emitFile({ type: 'asset', fileName: f.fileName, source: readFileSync(f.sourcePath) });
    },
  };
}
