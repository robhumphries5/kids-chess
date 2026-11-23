// Points: earned everywhere, saved per Profile, never lost.
import type { ProfileStore } from './profiles';
import { createStickerBook, stickersEarned, type StickerUnlocked } from './stickers';

/** Points were added to the Profile's total. `amount` is never negative. */
export interface PointsAwarded {
  type: 'points-awarded';
  amount: number;
  /** The Profile's new total. */
  total: number;
}

export interface PointsLedger {
  total(): number;
  /**
   * Add Points and save them. Anything that isn't a positive whole number awards nothing: the total
   * only goes up. Any sticker milestone passed is unlocked and saved in the same step, waiting to be
   * celebrated (`createStickerBook(...).takeNew()`, or use `awardPoints` to get them straight back).
   */
  award(amount: number): PointsAwarded;
}

export function createPointsLedger(store: ProfileStore, profileId: string): PointsLedger {
  const total = () => store.load(profileId).points;
  return {
    total,
    award(amount) {
      const safe = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
      const data = store.load(profileId);
      const next = data.points + safe;
      if (safe > 0) {
        const have = new Set(data.stickers);
        const unlocked = stickersEarned(next)
          .map((s) => s.id)
          .filter((id) => !have.has(id));
        store.save(profileId, {
          ...data,
          points: next,
          stickers: [...data.stickers, ...unlocked],
          newStickers: [...data.newStickers, ...unlocked],
        });
      }
      return { type: 'points-awarded', amount: safe, total: next };
    },
  };
}

/** What one award earned: the Points, then every sticker it unlocked (none, one, or several). */
export interface Award {
  points: PointsAwarded;
  stickers: StickerUnlocked[];
}

/**
 * Award Points to a Profile and get back the stickers that are now ready to celebrate (each one is
 * given exactly once, ever). The one call for anything that gives Points: puzzles, games, Mini-games.
 */
export function awardPoints(store: ProfileStore, profileId: string, amount: number): Award {
  const points = createPointsLedger(store, profileId).award(amount);
  return { points, stickers: createStickerBook(store, profileId).takeNew() };
}

/** How the star jar looks for a total. */
export interface StarJar {
  total: number;
  /** Stars showing in the jar, 0 to `capacity`. */
  stars: number;
  capacity: number;
}

const POINTS_PER_STAR = 10;
const JAR_CAPACITY = 10;

/**
 * One star per 10 Points; the jar fills towards each 100 (where a sticker will unlock) and starts
 * again. Once anything is earned the jar is never shown empty: exactly 100 shows a full jar.
 */
export function starJar(total: number): StarJar {
  const earned = Math.floor(Math.max(0, total) / POINTS_PER_STAR);
  const stars = earned === 0 ? 0 : ((earned - 1) % JAR_CAPACITY) + 1;
  return { total, stars, capacity: JAR_CAPACITY };
}
