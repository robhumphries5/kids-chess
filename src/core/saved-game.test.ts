import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from './profiles';
import { createSavedGameStore, type SavedGame } from './saved-game';

function memoryStorage(map = new Map<string, string>()): KeyValueStorage & { map: Map<string, string> } {
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const GAME: SavedGame = { opponentId: 'pig', childColour: 'black', moves: ['e4', 'e5'] };

describe('Saved game store', () => {
  it('has no saved game for a Profile that has not played', () => {
    expect(createSavedGameStore(memoryStorage()).load('fox')).toBeUndefined();
  });

  it('a saved game survives a reload, under a versioned key per Profile', () => {
    const storage = memoryStorage();
    createSavedGameStore(storage).save('fox', GAME);
    expect(createSavedGameStore(storage).load('fox')).toEqual(GAME);
    expect(createSavedGameStore(storage).load('owl')).toBeUndefined();
    expect([...storage.map.keys()]).toEqual(['kids-chess:profile:fox:game:v1']);
  });

  it('clearing forgets the saved game', () => {
    const store = createSavedGameStore(memoryStorage());
    store.save('fox', GAME);
    store.clear('fox');
    expect(store.load('fox')).toBeUndefined();
  });

  it('a starting position is kept when there is one', () => {
    const store = createSavedGameStore(memoryStorage());
    const fen = '7k/1P6/8/8/8/8/8/K7 w - - 0 1';
    store.save('fox', { ...GAME, fen });
    expect(store.load('fox')).toEqual({ ...GAME, fen });
  });

  it.each([
    ['not JSON', '{oops'],
    ['not a game', '42'],
    ['an unknown colour', JSON.stringify({ ...GAME, childColour: 'green' })],
    ['moves that are not a list of strings', JSON.stringify({ ...GAME, moves: [1, 2] })],
    ['no Opponent', JSON.stringify({ ...GAME, opponentId: undefined })],
  ])('corrupt data (%s) means no saved game, without crashing', (_, raw) => {
    const storage = memoryStorage(new Map([['kids-chess:profile:fox:game:v1', raw]]));
    expect(createSavedGameStore(storage).load('fox')).toBeUndefined();
  });

  it('with storage that throws, or no storage at all, the game is still kept for this visit', () => {
    const throwing: KeyValueStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    for (const storage of [throwing, undefined]) {
      const store = createSavedGameStore(storage);
      expect(() => store.save('fox', GAME)).not.toThrow();
      expect(store.load('fox')).toEqual(GAME);
      expect(() => store.clear('fox')).not.toThrow();
      expect(store.load('fox')).toBeUndefined();
    }
  });
});
