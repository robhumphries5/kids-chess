/// <reference types="node" />
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { engineFiles } from './stockfish-plugin';
import { ENGINE_DIR, ENGINE_SCRIPT } from '../src/engine/engine-files';

describe('Stockfish engine files in the build', () => {
  const files = engineFiles();

  it('copies the engine script the app starts its Worker from', () => {
    expect(files.map((f) => f.fileName)).toContain(`${ENGINE_DIR}/${ENGINE_SCRIPT}`);
  });

  it('puts the WASM where the engine script looks for it: same place, .wasm for .js', () => {
    const wasm = `${ENGINE_DIR}/${ENGINE_SCRIPT}`.replace(/\.js$/, '.wasm');
    expect(files.map((f) => f.fileName)).toContain(wasm);
  });

  it('ships the licence with the engine', () => {
    expect(files.some((f) => /copying/i.test(f.fileName))).toBe(true);
  });

  it('finds every file in the installed stockfish package', () => {
    for (const f of files) expect(existsSync(f.sourcePath), f.sourcePath).toBe(true);
  });

  it('keeps the engine small: a lite build, not the 90 MB full one', async () => {
    const { statSync } = await import('node:fs');
    const total = files.reduce((sum, f) => sum + statSync(f.sourcePath).size, 0);
    expect(total).toBeLessThan(5 * 1024 * 1024);
  });
});
