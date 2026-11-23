import { describe, expect, it } from 'vitest';
import { createFakeAnalyser } from '../engine/fake-analyser';
import { findMissedChance } from './missed-chances';
import type { KindSwitches } from './profiles';

const ALL_ON: KindSwitches = { checkmate: true, queen: true, rook: true, bishopKnight: true };
/** An analyser that knows no positions: only the tactic checks speak. */
const silent = createFakeAnalyser({});

/** Black's king is shut in by its own pawns: Ra8 is checkmate. */
const MATE = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1';
/** The c3 knight can take the queen on d5. */
const QUEEN = '6k1/8/8/3q4/8/2N5/8/6K1 w - - 0 1';
/** Ra8 is checkmate, and the c1 bishop can take the queen on h6 (which can't stop the mate). */
const MATE_AND_QUEEN = '6k1/5ppp/7q/8/8/8/8/R1B3K1 w - - 0 1';
/** The c3 knight forks a rook on a2 and a bishop on e4. */
const ROOK_AND_BISHOP = '6k1/8/8/8/4b3/2N5/r7/6K1 w - - 0 1';

const off = (kind: keyof KindSwitches): KindSwitches => ({ ...ALL_ON, [kind]: false });

describe('findMissedChance', () => {
  it('a checkmate to find', async () => {
    expect(await findMissedChance(MATE, silent, ALL_ON)).toEqual({
      kind: 'checkmate',
      text: 'Ooh! You can checkmate! Can you find it?',
    });
  });

  it('a free queen, rook, bishop or knight to find', async () => {
    expect(await findMissedChance(QUEEN, silent, ALL_ON)).toEqual({
      kind: 'queen',
      text: 'Ooh! You can take a queen! Can you find it?',
    });
    expect(await findMissedChance('6k1/8/8/3r4/8/2N5/8/6K1 w - - 0 1', silent, ALL_ON)).toMatchObject({
      kind: 'rook',
      text: 'Ooh! You can take a rook! Can you find it?',
    });
    expect(await findMissedChance('6k1/8/8/3b4/8/2N5/8/6K1 w - - 0 1', silent, ALL_ON)).toMatchObject({
      kind: 'bishopKnight',
      text: 'Ooh! You can take a bishop! Can you find it?',
    });
    expect(await findMissedChance('6k1/8/8/3n4/8/2N5/8/6K1 w - - 0 1', silent, ALL_ON)).toMatchObject({
      kind: 'bishopKnight',
      text: 'Ooh! You can take a knight! Can you find it?',
    });
  });

  it('works for black too', async () => {
    expect(await findMissedChance('6k1/8/2n5/8/3Q4/8/8/6K1 b - - 0 1', silent, ALL_ON)).toMatchObject({ kind: 'queen' });
  });

  it('never says where: no square and no move in what is spoken', async () => {
    for (const fen of [MATE, QUEEN, ROOK_AND_BISHOP]) {
      const chance = await findMissedChance(fen, silent, ALL_ON);
      expect(chance?.text).toBeTruthy();
      expect(chance?.text).not.toMatch(/[a-h][1-8]/);
    }
    // Not even which piece to move: the queen is taken by the knight, but only the queen is named.
    expect((await findMissedChance(QUEEN, silent, ALL_ON))?.text).not.toContain('knight');
  });

  it('checkmate comes first, then the biggest piece', async () => {
    expect(await findMissedChance(MATE_AND_QUEEN, silent, ALL_ON)).toMatchObject({ kind: 'checkmate' });
    expect(await findMissedChance(ROOK_AND_BISHOP, silent, ALL_ON)).toMatchObject({ kind: 'rook' });
  });

  it('a piece that is guarded, by a capture that is no cheaper, is no treat', async () => {
    // The queen on d1 could take the d5 rook, but the e6 pawn takes back.
    expect(await findMissedChance('6k1/8/4p3/3r4/8/8/8/3Q2K1 w - - 0 1', silent, ALL_ON)).toBeUndefined();
  });

  it('pawns are not treats, and a quiet position has nothing to find', async () => {
    expect(await findMissedChance('6k1/8/8/3p4/8/2N5/8/6K1 w - - 0 1', silent, ALL_ON)).toBeUndefined();
    expect(await findMissedChance('6k1/8/8/8/8/2N5/8/6K1 w - - 0 1', silent, ALL_ON)).toBeUndefined();
  });

  it('a finished game has nothing to find', async () => {
    // Black is checkmated: no turn to take.
    expect(await findMissedChance('R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1', silent, ALL_ON)).toBeUndefined();
  });

  describe('each switch turns off only its own kind', () => {
    it('checkmate', async () => {
      expect(await findMissedChance(MATE, silent, off('checkmate'))).toBeUndefined();
      expect(await findMissedChance(MATE_AND_QUEEN, silent, off('checkmate'))).toMatchObject({ kind: 'queen' });
      expect(await findMissedChance(QUEEN, silent, off('checkmate'))).toMatchObject({ kind: 'queen' });
    });

    it('queen', async () => {
      expect(await findMissedChance(QUEEN, silent, off('queen'))).toBeUndefined();
      expect(await findMissedChance(MATE_AND_QUEEN, silent, off('queen'))).toMatchObject({ kind: 'checkmate' });
      expect(await findMissedChance(ROOK_AND_BISHOP, silent, off('queen'))).toMatchObject({ kind: 'rook' });
    });

    it('rook', async () => {
      expect(await findMissedChance(ROOK_AND_BISHOP, silent, off('rook'))).toMatchObject({ kind: 'bishopKnight' });
      expect(await findMissedChance(QUEEN, silent, off('rook'))).toMatchObject({ kind: 'queen' });
    });

    it('bishop/knight', async () => {
      expect(await findMissedChance('6k1/8/8/3n4/8/2N5/8/6K1 w - - 0 1', silent, off('bishopKnight'))).toBeUndefined();
      expect(await findMissedChance(ROOK_AND_BISHOP, silent, off('bishopKnight'))).toMatchObject({ kind: 'rook' });
      expect(await findMissedChance(MATE, silent, off('bishopKnight'))).toMatchObject({ kind: 'checkmate' });
    });
  });

  describe('with analyser scores', () => {
    const QUEEN_TAKEN = '6k1/8/8/3N4/8/8/8/6K1 b - - 0 1';

    it('alerts when the scores agree taking is about as good as the best move', async () => {
      const analyser = createFakeAnalyser({
        [QUEEN]: [['c3d5', { cp: 900 }]],
        [QUEEN_TAKEN]: [['g8f7', { cp: -880 }]],
      });
      expect(await findMissedChance(QUEEN, analyser, ALL_ON)).toMatchObject({ kind: 'queen' });
    });

    it('stays quiet when taking would be a trap, whatever the piece checks say', async () => {
      // Say taking the queen lets the Opponent checkmate.
      const analyser = createFakeAnalyser({
        [QUEEN]: [['g1f2', { cp: 0 }]],
        [QUEEN_TAKEN]: [['g8g7', { mate: 1 }]],
      });
      expect(await findMissedChance(QUEEN, analyser, ALL_ON)).toBeUndefined();
    });

    it('a trapped bigger piece gives way to a smaller one that really is free', async () => {
      const ROOK_TAKEN = '6k1/8/8/8/4b3/8/N7/6K1 b - - 0 1';
      const BISHOP_TAKEN = '6k1/8/8/8/4N3/8/r7/6K1 b - - 0 1';
      const analyser = createFakeAnalyser({
        [ROOK_AND_BISHOP]: [['c3e4', { cp: 300 }]],
        [ROOK_TAKEN]: [['e4d5', { mate: 2 }]],
        [BISHOP_TAKEN]: [['a2a1', { cp: -300 }]],
      });
      expect(await findMissedChance(ROOK_AND_BISHOP, analyser, ALL_ON)).toMatchObject({ kind: 'bishopKnight' });
    });

    it('a checkmate needs no second opinion', async () => {
      const analyser = createFakeAnalyser({});
      expect(await findMissedChance(MATE, analyser, ALL_ON)).toMatchObject({ kind: 'checkmate' });
      expect(analyser.calls).toEqual([]);
    });

    it('asks nothing when there is nothing to find', async () => {
      const analyser = createFakeAnalyser({});
      await findMissedChance('6k1/8/8/8/8/2N5/8/6K1 w - - 0 1', analyser, ALL_ON);
      expect(analyser.calls).toEqual([]);
    });

    it('falls back on the piece checks when the analyser fails', async () => {
      const broken = { analyse: () => Promise.reject(new Error('no engine')) };
      expect(await findMissedChance(QUEEN, broken, ALL_ON)).toMatchObject({ kind: 'queen' });
    });
  });
});
