import type { Colour } from './session';
import type { Random } from './random';

/** What the child picks before a game: a side, or 🎲 to let the app pick. */
export type ColourChoice = Colour | 'random';

/** The side the child plays. 🎲 picks white or black evenly. */
export function resolveColour(choice: ColourChoice, random: Random = Math.random): Colour {
  if (choice !== 'random') return choice;
  return random() < 0.5 ? 'white' : 'black';
}
