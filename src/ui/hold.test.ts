import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHold } from './hold';

describe('Hold to open', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('holding for the full time opens it', () => {
    const opened = vi.fn();
    const hold = createHold(3000, opened);
    hold.press();
    vi.advanceTimersByTime(3000);
    expect(opened).toHaveBeenCalledOnce();
  });

  it('letting go early does nothing, even if the time later passes', () => {
    const opened = vi.fn();
    const hold = createHold(3000, opened);
    hold.press();
    vi.advanceTimersByTime(2999);
    hold.release();
    vi.advanceTimersByTime(5000);
    expect(opened).not.toHaveBeenCalled();
  });

  it('two short holds do not add up', () => {
    const opened = vi.fn();
    const hold = createHold(3000, opened);
    hold.press();
    vi.advanceTimersByTime(2000);
    hold.release();
    hold.press();
    vi.advanceTimersByTime(2000);
    expect(opened).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(opened).toHaveBeenCalledOnce();
  });

  it('pressing again while held does not restart the count or open twice', () => {
    const opened = vi.fn();
    const hold = createHold(3000, opened);
    hold.press();
    vi.advanceTimersByTime(2000);
    hold.press();
    vi.advanceTimersByTime(1000);
    expect(opened).toHaveBeenCalledOnce();
  });
});
