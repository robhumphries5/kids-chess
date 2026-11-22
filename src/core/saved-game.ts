// The game in progress against an Opponent, one per Profile, saved after every move so the child can
// quit any time and carry on later. Stored on this device only, under a versioned key.
import type { KeyValueStorage } from './profiles';
import type { Colour } from './session';

export interface SavedGame {
  opponentId: string;
  childColour: Colour;
  /** The moves played so far, in SAN, from the start (or from `fen`). */
  moves: string[];
  /** The starting position, when the game didn't begin from the normal start. */
  fen?: string;
}

export interface SavedGameStore {
  load(profileId: string): SavedGame | undefined;
  save(profileId: string, game: SavedGame): void;
  clear(profileId: string): void;
}

export const savedGameKey = (profileId: string) => `kids-chess:profile:${profileId}:game:v1`;

/**
 * Defaults to the browser's localStorage. With no storage, or storage that throws (blocked, private
 * mode), the game is still kept for this visit from memory. Corrupt data means no saved game.
 */
export function createSavedGameStore(storage: KeyValueStorage | undefined = safeLocalStorage()): SavedGameStore {
  // Mirrors what was written, so a store with failing storage still behaves for this visit.
  const memory = new Map<string, string>();

  return {
    load(profileId) {
      const key = savedGameKey(profileId);
      let raw: string | null | undefined;
      try {
        raw = storage?.getItem(key);
      } catch {
        raw = undefined;
      }
      raw ??= memory.get(key);
      if (raw == null) return undefined;
      try {
        return asSavedGame(JSON.parse(raw));
      } catch {
        return undefined;
      }
    },
    save(profileId, game) {
      const key = savedGameKey(profileId);
      const raw = JSON.stringify(game);
      memory.set(key, raw);
      try {
        storage?.setItem(key, raw);
      } catch {
        // Storage full or blocked: kept in memory for this visit.
      }
    },
    clear(profileId) {
      const key = savedGameKey(profileId);
      memory.delete(key);
      try {
        storage?.removeItem(key);
      } catch {
        // Blocked: it is gone from memory, which is all this visit can do.
      }
    },
  };
}

function asSavedGame(value: unknown): SavedGame | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.opponentId !== 'string') return undefined;
  if (v.childColour !== 'white' && v.childColour !== 'black') return undefined;
  if (!Array.isArray(v.moves) || !v.moves.every((m) => typeof m === 'string')) return undefined;
  const game: SavedGame = { opponentId: v.opponentId, childColour: v.childColour, moves: [...v.moves] };
  if (typeof v.fen === 'string') game.fen = v.fen;
  return game;
}

function safeLocalStorage(): KeyValueStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
