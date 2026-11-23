import { describe, expect, it } from 'vitest';
import { createFakeAnalyser } from '../engine/fake-analyser';
import { findBlunder } from './blunder-warnings';
import type { KindSwitches } from './profiles';

const ALL_ON: KindSwitches = { checkmate: true, queen: true, rook: true, bishopKnight: true };
/** An analyser that knows no positions: only the tactic checks speak. */
const silent = createFakeAnalyser({});

/** White's king is shut in by its own pawns; only the a1 rook guards the back rank. */
const BACK_RANK = '3r2k1/8/8/8/8/8/5PPP/R5K1 w - - 0 1';

/** Moving the queen to d5 lets the f6 knight fork it with the rook on e4. */
const FORK = '7k/8/5n2/8/4R3/8/8/3Q2K1 w - - 0 1';

const move = (uci: string) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4) });

describe('findBlunder', () => {
  it('a queen left where a knight can take it', async () => {
    expect(await findBlunder('6k1/8/5n2/8/8/8/8/3Q2K1 w - - 0 1', move('d1d5'), silent, ALL_ON)).toEqual({
      kind: 'queen',
      reason: 'The knight could take your queen!',
    });
  });

  it('a rook, a bishop or a knight left to be taken', async () => {
    expect(await findBlunder('6k1/8/5n2/8/8/8/8/3R2K1 w - - 0 1', move('d1d5'), silent, ALL_ON)).toEqual({
      kind: 'rook',
      reason: 'The knight could take your rook!',
    });
    expect(await findBlunder('6k1/8/5n2/8/4B3/8/8/6K1 w - - 0 1', move('e4d5'), silent, ALL_ON)).toEqual({
      kind: 'bishopKnight',
      reason: 'The knight could take your bishop!',
    });
    expect(await findBlunder('6k1/8/5n2/8/8/2N5/8/6K1 w - - 0 1', move('c3d5'), silent, ALL_ON)).toEqual({
      kind: 'bishopKnight',
      reason: 'The knight could take your knight!',
    });
  });

  it('works for black too', async () => {
    expect(await findBlunder('3q2k1/8/8/8/8/2N5/8/6K1 b - - 0 1', move('d8d5'), silent, ALL_ON)).toEqual({
      kind: 'queen',
      reason: 'The knight could take your queen!',
    });
  });

  it('a piece that can be taken back, by a piece worth no less, is not a blunder', async () => {
    // The rook on d5 is guarded by the e4 pawn; the queen taking it would be taken back.
    expect(await findBlunder('3q2k1/8/8/8/4P3/8/8/3R2K1 w - - 0 1', move('d1d5'), silent, ALL_ON)).toBeUndefined();
  });

  it('a move that lets the Opponent checkmate next', async () => {
    // The rook leaves the back rank, so the black rook can mate on d1.
    expect(await findBlunder(BACK_RANK, move('a1a7'), silent, ALL_ON)).toEqual({
      kind: 'checkmate',
      reason: 'The rook could checkmate you!',
    });
    expect(await findBlunder(BACK_RANK, move('a1b1'), silent, ALL_ON)).toBeUndefined();
  });

  it('when two pieces can be taken, the warning is about the bigger one', async () => {
    // The knight on f6 forks the queen on d5 and the rook on e4.
    expect(await findBlunder(FORK, move('d1d5'), silent, ALL_ON)).toMatchObject({ kind: 'queen' });
  });

  it('names the smallest piece that could take it', async () => {
    expect(await findBlunder('3r2k1/8/4p3/8/8/8/8/3Q2K1 w - - 0 1', move('d1d5'), silent, ALL_ON)).toEqual({
      kind: 'queen',
      reason: 'The pawn could take your queen!',
    });
  });

  describe('each switch turns off only its own kind', () => {
    /** The rook leaves the back rank, and the queen on h4 is still there for the knight to take. */
    const MATE_AND_QUEEN = '3r2k1/8/6n1/8/7Q/8/5PPP/R5K1 w - - 0 1';
    const off = (kind: keyof KindSwitches) => ({ ...ALL_ON, [kind]: false });

    it('checkmate', async () => {
      expect(await findBlunder(MATE_AND_QUEEN, move('a1a7'), silent, ALL_ON)).toMatchObject({ kind: 'checkmate' });
      expect(await findBlunder(MATE_AND_QUEEN, move('a1a7'), silent, off('checkmate'))).toEqual({
        kind: 'queen',
        reason: 'The knight could take your queen!',
      });
    });

    it('queen', async () => {
      expect(await findBlunder(MATE_AND_QUEEN, move('a1a7'), silent, off('queen'))).toMatchObject({ kind: 'checkmate' });
      expect(await findBlunder(FORK, move('d1d5'), silent, off('queen'))).toMatchObject({ kind: 'rook' });
    });

    it('rook', async () => {
      expect(await findBlunder(FORK, move('d1d5'), silent, off('rook'))).toMatchObject({ kind: 'queen' });
      expect(await findBlunder(FORK, move('d1d5'), silent, { ...ALL_ON, queen: false, rook: false })).toBeUndefined();
    });

    it('bishop/knight', async () => {
      const bishop = '6k1/8/5n2/8/4B3/8/8/6K1 w - - 0 1';
      expect(await findBlunder(bishop, move('e4d5'), silent, off('bishopKnight'))).toBeUndefined();
      expect(await findBlunder(FORK, move('d1d5'), silent, off('bishopKnight'))).toMatchObject({ kind: 'queen' });
    });
  });

  describe('with analyser scores', () => {
    const QUEEN = '6k1/8/5n2/8/8/8/8/3Q2K1 w - - 0 1';
    const QUEEN_ON_D5 = '6k1/8/5n2/3Q4/8/8/8/6K1 b - - 1 1';

    it('warns when the scores agree the move gives something away', async () => {
      const analyser = createFakeAnalyser({
        [QUEEN]: [['d1d2', { cp: 50 }]],
        [QUEEN_ON_D5]: [['f6d5', { cp: 850 }]],
      });
      expect(await findBlunder(QUEEN, move('d1d5'), analyser, ALL_ON)).toMatchObject({ kind: 'queen' });
    });

    it('stays quiet when the move is about as good as the best one, whatever the piece checks say', async () => {
      // Say every other move lost even more: giving up the queen is then no blunder.
      const analyser = createFakeAnalyser({
        [QUEEN]: [['d1d5', { cp: -850 }]],
        [QUEEN_ON_D5]: [['f6d5', { cp: 850 }]],
      });
      expect(await findBlunder(QUEEN, move('d1d5'), analyser, ALL_ON)).toBeUndefined();
    });

    it('stays quiet about a checkmate no move could stop', async () => {
      const after = '3r2k1/R7/8/8/8/8/5PPP/6K1 b - - 1 1';
      const analyser = createFakeAnalyser({
        [BACK_RANK]: [['a1a7', { mate: -1 }]],
        [after]: [['d8d1', { mate: 1 }]],
      });
      expect(await findBlunder(BACK_RANK, move('a1a7'), analyser, ALL_ON)).toBeUndefined();
    });

    it('falls back on the piece checks when the analyser fails', async () => {
      const broken = { analyse: () => Promise.reject(new Error('no engine')) };
      expect(await findBlunder(QUEEN, move('d1d5'), broken, ALL_ON)).toMatchObject({ kind: 'queen' });
    });
  });

  it('a quiet safe move is not a blunder', async () => {
    expect(await findBlunder('6k1/8/5n2/8/8/8/8/3Q2K1 w - - 0 1', move('d1d2'), silent, ALL_ON)).toBeUndefined();
  });

  it('a fair swap is not a blunder: queen takes queen, and a pawn takes back', async () => {
    expect(await findBlunder('6k1/8/4p3/3q4/8/8/8/3Q2K1 w - - 0 1', move('d1d5'), silent, ALL_ON)).toBeUndefined();
  });
});
