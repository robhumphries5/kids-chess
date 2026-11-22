import type { Speaker } from './speech';

export interface Choice {
  id: string;
  /** Spoken when the choice is tapped. */
  name: string;
}

export interface MenuChoice<C extends Choice> {
  readonly selected: C | undefined;
  /** Speak the choice's name and select it. Nothing happens yet: Go confirms. */
  tap(id: string): void;
  /** The Go Button: the selected choice, or undefined if nothing is selected yet. */
  go(): C | undefined;
}

/** The menu navigation pattern: tap to hear and select, Go to confirm. Board moves don't use this. */
export function createMenuChoice<C extends Choice>(choices: readonly C[], speaker: Speaker): MenuChoice<C> {
  let selected: C | undefined;
  return {
    get selected() {
      return selected;
    },
    tap(id) {
      const choice = choices.find((c) => c.id === id);
      if (!choice) return;
      selected = choice;
      speaker.say(choice.name);
    },
    go: () => selected,
  };
}
