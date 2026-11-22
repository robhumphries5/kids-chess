// Stars on the Opponent picker: one for each Opponent this Profile has beaten. Saved with the Profile
// (its versioned data key, as `opponentsBeaten`) and never taken away.
import type { ProfileStore } from './profiles';

/** The child beat an Opponent. `first` is true when this is a new star on the picker. */
export interface StarEarned {
  type: 'star-earned';
  opponentId: string;
  first: boolean;
}

export interface Stars {
  has(opponentId: string): boolean;
  /** Star an Opponent for this Profile. Starring one again changes nothing. */
  add(opponentId: string): StarEarned;
}

export function createStars(store: ProfileStore, profileId: string): Stars {
  const has = (opponentId: string) => store.load(profileId).opponentsBeaten.includes(opponentId);
  return {
    has,
    add(opponentId) {
      const data = store.load(profileId);
      const first = !data.opponentsBeaten.includes(opponentId);
      if (first) store.save(profileId, { ...data, opponentsBeaten: [...data.opponentsBeaten, opponentId] });
      return { type: 'star-earned', opponentId, first };
    },
  };
}
