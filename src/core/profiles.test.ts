import { describe, expect, it } from 'vitest';
import { createProfileStore, DEFAULT_PROFILE_DATA, type KeyValueStorage } from './profiles';

/** An in-memory stand-in for localStorage. Pass the same map to a second store to simulate a reload. */
function memoryStorage(map = new Map<string, string>()): KeyValueStorage & { map: Map<string, string> } {
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

describe('Profile store', () => {
  it('has no Profiles when storage is empty', () => {
    expect(createProfileStore(memoryStorage()).list()).toEqual([]);
  });

  it('has no Profiles and does not crash when there is no storage at all', () => {
    const store = createProfileStore(undefined);
    expect(store.list()).toEqual([]);
    const fox = store.add('fox');
    expect(store.load(fox.id)).toEqual(DEFAULT_PROFILE_DATA);
  });

  it('survives storage that throws on every call', () => {
    const throwing: KeyValueStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const store = createProfileStore(throwing);
    expect(store.list()).toEqual([]);
    const fox = store.add('fox');
    expect(() => store.save(fox.id, { ...DEFAULT_PROFILE_DATA, points: 10 })).not.toThrow();
  });

  it('a new Profile starts with default data', () => {
    const store = createProfileStore(memoryStorage());
    const fox = store.add('fox');
    expect(fox.avatar).toBe('fox');
    expect(store.load(fox.id)).toEqual(DEFAULT_PROFILE_DATA);
  });

  it('Profiles and their data survive a reload', () => {
    const map = new Map<string, string>();
    const first = createProfileStore(memoryStorage(map));
    const fox = first.add('fox');
    const owl = first.add('owl');
    first.save(fox.id, { ...DEFAULT_PROFILE_DATA, points: 40 });

    const reloaded = createProfileStore(memoryStorage(map));
    expect(reloaded.list()).toEqual([fox, owl]);
    expect(reloaded.load(fox.id).points).toBe(40);
    expect(reloaded.load(owl.id).points).toBe(0);
  });

  it("stores each Profile's data separately under a versioned key", () => {
    const storage = memoryStorage();
    const store = createProfileStore(storage);
    const fox = store.add('fox');
    const owl = store.add('owl');
    store.save(fox.id, { ...DEFAULT_PROFILE_DATA, points: 40 });
    store.save(owl.id, { ...DEFAULT_PROFILE_DATA, points: 70 });

    const foxKey = `kids-chess:profile:${fox.id}:v1`;
    const owlKey = `kids-chess:profile:${owl.id}:v1`;
    expect(JSON.parse(storage.map.get(foxKey)!).points).toBe(40);
    expect(JSON.parse(storage.map.get(owlKey)!).points).toBe(70);
    expect(storage.map.has('kids-chess:profiles:v1')).toBe(true);
  });

  it('gives each new Profile a different id', () => {
    const store = createProfileStore(memoryStorage());
    const ids = ['fox', 'owl', 'frog'].map((a) => store.add(a).id);
    expect(new Set(ids).size).toBe(3);
  });

  it('corrupt Profile data gives defaults without crashing', () => {
    const storage = memoryStorage();
    const store = createProfileStore(storage);
    const fox = store.add('fox');
    storage.map.set(`kids-chess:profile:${fox.id}:v1`, '{not json');
    expect(store.load(fox.id)).toEqual(DEFAULT_PROFILE_DATA);
  });

  it('a corrupt Profile list gives no Profiles without crashing', () => {
    const storage = memoryStorage(new Map([['kids-chess:profiles:v1', '{"oops":']]));
    expect(createProfileStore(storage).list()).toEqual([]);
  });

  it('ignores Profile list entries that are not Profiles', () => {
    const storage = memoryStorage(
      new Map([['kids-chess:profiles:v1', JSON.stringify([{ id: 'a', avatar: 'fox' }, 7, null, { id: 3 }])]]),
    );
    expect(createProfileStore(storage).list()).toEqual([{ id: 'a', avatar: 'fox' }]);
  });

  it('saved values merge over defaults, so fields added later get their defaults', () => {
    const storage = memoryStorage(
      new Map([
        ['kids-chess:profiles:v1', JSON.stringify([{ id: 'a', avatar: 'fox' }])],
        ['kids-chess:profile:a:v1', JSON.stringify({ points: 55, settings: { moveColours: false } })],
      ]),
    );
    expect(createProfileStore(storage).load('a')).toEqual({
      ...DEFAULT_PROFILE_DATA,
      points: 55,
      settings: { ...DEFAULT_PROFILE_DATA.settings, moveColours: false },
    });
  });

  it('saved values of the wrong type fall back to defaults', () => {
    const storage = memoryStorage(
      new Map([['kids-chess:profile:a:v1', JSON.stringify({ points: 'lots', opponentsBeaten: 'snail' })]]),
    );
    expect(createProfileStore(storage).load('a')).toEqual(DEFAULT_PROFILE_DATA);
  });

  it('loading never hands out the shared defaults to be changed', () => {
    const store = createProfileStore(memoryStorage());
    const fox = store.add('fox');
    store.load(fox.id).opponentsBeaten.push('snail');
    expect(store.load(fox.id).opponentsBeaten).toEqual([]);
  });
});
