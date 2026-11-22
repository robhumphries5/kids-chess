// The Sticker Book: a new sticker every time a Profile's Points total passes the next 100. Stickers
// are unlocked by the Points ledger (any award, from anywhere) and are never taken away.
import type { ProfileStore } from './profiles';

/** One sticker passes for every this many Points. */
export const POINTS_PER_STICKER = 100;

export interface Sticker {
  id: string;
  /** Spoken when it unlocks or is tapped in the Sticker Book. */
  name: string;
}

/** Every sticker, in the order they unlock: the first at 100 Points, the next at 200, and so on. */
export const STICKERS: readonly Sticker[] = Object.freeze([
  { id: 'star-gold', name: 'Gold star' },
  { id: 'heart-red', name: 'Red heart' },
  { id: 'sun-yellow', name: 'Sunshine' },
  { id: 'rocket-red', name: 'Red rocket' },
  { id: 'flower-pink', name: 'Pink flower' },
  { id: 'fish-orange', name: 'Orange fish' },
  { id: 'crown-gold', name: 'Gold crown' },
  { id: 'rainbow-bright', name: 'Rainbow' },
  { id: 'balloon-blue', name: 'Blue balloon' },
  { id: 'moon-silver', name: 'Moon' },
  { id: 'tree-green', name: 'Tree' },
  { id: 'ladybird-red', name: 'Ladybird' },
  { id: 'star-blue', name: 'Blue star' },
  { id: 'heart-purple', name: 'Purple heart' },
  { id: 'sun-orange', name: 'Orange sun' },
  { id: 'rocket-blue', name: 'Blue rocket' },
  { id: 'flower-yellow', name: 'Yellow flower' },
  { id: 'fish-blue', name: 'Blue fish' },
  { id: 'crown-silver', name: 'Silver crown' },
  { id: 'rainbow-soft', name: 'Soft rainbow' },
  { id: 'balloon-green', name: 'Green balloon' },
  { id: 'moon-gold', name: 'Golden moon' },
  { id: 'tree-autumn', name: 'Autumn tree' },
  { id: 'ladybird-yellow', name: 'Yellow ladybird' },
]);

/** A sticker was unlocked. Celebrate it once. */
export interface StickerUnlocked {
  type: 'sticker-unlocked';
  sticker: Sticker;
}

/** The Points total at which `sticker` unlocks. */
export function stickerMilestone(sticker: Sticker): number {
  return (STICKERS.indexOf(sticker) + 1) * POINTS_PER_STICKER;
}

/** Every sticker a total has passed. */
export function stickersEarned(total: number): Sticker[] {
  const count = Math.floor(Math.max(0, total) / POINTS_PER_STICKER);
  return STICKERS.slice(0, count);
}

/** One page of the Sticker Book: a sticker, and whether this Profile has it yet. */
export interface StickerPage {
  sticker: Sticker;
  unlocked: boolean;
}

export interface StickerBook {
  /** Every sticker in unlock order, unlocked ones first; locked ones show as gentle placeholders. */
  pages(): StickerPage[];
  /**
   * Stickers unlocked since they were last taken, oldest first, each given exactly once (it is
   * remembered across reloads). Whoever shows the child something takes them and celebrates.
   */
  takeNew(): StickerUnlocked[];
}

export function createStickerBook(store: ProfileStore, profileId: string): StickerBook {
  return {
    pages() {
      const have = new Set(store.load(profileId).stickers);
      return STICKERS.map((sticker) => ({ sticker, unlocked: have.has(sticker.id) }));
    },
    takeNew() {
      const data = store.load(profileId);
      if (data.newStickers.length === 0) return [];
      store.save(profileId, { ...data, newStickers: [] });
      return data.newStickers.flatMap((id) => {
        const sticker = STICKERS.find((s) => s.id === id);
        return sticker ? [{ type: 'sticker-unlocked' as const, sticker }] : [];
      });
    },
  };
}
