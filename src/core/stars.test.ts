import { describe, expect, it } from 'vitest';
import { createProfileStore, type KeyValueStorage } from './profiles';
import { createStars } from './stars';

function memoryStorage(map = new Map<string, string>()): KeyValueStorage {
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('Opponent stars', () => {
  it('a new Profile has no stars', () => {
    const store = createProfileStore(memoryStorage());
    const fox = store.add('fox');
    expect(createStars(store, fox.id).has('pig')).toBe(false);
  });

  it('starring an Opponent shows it as beaten, and says it is a new star the first time only', () => {
    const store = createProfileStore(memoryStorage());
    const fox = store.add('fox');
    const stars = createStars(store, fox.id);
    expect(stars.add('pig')).toEqual({ type: 'star-earned', opponentId: 'pig', first: true });
    expect(stars.add('pig')).toEqual({ type: 'star-earned', opponentId: 'pig', first: false });
    expect(stars.has('pig')).toBe(true);
    expect(stars.has('snail')).toBe(false);
  });

  it('stars survive a reload', () => {
    const map = new Map<string, string>();
    const fox = createProfileStore(memoryStorage(map)).add('fox');
    createStars(createProfileStore(memoryStorage(map)), fox.id).add('snail');
    expect(createStars(createProfileStore(memoryStorage(map)), fox.id).has('snail')).toBe(true);
  });

  it('each Profile has its own stars', () => {
    const store = createProfileStore(memoryStorage());
    const fox = store.add('fox');
    const owl = store.add('owl');
    createStars(store, fox.id).add('pig');
    expect(createStars(store, owl.id).has('pig')).toBe(false);
  });

  it('keeps the rest of the Profile as it was, Points included', () => {
    const store = createProfileStore(memoryStorage());
    const fox = store.add('fox');
    store.save(fox.id, { ...store.load(fox.id), points: 40 });
    const before = store.load(fox.id);
    createStars(store, fox.id).add('pig');
    expect(store.load(fox.id)).toEqual({ ...before, opponentsBeaten: ['pig'] });
  });
});
