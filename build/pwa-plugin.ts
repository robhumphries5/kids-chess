/// <reference types="node" />
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';
import { cacheVersion, precacheUrls, SERVICE_WORKER_FILE, type BuildFile } from './precache.ts';
import { serviceWorkerSource } from './service-worker.ts';

/**
 * After the build is written, lists every file in the output folder
 * (bundled code, worker and WASM files, and everything copied from
 * public/) and writes sw.js to precache them all.
 */
export function offlineServiceWorker(): Plugin {
  return {
    name: 'kids-chess-offline',
    apply: 'build',
    writeBundle(options) {
      const outDir = options.dir!;
      const files: BuildFile[] = listFiles(outDir)
        .map((full) => ({ path: relative(outDir, full).split('\\').join('/'), bytes: readFileSync(full) }))
        .filter((f) => f.path !== SERVICE_WORKER_FILE);
      const urls = precacheUrls(files.map((f) => f.path));
      const cached = files.filter((f) => urls.includes('./' + f.path));
      const source = serviceWorkerSource({ version: cacheVersion(cached), urls });
      writeFileSync(join(outDir, SERVICE_WORKER_FILE), source);
    },
  };
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}
