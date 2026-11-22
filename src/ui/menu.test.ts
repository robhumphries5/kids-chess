import { describe, expect, it } from 'vitest';
import { createMenuChoice } from './menu';

function fakeSpeaker() {
  const said: string[] = [];
  return { said, say: (text: string) => void said.push(text) };
}

const HOME = [
  { id: 'puzzles', name: 'Puzzles' },
  { id: 'play', name: 'Play' },
  { id: 'mini-games', name: 'Mini-games' },
];

describe('Menu choice', () => {
  it('tapping a choice speaks its name and selects it', () => {
    const speaker = fakeSpeaker();
    const menu = createMenuChoice(HOME, speaker);
    menu.tap('play');
    expect(speaker.said).toEqual(['Play']);
    expect(menu.selected?.id).toBe('play');
  });

  it('the Go Button confirms the selected choice', () => {
    const menu = createMenuChoice(HOME, fakeSpeaker());
    menu.tap('puzzles');
    menu.tap('play');
    expect(menu.go()?.id).toBe('play');
  });

  it('the Go Button does nothing until a choice is selected', () => {
    const speaker = fakeSpeaker();
    const menu = createMenuChoice(HOME, speaker);
    expect(menu.go()).toBeUndefined();
    expect(speaker.said).toEqual([]);
  });

  it('tapping the same choice again says it again', () => {
    const speaker = fakeSpeaker();
    const menu = createMenuChoice(HOME, speaker);
    menu.tap('play');
    menu.tap('play');
    expect(speaker.said).toEqual(['Play', 'Play']);
  });

  it('ignores a tap on something that is not a choice', () => {
    const speaker = fakeSpeaker();
    const menu = createMenuChoice(HOME, speaker);
    menu.tap('play');
    menu.tap('nope');
    expect(menu.selected?.id).toBe('play');
    expect(speaker.said).toEqual(['Play']);
  });
});
