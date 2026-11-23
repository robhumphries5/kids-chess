import { describe, expect, it } from 'vitest';
import { captureGain, isWinningFork } from './tactics';

describe('captureGain: what a capture wins once the swaps on that square are over', () => {
  it('an undefended piece is won outright', () => {
    // White Ra4 takes the loose knight on d4.
    expect(captureGain('4k3/8/8/8/R2n4/8/8/4K3 w - - 0 1', { from: 'a4', to: 'd4' })).toBe(300);
  });

  it('taking a defended piece with something worth more loses the difference', () => {
    // Rxd4, then the black king on e5 takes the rook: +300 - 500.
    expect(captureGain('8/8/8/4k3/R2n4/8/8/4K3 w - - 0 1', { from: 'a4', to: 'd4' })).toBe(-200);
  });

  it('taking a defended piece with something worth less still wins', () => {
    // Nxd5 (knight takes rook), then cxd5: +500 - 300.
    expect(captureGain('4k3/8/2p5/3r4/8/4N3/8/4K3 w - - 0 1', { from: 'e3', to: 'd5' })).toBe(200);
  });

  it('a like-for-like swap wins nothing', () => {
    // Nxd5 (knight takes knight), then cxd5.
    expect(captureGain('4k3/8/2p5/3n4/8/4N3/8/4K3 w - - 0 1', { from: 'e3', to: 'd5' })).toBe(0);
  });

  it('a defender is only worth using if taking back pays', () => {
    // Bxd5 (bishop takes pawn); the queen on d8 could take back but would be lost to Rxd5 behind.
    // So black leaves it: white is a pawn up.
    expect(captureGain('3qk3/8/8/3p4/4B3/8/3R4/4K3 w - - 0 1', { from: 'e4', to: 'd5' })).toBe(100);
  });

  it('is null for a move that captures nothing or is illegal', () => {
    expect(captureGain('4k3/8/8/8/R2n4/8/8/4K3 w - - 0 1', { from: 'a4', to: 'b4' })).toBeNull();
    expect(captureGain('4k3/8/8/8/R2n4/8/8/4K3 w - - 0 1', { from: 'a4', to: 'e8' })).toBeNull();
  });
});

describe('isWinningFork: the moved piece attacks two or more pieces that cannot all be saved', () => {
  // White: Ke1, Nb5, Nd5. Black: Ke8, Ra8. Either knight to c7 attacks the king and the rook.
  const KING_AND_ROOK = 'r3k3/8/8/1N1N4/8/8/8/4K3 w - - 0 1';

  it('a knight fork of king and rook is a winning fork', () => {
    expect(isWinningFork(KING_AND_ROOK, { from: 'b5', to: 'c7' })).toBe(true);
  });

  it('any move making the winning double attack counts, not just one', () => {
    expect(isWinningFork(KING_AND_ROOK, { from: 'd5', to: 'c7' })).toBe(true);
  });

  it('a move that attacks only one piece is not a fork', () => {
    // Nd5-b6 attacks only the rook.
    expect(isWinningFork(KING_AND_ROOK, { from: 'd5', to: 'b6' })).toBe(false);
  });

  it('a fork where the forking piece is simply taken does not count', () => {
    // The bishop on d8 guards c7.
    expect(isWinningFork('r2bk3/8/8/1N6/8/8/8/4K3 w - - 0 1', { from: 'b5', to: 'c7' })).toBe(false);
  });

  it('a double attack where nothing is won in the end does not count', () => {
    // Nc7+ attacks the king and the bishop on a6, but the bishop is guarded: Nxa6 bxa6 is an even swap.
    expect(isWinningFork('4k3/1p6/b7/1N6/8/8/8/4K3 w - - 0 1', { from: 'b5', to: 'c7' })).toBe(false);
  });

  it('a queen fork counts too', () => {
    // Qd5+ attacks the king on g8 and the loose rook on a8.
    expect(isWinningFork('r5k1/8/8/8/8/8/8/3QK3 w - - 0 1', { from: 'd1', to: 'd5' })).toBe(true);
  });

  it('an illegal move is not a fork', () => {
    expect(isWinningFork(KING_AND_ROOK, { from: 'b5', to: 'c6' })).toBe(false);
  });
});
