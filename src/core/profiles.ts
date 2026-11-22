// Profiles: one per child, chosen by avatar. Stored on this device only, in localStorage under
// versioned keys. Loading merges saved data over defaults and never crashes (word-bots pattern).

/** The parts of localStorage the store uses, so tests can pass an in-memory stand-in. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Who a Profile is: the list the avatar picker shows. */
export interface Profile {
  id: string;
  /** Which avatar picture stands for this Profile. */
  avatar: string;
}

export interface ProfileSettings {
  moveColours: boolean;
}

/** Everything a Profile has earned and chosen. */
export interface ProfileData {
  points: number;
  stickers: string[];
  ladderLevel: number;
  opponentsBeaten: string[];
  settings: ProfileSettings;
}

export const DEFAULT_PROFILE_DATA: Readonly<ProfileData> = Object.freeze({
  points: 0,
  stickers: [],
  ladderLevel: 0,
  opponentsBeaten: [],
  settings: { moveColours: true },
});

const LIST_KEY = 'kids-chess:profiles:v1';
const dataKey = (id: string) => `kids-chess:profile:${id}:v1`;

export interface ProfileStore {
  list(): Profile[];
  /** Create a Profile with default data and remember it. */
  add(avatar: string): Profile;
  load(id: string): ProfileData;
  save(id: string, data: ProfileData): void;
}

/**
 * Defaults to the browser's localStorage. With no storage, or storage that throws (blocked, private
 * mode), everything still works for this visit from memory; it just isn't kept.
 */
export function createProfileStore(
  storage: KeyValueStorage | undefined = safeLocalStorage(),
): ProfileStore {
  // Mirrors what was written, so a store with failing storage still behaves for this visit.
  const memory = new Map<string, string>();

  function read(key: string): unknown {
    let raw: string | null | undefined;
    try {
      raw = storage?.getItem(key);
    } catch {
      raw = undefined;
    }
    raw ??= memory.get(key);
    if (raw == null) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  function write(key: string, value: unknown): void {
    const raw = JSON.stringify(value);
    memory.set(key, raw);
    try {
      storage?.setItem(key, raw);
    } catch {
      // Storage full or blocked: kept in memory for this visit.
    }
  }

  function list(): Profile[] {
    const saved = read(LIST_KEY);
    return Array.isArray(saved) ? saved.filter(isProfile) : [];
  }

  return {
    list,
    add(avatar) {
      const profiles = list();
      const profile = { id: newId(profiles), avatar };
      write(LIST_KEY, [...profiles, profile]);
      return profile;
    },
    load(id) {
      return mergeOverDefaults(read(dataKey(id)));
    },
    save(id, data) {
      write(dataKey(id), data);
    },
  };
}

function newId(existing: Profile[]): string {
  const taken = new Set(existing.map((p) => p.id));
  let id: string;
  do id = Math.random().toString(36).slice(2, 10);
  while (taken.has(id));
  return id;
}

function isProfile(value: unknown): value is Profile {
  return isRecord(value) && typeof value.id === 'string' && typeof value.avatar === 'string';
}

/** Each saved field is kept only if it has the right type; anything missing or wrong gets its default. */
function mergeOverDefaults(saved: unknown): ProfileData {
  const s = isRecord(saved) ? saved : {};
  const settings = isRecord(s.settings) ? s.settings : {};
  const d = DEFAULT_PROFILE_DATA;
  return {
    points: typeof s.points === 'number' ? s.points : d.points,
    stickers: stringArray(s.stickers) ?? [...d.stickers],
    ladderLevel: typeof s.ladderLevel === 'number' ? s.ladderLevel : d.ladderLevel,
    opponentsBeaten: stringArray(s.opponentsBeaten) ?? [...d.opponentsBeaten],
    settings: {
      moveColours: typeof settings.moveColours === 'boolean' ? settings.moveColours : d.settings.moveColours,
    },
  };
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((v) => typeof v === 'string') ? [...value] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeLocalStorage(): KeyValueStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
