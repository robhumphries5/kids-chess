import { describe, expect, it } from 'vitest';
import { awardPoints, createPointsLedger } from './points';
import { createProfileStore, type KeyValueStorage } from './profiles';
import { createStickerBook, stickerMilestone, STICKERS } from './stickers';

function memoryStorage(map = new Map<string, string>()): KeyValueStorage {
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function newFox(map = new Map<string, string>()) {
  const store = createProfileStore(memoryStorage(map));
  return { store, id: store.add('fox').id };
}

const unlockedIds = (events: { sticker: { id: string } }[]) => events.map((e) => e.sticker.id);

describe('Sticker milestones', () => {
  it('passing 100 Points unlocks the first sticker', () => {
    const { store, id } = newFox();
    expect(awardPoints(store, id, 90).stickers).toEqual([]);
    const { points, stickers } = awardPoints(store, id, 30);
    expect(points).toEqual({ type: 'points-awarded', amount: 30, total: 120 });
    expect(stickers).toHaveLength(1);
    expect(stickers[0]).toMatchObject({ type: 'sticker-unlocked', sticker: { id: 'star-gold' } });
  });

  it('each milestone unlocks exactly once, however many Points come after it', () => {
    const { store, id } = newFox();
    expect(awardPoints(store, id, 100).stickers).toHaveLength(1);
    expect(awardPoints(store, id, 30).stickers).toEqual([]);
    expect(awardPoints(store, id, 30).stickers).toEqual([]);
    expect(unlockedIds(awardPoints(store, id, 40).stickers)).toEqual(['heart-red']);
  });

  it('an award that passes several milestones unlocks every sticker it passes, in order', () => {
    const { store, id } = newFox();
    awardPoints(store, id, 50);
    expect(unlockedIds(awardPoints(store, id, 260).stickers)).toEqual(['star-gold', 'heart-red', 'sun-yellow']);
  });

  it('a plain ledger award unlocks too, and the sticker waits to be celebrated exactly once', () => {
    const { store, id } = newFox();
    createPointsLedger(store, id).award(110);
    const book = createStickerBook(store, id);
    expect(unlockedIds(book.takeNew())).toEqual(['star-gold']);
    expect(book.takeNew()).toEqual([]);
    expect(awardPoints(store, id, 10).stickers).toEqual([]);
  });

  it('awarding nothing, or less than nothing, unlocks nothing', () => {
    const { store, id } = newFox();
    for (const amount of [0, -500, Number.NaN]) expect(awardPoints(store, id, amount).stickers).toEqual([]);
  });

  it('stickers and the celebrations still waiting survive a reload', () => {
    const map = new Map<string, string>();
    const { store, id } = newFox(map);
    createPointsLedger(store, id).award(100);
    const reloaded = createProfileStore(memoryStorage(map));
    expect(unlockedIds(createStickerBook(reloaded, id).takeNew())).toEqual(['star-gold']);
    const again = createProfileStore(memoryStorage(map));
    expect(createStickerBook(again, id).takeNew()).toEqual([]);
    expect(createStickerBook(again, id).pages()[0]).toMatchObject({ unlocked: true });
  });

  it('each Profile has its own stickers', () => {
    const { store, id } = newFox();
    const owl = store.add('owl').id;
    awardPoints(store, id, 100);
    expect(createStickerBook(store, owl).pages().every((p) => !p.unlocked)).toBe(true);
    expect(awardPoints(store, owl, 10).stickers).toEqual([]);
  });

  it('stickers are never taken away, whatever else changes', () => {
    const { store, id } = newFox();
    awardPoints(store, id, 250);
    store.setHelpPreset(id, 'some');
    awardPoints(store, id, -1000);
    awardPoints(store, id, 0);
    const unlocked = createStickerBook(store, id)
      .pages()
      .filter((p) => p.unlocked)
      .map((p) => p.sticker.id);
    expect(unlocked).toEqual(['star-gold', 'heart-red']);
  });

  it('a Profile with Points from before stickers existed catches up on its next award', () => {
    const map = new Map<string, string>();
    const { id } = newFox(map);
    // Saved data from before this feature: Points but no sticker fields at all.
    const key = [...map.keys()].find((k) => k.startsWith(`kids-chess:profile:${id}`))!;
    const { stickers: _s, newStickers: _n, ...old } = JSON.parse(map.get(key)!);
    map.set(key, JSON.stringify({ ...old, points: 230 }));
    const reloaded = createProfileStore(memoryStorage(map));
    expect(unlockedIds(awardPoints(reloaded, id, 10).stickers)).toEqual(['star-gold', 'heart-red']);
  });

  it('after the last sticker, more Points still count but unlock nothing more', () => {
    const { store, id } = newFox();
    const all = awardPoints(store, id, STICKERS.length * 100).stickers;
    expect(all).toHaveLength(STICKERS.length);
    const after = awardPoints(store, id, 1000);
    expect(after.points.total).toBe(STICKERS.length * 100 + 1000);
    expect(after.stickers).toEqual([]);
  });
});

describe('Sticker Book pages', () => {
  it('shows every sticker in unlock order, with locked ones still to come', () => {
    const { store, id } = newFox();
    awardPoints(store, id, 210);
    const pages = createStickerBook(store, id).pages();
    expect(pages).toHaveLength(STICKERS.length);
    expect(pages.slice(0, 3).map((p) => [p.sticker.id, p.unlocked])).toEqual([
      ['star-gold', true],
      ['heart-red', true],
      ['sun-yellow', false],
    ]);
  });

  it('every sticker has a different id and a name to speak', () => {
    expect(new Set(STICKERS.map((s) => s.id)).size).toBe(STICKERS.length);
    for (const s of STICKERS) expect(s.name.trim()).not.toBe('');
  });

  it('the first sticker is at 100 Points and each next one 100 later', () => {
    expect(stickerMilestone(STICKERS[0]!)).toBe(100);
    expect(stickerMilestone(STICKERS[4]!)).toBe(500);
  });
});
