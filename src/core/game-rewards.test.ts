import { describe, expect, it } from 'vitest';
import { pointsForResult } from './game-rewards';

describe('Points for a game result', () => {
  it('beating the weakest Opponent (strength 1) earns 50 Points', () => {
    expect(pointsForResult('won', 1)).toBe(50);
  });

  it('beating a stronger Opponent earns more, rising 25 a step up to the Dragon', () => {
    expect([1, 2, 3, 4, 5, 6].map((s) => pointsForResult('won', s))).toEqual([50, 75, 100, 125, 150, 175]);
  });

  it('losing earns 10 good-try Points, whoever won', () => {
    expect(pointsForResult('lost', 1)).toBe(10);
    expect(pointsForResult('lost', 6)).toBe(10);
  });

  it('a draw earns 10 Points too: every game earns something', () => {
    expect(pointsForResult('drawn', 1)).toBe(10);
    expect(pointsForResult('drawn', 6)).toBe(10);
  });
});
