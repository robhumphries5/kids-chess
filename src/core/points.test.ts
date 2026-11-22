import { describe, expect, it } from 'vitest';
import { createPointsLedger, starJar } from './points';
import { createProfileStore, type KeyValueStorage } from './profiles';

function memoryStorage(map = new Map<string, string>()): KeyValueStorage {
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('Points ledger', () => {
  it('a new Profile has 0 Points', () => {
    const store = createProfileStore(memoryStorage());
    const fox = store.add('fox');
    expect(createPointsLedger(store, fox.id).total()).toBe(0);
  });

  it('awarding Points adds to the total and returns a "points awarded" event', () => {
    const store = createProfileStore(memoryStorage());
    const fox = store.add('fox');
    const ledger = createPointsLedger(store, fox.id);
    expect(ledger.award(30)).toEqual({ type: 'points-awarded', amount: 30, total: 30 });
    expect(ledger.award(30)).toEqual({ type: 'points-awarded', amount: 30, total: 60 });
    expect(ledger.total()).toBe(60);
  });

  it('the total survives a reload', () => {
    const map = new Map<string, string>();
    const store = createProfileStore(memoryStorage(map));
    const fox = store.add('fox');
    createPointsLedger(store, fox.id).award(30);
    const reloaded = createProfileStore(memoryStorage(map));
    expect(createPointsLedger(reloaded, fox.id).total()).toBe(30);
  });

  it('each Profile has its own Points', () => {
    const store = createProfileStore(memoryStorage());
    const fox = store.add('fox');
    const owl = store.add('owl');
    createPointsLedger(store, fox.id).award(30);
    expect(createPointsLedger(store, owl.id).total()).toBe(0);
  });

  it('keeps the rest of the Profile as it was', () => {
    const store = createProfileStore(memoryStorage());
    const fox = store.add('fox', { preset: 'some' });
    const before = store.load(fox.id);
    createPointsLedger(store, fox.id).award(20);
    expect(store.load(fox.id)).toEqual({ ...before, points: 20 });
  });

  it('the total never goes down, whatever is awarded', () => {
    const store = createProfileStore(memoryStorage());
    const fox = store.add('fox');
    const ledger = createPointsLedger(store, fox.id);
    let previous = ledger.total();
    for (const amount of [30, 0, -10, 20, -1000, Number.NaN, 10, -Infinity, 0.5]) {
      const event = ledger.award(amount);
      expect(event.total).toBeGreaterThanOrEqual(previous);
      expect(event.amount).toBeGreaterThanOrEqual(0);
      expect(ledger.total()).toBe(event.total);
      previous = event.total;
    }
    expect(ledger.total()).toBe(60);
  });
});

describe('Star jar', () => {
  it('is empty at 0 Points', () => {
    expect(starJar(0)).toEqual({ total: 0, stars: 0, capacity: 10 });
  });

  it('gains a star for every 10 Points, filling towards each 100', () => {
    expect(starJar(30).stars).toBe(3);
    expect(starJar(99).stars).toBe(9);
    expect(starJar(250)).toEqual({ total: 250, stars: 5, capacity: 10 });
  });

  it('shows a full jar exactly on each 100, never an empty one after earning', () => {
    expect(starJar(100).stars).toBe(10);
    expect(starJar(300).stars).toBe(10);
    expect(starJar(305).stars).toBe(10);
    expect(starJar(310).stars).toBe(1);
  });
});
