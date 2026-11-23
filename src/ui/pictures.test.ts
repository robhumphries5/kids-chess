import { describe, expect, it } from 'vitest';
import { OPPONENTS } from '../opponents/roster';
import { OPPONENT_PICTURES } from './pictures';

describe('Opponent pictures', () => {
  it('every Opponent on the picker has a picture of its own', () => {
    const pictures = OPPONENTS.map((o) => OPPONENT_PICTURES[o.id]);
    for (const picture of pictures) expect(picture).toMatch(/^<svg /);
    expect(new Set(pictures).size).toBe(OPPONENTS.length);
  });
});
