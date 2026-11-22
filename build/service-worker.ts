/**
 * The offline service worker, written into the build as sw.js
 * (pattern from word-bots).
 *
 * - install: precache every build file into `kids-chess-<version>`,
 *   fetched fresh (not from the browser's HTTP cache), then take over.
 * - activate: delete older kids-chess caches only. Other apps on the
 *   same github.io origin (word-bots) keep theirs.
 * - fetch: pages network-first so a new deploy shows up, falling back
 *   to the cached page offline; everything else cache-first.
 */

export const CACHE_PREFIX = 'kids-chess-';

export interface ServiceWorkerOptions {
  version: string;
  urls: readonly string[];
}

export function serviceWorkerSource({ version, urls }: ServiceWorkerOptions): string {
  return `/* Generated at build time by build/service-worker.ts */
const PREFIX = ${JSON.stringify(CACHE_PREFIX)};
const CACHE = PREFIX + ${JSON.stringify(version)};
const FILES = ${JSON.stringify(urls)};

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(new URL(f, self.location).href, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('./', { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
`;
}
