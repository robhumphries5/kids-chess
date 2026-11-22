import { describe, expect, it } from 'vitest';
import { serviceWorkerSource } from './service-worker';

const ORIGIN = 'https://example.github.io';
const SCOPE = ORIGIN + '/kids-chess/';

type Listener = (event: FakeEvent) => void;

/** What a fetch event's request looks like (Node can't build a navigate Request). */
interface FakeRequest {
  url: string;
  method: string;
  mode: string;
}

interface FakeEvent {
  request?: FakeRequest;
  waitUntil(p: Promise<unknown>): void;
  respondWith(p: Promise<Response | undefined>): void;
}

/** A tiny service worker world: named caches, a network that can go down. */
function world(existingCaches: string[] = []) {
  const stores = new Map<string, Map<string, string>>();
  for (const name of existingCaches) stores.set(name, new Map());
  const listeners = new Map<string, Listener>();
  const network = new Map<string, string>();
  const fetched: Request[] = [];
  let online = true;
  let skippedWaiting = false;
  let claimed = false;

  const fetchFake = async (input: Request | FakeRequest | string, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(typeof input === 'string' ? input : input.url, init);
    fetched.push(request);
    if (!online) throw new TypeError('Failed to fetch');
    const body = network.get(request.url);
    return body === undefined ? new Response('missing', { status: 404 }) : new Response(body);
  };

  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      async addAll(requests: (Request | string)[]) {
        for (const r of requests) {
          const response = await fetchFake(r);
          if (!response.ok) throw new TypeError('addAll failed');
          store.set(new Request(r instanceof Request ? r.url : new URL(r, SCOPE).href).url, await response.text());
        }
      },
    };
  };

  const match = async (request: Request | FakeRequest | string, options?: { ignoreSearch?: boolean }) => {
    let url = new URL(typeof request === 'string' ? request : request.url, SCOPE);
    for (const store of stores.values()) {
      for (const [key, body] of store) {
        const k = new URL(key);
        if (options?.ignoreSearch) {
          k.search = '';
          url = new URL(url);
          url.search = '';
        }
        if (k.href === url.href) return new Response(body);
      }
    }
    return undefined;
  };

  const self = {
    location: new URL(SCOPE + 'sw.js'),
    addEventListener: (type: string, fn: Listener) => listeners.set(type, fn),
    skipWaiting: async () => {
      skippedWaiting = true;
    },
    clients: {
      claim: async () => {
        claimed = true;
      },
    },
  };
  const caches = {
    open,
    match,
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };

  async function dispatch(type: string, request?: FakeRequest): Promise<Response | undefined> {
    const waits: Promise<unknown>[] = [];
    let response: Promise<Response | undefined> | undefined;
    listeners.get(type)!({
      request,
      waitUntil: (p) => waits.push(p),
      respondWith: (p) => {
        response = p;
      },
    });
    await Promise.all(waits);
    return response ? await response : undefined;
  }

  return {
    load(source: string) {
      new Function('self', 'caches', 'fetch', source)(self, caches, fetchFake);
    },
    serve(path: string, body: string) {
      network.set(new URL(path, SCOPE).href, body);
    },
    goOffline() {
      online = false;
    },
    install: () => dispatch('install'),
    activate: () => dispatch('activate'),
    fetch: (request: FakeRequest) => dispatch('fetch', request),
    cacheNames: () => [...stores.keys()],
    cachedUrls: (name: string) => [...(stores.get(name)?.keys() ?? [])],
    fetched,
    get skippedWaiting() {
      return skippedWaiting;
    },
    get claimed() {
      return claimed;
    },
  };
}

const page = (path = ''): FakeRequest => ({ url: SCOPE + path, method: 'GET', mode: 'navigate' });
const asset = (path: string): FakeRequest => ({ url: SCOPE + path, method: 'GET', mode: 'no-cors' });

describe('service worker', () => {
  it('precaches every build file under the sub-path, bypassing the browser HTTP cache', async () => {
    const w = world();
    w.serve('./', '<html>page</html>');
    w.serve('./assets/app.js', 'app');
    w.load(serviceWorkerSource({ version: 'v1', urls: ['./', './assets/app.js'] }));

    await w.install();

    expect(w.cacheNames()).toEqual(['kids-chess-v1']);
    expect(w.cachedUrls('kids-chess-v1')).toEqual([SCOPE, SCOPE + 'assets/app.js']);
    expect(w.fetched.every((r) => r.cache === 'reload')).toBe(true);
    expect(w.skippedWaiting).toBe(true);
  });

  it('on a new deploy, drops the old kids-chess cache but keeps other apps on the same origin', async () => {
    const w = world(['kids-chess-v1', 'word-bots-abc']);
    w.serve('./', '<html>new</html>');
    w.load(serviceWorkerSource({ version: 'v2', urls: ['./'] }));

    await w.install();
    await w.activate();

    expect(w.cacheNames().sort()).toEqual(['kids-chess-v2', 'word-bots-abc']);
    expect(w.claimed).toBe(true);
  });

  it('offline, opens the app from the cache and serves its files (including the engine)', async () => {
    const w = world();
    w.serve('./', '<html>page</html>');
    w.serve('./assets/stockfish.wasm', 'wasm');
    w.load(serviceWorkerSource({ version: 'v1', urls: ['./', './assets/stockfish.wasm'] }));
    await w.install();
    await w.activate();
    w.goOffline();

    expect(await (await w.fetch(page('?from=homescreen')))!.text()).toBe('<html>page</html>');
    expect(await (await w.fetch(page('index.html')))!.text()).toBe('<html>page</html>');
    expect(await (await w.fetch(asset('assets/stockfish.wasm')))!.text()).toBe('wasm');
  });

  it('online, fetches the page from the network so a new deploy shows up', async () => {
    const w = world();
    w.serve('./', '<html>old</html>');
    w.load(serviceWorkerSource({ version: 'v1', urls: ['./'] }));
    await w.install();
    w.serve('./', '<html>new</html>');

    expect(await (await w.fetch(page()))!.text()).toBe('<html>new</html>');
  });

  it('leaves other origins and non-GET requests to the browser', async () => {
    const w = world();
    w.load(serviceWorkerSource({ version: 'v1', urls: ['./'] }));

    expect(await w.fetch({ url: 'https://elsewhere.example/x.js', method: 'GET', mode: 'cors' })).toBeUndefined();
    expect(await w.fetch({ url: SCOPE + 'x', method: 'POST', mode: 'cors' })).toBeUndefined();
  });
});
