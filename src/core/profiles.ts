// Profiles: one per child, chosen by avatar. Stored on this device only, in localStorage under
// versioned keys. Loading merges saved data over defaults and never crashes (word-bots pattern).

import { savedGameKey } from './saved-game';

/** The parts of localStorage the store uses, so tests can pass an in-memory stand-in. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Who a Profile is: the list the avatar picker shows. */
export interface Profile {
  id: string;
  /** Which avatar picture stands for this Profile. */
  avatar: string;
  /** Optional, set by a grown-up. Kept on this device only, never in the repo. */
  name?: string;
}

/** What a grown-up can change about who a Profile is. A blank name clears it. */
export interface ProfileChanges {
  name?: string;
  avatar?: string;
}

/** One switch per kind of thing a Blunder Warning or Missed-Chance Alert can be about. */
export interface KindSwitches {
  checkmate: boolean;
  queen: boolean;
  rook: boolean;
  bishopKnight: boolean;
}

/** The per-Profile switches set in the Grown-up Area. */
export interface ProfileSettings {
  /** Speak: when off, nothing is spoken for this Profile. */
  voice: boolean;
  moveColours: boolean;
  /** Tapping a red Move Colours square speaks why. */
  spokenReasons: boolean;
  blunderWarning: KindSwitches;
  missedChance: KindSwitches;
}

/** How much help a Profile starts with, chosen by a grown-up when making it. */
export const HELP_PRESETS = ['lots', 'some'] as const;
export type HelpPreset = (typeof HELP_PRESETS)[number];

const isHelpPreset = (value: unknown): value is HelpPreset => HELP_PRESETS.includes(value as HelpPreset);

export const HELP_PRESET_NAMES: Readonly<Record<HelpPreset, string>> = { lots: 'Lots of help', some: 'Some help' };

/** The help switches a preset sets. Voice is not help, so a preset leaves it alone. */
export type HelpSettings = Omit<ProfileSettings, 'voice'>;

/** Checkmate and queen are always on; rook and bishop/knight only with "Lots of help". */
const kindsFor = (lots: boolean): KindSwitches => ({ checkmate: true, queen: true, rook: lots, bishopKnight: lots });

/** The help switches each preset turns on. Read these, never copy them: later features add their switches here. */
export function helpPresetSettings(preset: HelpPreset): HelpSettings {
  const lots = preset === 'lots';
  return {
    moveColours: true,
    spokenReasons: true,
    blunderWarning: kindsFor(lots),
    missedChance: kindsFor(lots),
  };
}

/** Everything a Profile has earned and chosen. */
export interface ProfileData {
  helpPreset: HelpPreset;
  points: number;
  /** Sticker ids unlocked, in unlock order. Never taken away. */
  stickers: string[];
  /** Unlocked stickers not yet celebrated (see StickerBook.takeNew). */
  newStickers: string[];
  ladderLevel: number;
  opponentsBeaten: string[];
  settings: ProfileSettings;
}

/** A new Profile's data for a help preset. */
export function newProfileData(preset: HelpPreset): ProfileData {
  return {
    helpPreset: preset,
    points: 0,
    stickers: [],
    newStickers: [],
    ladderLevel: 0,
    opponentsBeaten: [],
    settings: { voice: true, ...helpPresetSettings(preset) },
  };
}

/** Saved data from before help presets existed loads as "Lots of help". */
const DEFAULT_PRESET: HelpPreset = 'lots';

export const DEFAULT_PROFILE_DATA: Readonly<ProfileData> = Object.freeze(newProfileData(DEFAULT_PRESET));

const LIST_KEY = 'kids-chess:profiles:v1';
const dataKey = (id: string) => `kids-chess:profile:${id}:v1`;

