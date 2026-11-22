import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MoveChoice, Opponent } from '../opponents/opponent';
import { showThinking } from './thinking';

/** An Opponent whose move arrives when the test says so. */
function slowOpponent() {
  let answer: (m: MoveChoice) => void = () => {};
  const opponent: Opponent = {
    id: 'slow',
    name: 'Slow',
    pickMove: () => new Promise((resolve) => (answer = resolve)),
  };
  return { opponent, answer: (m: MoveChoice) => answer(m) };
}

describe('Opponent thinking', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows thinking while a slow Opponent picks its move, then hides it', async () => {
    const log: string[] = [];
    const { opponent, answer } = slowOpponent();
    const thinking = showThinking(opponent, { start: () => log.push('start'), stop: () => log.push('stop') });
    const move = thinking.pickMove('fen');
    await vi.advanceTimersByTimeAsync(1000);
    expect(log).toEqual(['start']);
    answer({ from: 'e7', to: 'e5' });
    expect(await move).toEqual({ from: 'e7', to: 'e5' });
    expect(log).toEqual(['start', 'stop']);
  });

  it('shows nothing for an Opponent that answers straight away, so it does not flash', async () => {
    const log: string[] = [];
    const quick: Opponent = { id: 'q', name: 'Quick', pickMove: async () => ({ from: 'e7', to: 'e5' }) };
    await showThinking(quick, { start: () => log.push('start'), stop: () => log.push('stop') }).pickMove('fen');
    await vi.advanceTimersByTimeAsync(1000);
    expect(log).toEqual([]);
  });

  it('hides thinking even if the Opponent fails', async () => {
    const log: string[] = [];
    const failing: Opponent = {
      id: 'f',
      name: 'Failing',
      pickMove: () => new Promise((_, reject) => setTimeout(() => reject(new Error('no')), 2000)),
    };
    const move = showThinking(failing, { start: () => log.push('start'), stop: () => log.push('stop') }).pickMove('fen');
    const failed = expect(move).rejects.toThrow('no');
    await vi.advanceTimersByTimeAsync(2000);
    await failed;
    expect(log).toEqual(['start', 'stop']);
  });
});
