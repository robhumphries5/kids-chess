import { describe, expect, it } from 'vitest';
import { createPointsLedger } from './points';
import { createProfileStore, type KeyValueStorage } from './profiles';
import { createPuzzleSession, type PuzzleSessionEvent } from './puzzle-session';
import { generateFreePiecePuzzle, takesAFreePiece } from './puzzles/free-piece';
import type { Puzzle } from './puzzles/puzzle';
import { seededRandom } from './random';

// White: Ke1, Ra4, Bf1. Black: Ke8, Nd4, Pa7. Both Rxd4 and Rxa7 take a free piece.
const TWO_WAYS = '4k3/p7/8/8/R2n4/8/8/4KB2 w - - 0 1';
const SECOND = '4k3/8/8/8/8/2n5/8/2R1K3 w - - 0 1';

function freePiece(fen: string, hint: { from: string; to: string }): Puzzle {
  return { theme: 'take-the-free-piece', fen, goal: 'Take the free piece!', hint, meetsGoal: (m) => takesAFreePiece(fen, m) };
}

/** Hands out the given puzzles in order. */
function queue(...puzzles: Puzzle[]): () => Puzzle {
  let i = 0;
  return () => puzzles[i++ % puzzles.length];
}

function setUp(...puzzles: Puzzle[]) {
  const map = new Map<string, string>();
  const storage: KeyValueStorage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
  const store = createProfileStore(storage);
  const fox = store.add('fox');
  const session = createPuzzleSession({
    nextPuzzle: queue(...puzzles),
    points: createPointsLedger(store, fox.id),
  });
  const reloadedTotal = () => createProfileStore(storage).load(fox.id).points;
  return { session, reloadedTotal };
}

const types = (events: PuzzleSessionEvent[]) => events.map((e) => e.type);

describe('Puzzle Session', () => {
  it('start shows the first puzzle and speaks its goal', async () => {
    const { session } = setUp(freePiece(TWO_WAYS, { from: 'a4', to: 'd4' }));
    const events = await session.start();
    expect(types(events)).toEqual(['puzzle-started', 'board-changed', 'say']);
    expect(events[0]).toMatchObject({ theme: 'take-the-free-piece', childColour: 'white' });
    expect(events[1]).toMatchObject({ fen: TWO_WAYS, childToMove: true, turn: 'white' });
    if (events[1].type !== 'board-changed') throw new Error();
    expect(events[1].dests['a4']).toContain('d4');
    expect(events[1].dests['e8']).toBeUndefined();
    expect(events[2]).toEqual({ type: 'say', text: 'Take the free piece!' });
  });

  it('a move meeting the goal solves it, awards 30 Points, cheers, and the next puzzle starts', async () => {
    const { session, reloadedTotal } = setUp(freePiece(TWO_WAYS, { from: 'a4', to: 'd4' }), freePiece(SECOND, { from: 'c1', to: 'c3' }));
    await session.start();
    const events = await session.move({ from: 'a4', to: 'd4' });
    expect(types(events)).toEqual([
      'board-changed',
      'sound',
      'puzzle-solved',
      'points-awarded',
      'say',
      'puzzle-started',
      'board-changed',
      'say',
    ]);
    expect(events[0]).toMatchObject({ lastMove: ['a4', 'd4'], childToMove: false });
    expect(events[1]).toEqual({ type: 'sound', sound: 'win' });
    expect(events[3]).toEqual({ type: 'points-awarded', amount: 30, total: 30 });
    expect(events[6]).toMatchObject({ fen: SECOND, childToMove: true });
    expect(events[7]).toEqual({ type: 'say', text: 'Take the free piece!' });
    expect(reloadedTotal()).toBe(30);
  });

  it('a different winning capture than the stored hint is accepted too', async () => {
    const { session } = setUp(freePiece(TWO_WAYS, { from: 'a4', to: 'd4' }));
    await session.start();
    expect(types(await session.move({ from: 'a4', to: 'a7' }))).toContain('puzzle-solved');
  });

  it('a legal move that misses the goal goes back to the puzzle, gently, with no Points', async () => {
    const { session, reloadedTotal } = setUp(freePiece(TWO_WAYS, { from: 'a4', to: 'd4' }));
    await session.start();
    const events = await session.move({ from: 'a4', to: 'b4' });
    expect(types(events)).toEqual(['not-yet', 'board-changed', 'say']);
    expect(events[1]).toMatchObject({ fen: TWO_WAYS, childToMove: true });
    expect(events[2]).toEqual({ type: 'say', text: 'Try again!' });
    expect(reloadedTotal()).toBe(0);
    // Still the same puzzle, and it can still be solved.
    expect(types(await session.move({ from: 'a4', to: 'd4' }))).toContain('puzzle-solved');
  });

  it('an illegal move is rejected and nothing changes', async () => {
    const { session } = setUp(freePiece(TWO_WAYS, { from: 'a4', to: 'd4' }));
    await session.start();
    expect(types(await session.move({ from: 'a4', to: 'e8' }))).toEqual(['move-rejected', 'board-changed']);
  });

  it('Points add up across puzzles and never go down', async () => {
    const { session, reloadedTotal } = setUp(freePiece(TWO_WAYS, { from: 'a4', to: 'd4' }));
    await session.start();
    let previous = 0;
    for (const move of [
      { from: 'a4', to: 'b4' },
      { from: 'a4', to: 'd4' },
      { from: 'a4', to: 'e8' },
      { from: 'a4', to: 'a7' },
    ]) {
      await session.move(move);
      expect(reloadedTotal()).toBeGreaterThanOrEqual(previous);
      previous = reloadedTotal();
    }
    expect(reloadedTotal()).toBe(60);
  });

  it('a pawn reaching the end asks for the Promotion Picker, never auto-queens', async () => {
    // White pawn b7 can take the free rook on a8 (black king far away).
    const fen = 'r7/1P6/8/8/8/8/8/k3K3 w - - 0 1';
    const { session } = setUp(freePiece(fen, { from: 'b7', to: 'a8' }));
    await session.start();
    expect(await session.move({ from: 'b7', to: 'a8' })).toEqual([{ type: 'promotion-needed', from: 'b7', to: 'a8' }]);
    expect(types(await session.move({ from: 'b7', to: 'a8', promotion: 'n' }))).toContain('puzzle-solved');
  });

  it('keeps coming: many generated puzzles in a row, each solved by its stored hint', async () => {
    const random = seededRandom(42);
    let current: Puzzle | undefined;
    const store = createProfileStore(undefined);
    const fox = store.add('fox');
    const session = createPuzzleSession({
      nextPuzzle: () => (current = generateFreePiecePuzzle(random)),
      points: createPointsLedger(store, fox.id),
    });
    await session.start();
    for (let i = 0; i < 20; i++) {
      expect(types(await session.move(current!.hint))).toContain('puzzle-solved');
    }
    expect(store.load(fox.id).points).toBe(600);
  });
});