export interface ProfileStore {
  list(): Profile[];
  /** Create a Profile with its preset's default data and remember it. */
  add(avatar: string, options?: { preset?: HelpPreset; name?: string }): Profile;
  /** Rename or re-picture. Progress and Settings stay. */
  update(id: string, changes: ProfileChanges): void;
  /** Forget a Profile and everything it earned. The Grown-up Area asks first. */
  remove(id: string): void;
  /** Change how much help: the help switches go back to the new preset's defaults; voice and progress stay. */
  setHelpPreset(id: string, preset: HelpPreset): void;
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

  function forget(key: string): void {
    memory.delete(key);
    try {
      storage?.removeItem(key);
    } catch {
      // Blocked: it is gone from memory, which is all this visit can do.
    }
  }

  function list(): Profile[] {
    const saved = read(LIST_KEY);
    return Array.isArray(saved) ? saved.filter(isProfile) : [];
  }

  function load(id: string): ProfileData {
    return mergeOverDefaults(read(dataKey(id)));
  }

  function save(id: string, data: ProfileData): void {
    write(dataKey(id), data);
  }

  return {
    list,
    add(avatar, { preset = DEFAULT_PRESET, name } = {}) {
      const profiles = list();
      const profile = withName({ id: newId(profiles), avatar }, name);
      write(LIST_KEY, [...profiles, profile]);
      write(dataKey(profile.id), newProfileData(preset));
      return profile;
    },
    update(id, changes) {
      write(
        LIST_KEY,
        list().map((p) => {
          if (p.id !== id) return p;
          const changed = { ...p, ...(changes.avatar !== undefined && { avatar: changes.avatar }) };
          return changes.name === undefined ? changed : withName(changed, changes.name);
        }),
      );
    },
    remove(id) {
      write(LIST_KEY, list().filter((p) => p.id !== id));
      forget(dataKey(id));
      forget(savedGameKey(id));
    },
    load,
    save,
    setHelpPreset(id, preset) {
      const data = load(id);
      save(id, { ...data, helpPreset: preset, settings: { ...data.settings, ...helpPresetSettings(preset) } });
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

/** Sets a trimmed name, or removes it when blank. */
function withName(profile: Profile, name: string | undefined): Profile {
  const { name: _old, ...rest } = profile;
  const trimmed = name?.trim();
  return trimmed ? { ...rest, name: trimmed } : rest;
}

function isProfile(value: unknown): value is Profile {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.avatar === 'string' &&
    (value.name === undefined || typeof value.name === 'string')
  );
}

/** Each saved field is kept only if it has the right type; anything missing or wrong gets its default. */
function mergeOverDefaults(saved: unknown): ProfileData {
  const s = isRecord(saved) ? saved : {};
  const settings = isRecord(s.settings) ? s.settings : {};
  const helpPreset = isHelpPreset(s.helpPreset) ? s.helpPreset : DEFAULT_PRESET;
  const d = newProfileData(helpPreset);
  return {
    helpPreset,
    points: typeof s.points === 'number' ? s.points : d.points,
    stickers: stringArray(s.stickers) ?? [...d.stickers],
    newStickers: stringArray(s.newStickers) ?? [...d.newStickers],
    ladderLevel: typeof s.ladderLevel === 'number' ? s.ladderLevel : d.ladderLevel,
    opponentsBeaten: stringArray(s.opponentsBeaten) ?? [...d.opponentsBeaten],
    settings: {
      voice: bool(settings.voice, d.settings.voice),
      moveColours: bool(settings.moveColours, d.settings.moveColours),
      spokenReasons: bool(settings.spokenReasons, d.settings.spokenReasons),
      blunderWarning: kindSwitches(settings.blunderWarning, d.settings.blunderWarning),
      missedChance: kindSwitches(settings.missedChance, d.settings.missedChance),
    },
  };
}

const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

function kindSwitches(saved: unknown, defaults: KindSwitches): KindSwitches {
  const s = isRecord(saved) ? saved : {};
  return {
    checkmate: bool(s.checkmate, defaults.checkmate),
    queen: bool(s.queen, defaults.queen),
    rook: bool(s.rook, defaults.rook),
    bishopKnight: bool(s.bishopKnight, defaults.bishopKnight),
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
