/**
 * Pure helpers for the offline service worker: which build files to
 * precache, and a version that changes whenever any of them changes.
 * Paths are relative to the build output folder.
 */

/** Precache URLs, relative to the page so the GitHub Pages sub-path works. */
export function precacheUrls(paths: readonly string[]): string[] {
  const files = paths
    .map((p) => p.split('\\').join('/'))
    .filter((p) => p !== SERVICE_WORKER_FILE && !p.endsWith('.map'))
    .map((p) => './' + p);
  return ['./', ...files.sort()];
}

/** The service worker's own file name in the build output. */
export const SERVICE_WORKER_FILE = 'sw.js';

export interface BuildFile {
  path: string;
  bytes: Uint8Array;
}

/**
 * A short hash of every file's path and contents (FNV-1a, 32-bit).
 * Same build, same version; any change, new version, so the browser
 * installs a fresh cache and drops the old one.
 */
export function cacheVersion(files: readonly BuildFile[]): string {
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  let hash = 0x811c9dc5;
  const mix = (byte: number) => {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  };
  const encoder = new TextEncoder();
  for (const file of sorted) {
    for (const b of encoder.encode(file.path)) mix(b);
    mix(0);
    for (const b of file.bytes) mix(b);
    mix(0);
  }
  return (hash >>> 0).toString(36);
}
