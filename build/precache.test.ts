import { describe, expect, it } from 'vitest';
import { cacheVersion, precacheUrls } from './precache';

const bytes = (text: string) => new TextEncoder().encode(text);

describe('cacheVersion', () => {
  const build = [
    { path: 'index.html', bytes: bytes('<html>v1</html>') },
    { path: 'assets/index-abc.js', bytes: bytes('console.log(1)') },
  ];

  it('stays the same when the build is the same, whatever order files are listed in', () => {
    expect(cacheVersion([...build].reverse())).toBe(cacheVersion(build));
  });

  it('changes when any file changes, so a new deploy gets a fresh cache', () => {
    const changed = [build[0], { path: 'assets/index-abc.js', bytes: bytes('console.log(2)') }];
    expect(cacheVersion(changed)).not.toBe(cacheVersion(build));
  });

  it('changes when a file is added or renamed', () => {
    const added = [...build, { path: 'stockfish.wasm', bytes: bytes('') }];
    const renamed = [build[0], { path: 'assets/index-xyz.js', bytes: build[1].bytes }];
    expect(cacheVersion(added)).not.toBe(cacheVersion(build));
    expect(cacheVersion(renamed)).not.toBe(cacheVersion(build));
  });
});

describe('precacheUrls', () => {
  it('lists every build file relative to the page, with the page itself as ./', () => {
    const urls = precacheUrls([
      'index.html',
      'assets/index-abc123.js',
      'assets/index-def456.css',
      'stockfish/stockfish.wasm',
      'manifest.webmanifest',
    ]);
    expect(urls).toEqual([
      './',
      './assets/index-abc123.js',
      './assets/index-def456.css',
      './index.html',
      './manifest.webmanifest',
      './stockfish/stockfish.wasm',
    ]);
  });

  it('leaves out the service worker itself and source maps', () => {
    expect(precacheUrls(['index.html', 'sw.js', 'assets/index-abc.js.map'])).toEqual(['./', './index.html']);
  });

  it('uses forward slashes for files in folders, even on Windows', () => {
    expect(precacheUrls(['assets\\engine.worker.js'])).toEqual(['./', './assets/engine.worker.js']);
  });
});
