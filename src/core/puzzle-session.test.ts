import { describe, expect, it } from 'vitest';
import { createPointsLedger } from './points';
import { createProfileStore, type KeyValueStorage } from './profiles';
import { createPuzzleSession, type PuzzleSessionEvent } from './puzzle-session';
import { generateFreePiecePuzzle, takesAFreePiece } from './puzzles/free-piece';
import { deliversCheckmate, generateMateInOnePuzzle } from './puzzles/mate-in-one';
import { generateNewPiecePuzzle, makesANewPiece } from './puzzles/new-piece';
import type { Puzzle } from './puzzles/puzzle';
import { generateRunAwayPuzzle, leavesItSafe } from './puzzles/run-away';
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
    expect(events[2]).toEqual({ type: 'puzzle-solved', points: 30 });
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

  it('a first wrong move goes back, says "Nearly! Try again!" and wobbles the right piece (Hint Step 1)', async () => {
    const { session, reloadedTotal } = setUp(freePiece(TWO_WAYS, { from: 'a4', to: 'd4' }));
    await session.start();
    const events = await session.move({ from: 'a4', to: 'b4' });
    expect(types(events)).toEqual(['not-yet', 'board-changed', 'say', 'hint-step']);
    expect(events[1]).toMatchObject({ fen: TWO_WAYS, childToMove: true });
    expect(events[2]).toEqual({ type: 'say', text: 'Nearly! Try again!' });
    expect(events[3]).toEqual({ type: 'hint-step', step: 1, piece: 'a4' });
    expect(reloadedTotal()).toBe(0);
  });

  it('solving after Hint Step 1 gives 20 Points', async () => {
    const { session, reloadedTotal } = setUp(freePiece(TWO_WAYS, { from: 'a4', to: 'd4' }));
    await session.start();
    await session.move({ from: 'a4', to: 'b4' });
    const events = await session.move({ from: 'a4', to: 'a7' });
    expect(events).toContainEqual({ type: 'puzzle-solved', points: 20 });
    expect(events).toContainEqual({ type: 'points-awarded', amount: 20, total: 20 });
    expect(reloadedTotal()).toBe(20);
  });

  it('a second wrong move goes back and shows the answer with an arrow (Hint Step 2); solving then gives 10', async () => {
    const { session, reloadedTotal } = setUp(freePiece(TWO_WAYS, { from: 'a4', to: 'd4' }));
    await session.start();
    await session.move({ from: 'a4', to: 'b4' });
    const events = await session.move({ from: 'f1', to: 'e2' });
    expect(types(events)).toEqual(['not-yet', 'board-changed', 'say', 'hint-step']);
    expect(events[1]).toMatchObject({ fen: TWO_WAYS, childToMove: true });
    expect(events[2]).toEqual({ type: 'say', text: 'Nearly! Follow the arrow!' });
    expect(events[3]).toEqual({ type: 'hint-step', step: 2, move: { from: 'a4', to: 'd4' } });
    expect(await session.move({ from: 'a4', to: 'd4' })).toContainEqual({ type: 'puzzle-solved', points: 10 });
    expect(reloadedTotal()).toBe(10);
  });

  it('a third wrong move: the app plays the answer with "Watch this!", gives 0 Points and moves on cheerfully', async () => {
    const { session, reloadedTotal } = setUp(freePiece(TWO_WAYS, { from: 'a4', to: 'd4' }), freePiece(SECOND, { from: 'c1', to: 'c3' }));
    await session.start();
    await session.move({ from: 'a4', to: 'b4' });
    await session.move({ from: 'a4', to: 'b4' });
    const events = await session.move({ from: 'f1', to: 'e2' });
    expect(types(events)).toEqual([
      'not-yet',
      'board-changed',
      'say',
      'hint-step',
      'board-changed',
      'sound',
      'puzzle-solved',
      'points-awarded',
      'say',
      'puzzle-started',
      'board-changed',
      'say',
    ]);
    expect(events[1]).toMatchObject({ fen: TWO_WAYS, childToMove: true });
    expect(events[2]).toEqual({ type: 'say', text: 'Watch this!' });
    expect(events[3]).toEqual({ type: 'hint-step', step: 3, move: { from: 'a4', to: 'd4' } });
    expect(events[4]).toMatchObject({ fen: '4k3/p7/8/8/3R4/8/8/4KB2 b - - 0 1', lastMove: ['a4', 'd4'], childToMove: false });
    expect(events[5]).toEqual({ type: 'sound', sound: 'capture' });
    expect(events[6]).toEqual({ type: 'puzzle-solved', points: 0 });
    expect(events[7]).toEqual({ type: 'points-awarded', amount: 0, total: 0 });
    expect(events[8]).toEqual({ type: 'say', text: "Now you know! Let's try another." });
    expect(events[10]).toMatchObject({ fen: SECOND, childToMove: true });
    expect(reloadedTotal()).toBe(0);
    // The next puzzle starts fresh: no mistakes there earns the full 30.
    expect(await session.move({ from: 'c1', to: 'c3' })).toContainEqual({ type: 'puzzle-solved', points: 30 });
    expect(reloadedTotal()).toBe(30);
  });

  it('never says anything negative, whatever happens', async () => {
    const { session } = setUp(freePiece(TWO_WAYS, { from: 'a4', to: 'd4' }));
    const said: string[] = [];
    const collect = (events: PuzzleSessionEvent[]) => events.forEach((e) => e.type === 'say' && said.push(e.text));
    collect(await session.start());
    for (let i = 0; i < 6; i++) collect(await session.move({ from: 'a4', to: 'b4' }));
    expect(said.length).toBeGreaterThan(6);
    for (const text of said) expect(text).not.toMatch(/wrong|fail|lost|lose|bad|no!|oops|sorry/i);
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
    expect(reloadedTotal()).toBe(50); // 20 (after one hint) + 30
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

describe('Puzzle Session with "Checkmate in one!" puzzles', () => {
  // White: Kg6, Qa7. Black: Kh8. Qa8, Qb8, Qg7 and Qh7 all mate.
  const FOUR_MATES = '7k/Q7/6K1/8/8/8/8/8 w - - 0 1';
  const mateInOne = (fen: string, hint: { from: string; to: string }): Puzzle => ({
    theme: 'checkmate-in-one',
    fen,
    goal: 'Checkmate in one!',
    hint,
    meetsGoal: (m) => deliversCheckmate(fen, m),
  });
  const pointsAwarded = (events: PuzzleSessionEvent[]) => events.find((e) => e.type === 'puzzle-solved');

  it('speaks the goal when a generated puzzle starts', async () => {
    const { session } = setUp(generateMateInOnePuzzle(seededRandom(3)));
    const events = await session.start();
    expect(events).toContainEqual({ type: 'say', text: 'Checkmate in one!' });
    expect(events[0]).toMatchObject({ theme: 'checkmate-in-one', childColour: 'white' });
  });

  it('a different mate from the stored hint is accepted, for full Points', async () => {
    const { session } = setUp(mateInOne(FOUR_MATES, { from: 'a7', to: 'g7' }));
    await session.start();
    expect(pointsAwarded(await session.move({ from: 'a7', to: 'b8' }))).toEqual({ type: 'puzzle-solved', points: 30 });
  });

  it('a check that is not mate, then a quiet move, step through the Hint Steps; mating then gives 10 Points', async () => {
    const { session } = setUp(mateInOne(FOUR_MATES, { from: 'a7', to: 'g7' }));
    await session.start();
    expect(await session.move({ from: 'a7', to: 'd4' })).toContainEqual({ type: 'hint-step', step: 1, piece: 'a7' });
    expect(await session.move({ from: 'a7', to: 'a6' })).toContainEqual({
      type: 'hint-step',
      step: 2,
      move: { from: 'a7', to: 'g7' },
    });
    expect(pointsAwarded(await session.move({ from: 'a7', to: 'h7' }))).toEqual({ type: 'puzzle-solved', points: 10 });
  });

  it('keeps coming: many generated puzzles in a row, each solved by its stored hint', async () => {
    const random = seededRandom(9);
    let current: Puzzle | undefined;
    const store = createProfileStore(undefined);
    const fox = store.add('fox');
    const session = createPuzzleSession({
      nextPuzzle: () => (current = generateMateInOnePuzzle(random)),
      points: createPointsLedger(store, fox.id),
    });
    await session.start();
    for (let i = 0; i < 10; i++) {
      expect(types(await session.move(current!.hint))).toContain('puzzle-solved');
    }
    expect(store.load(fox.id).points).toBe(300);
  });
});

describe('Puzzle Session with "Make a new piece!" puzzles', () => {
  // White: Kg1, Pb7. Black: Ke8, Nc8. The pawn can go straight on to b8 or take on c8.
  const TWO_WAYS = '2n1k3/1P6/8/8/8/8/8/6K1 w - - 0 1';
  const newPiece = (): Puzzle => ({
    theme: 'make-a-new-piece',
    fen: TWO_WAYS,
    goal: 'Make a new piece!',
    hint: { from: 'b7', to: 'b8', promotion: 'q' },
    meetsGoal: (m) => makesANewPiece(TWO_WAYS, m),
  });
  const solved = (events: PuzzleSessionEvent[]) => events.find((e) => e.type === 'puzzle-solved');

  it('speaks the goal when a generated puzzle starts', async () => {
    const { session } = setUp(generateNewPiecePuzzle(seededRandom(3)));
    const events = await session.start();
    expect(events).toContainEqual({ type: 'say', text: 'Make a new piece!' });
    expect(events[0]).toMatchObject({ theme: 'make-a-new-piece', childColour: 'white' });
  });

  it('every promotion shows the Promotion Picker, and queen, rook, bishop or knight all count, for full Points', async () => {
    for (const promotion of ['q', 'r', 'b', 'n'] as const) {
      const { session } = setUp(newPiece());
      await session.start();
      expect(await session.move({ from: 'b7', to: 'c8' })).toEqual([{ type: 'promotion-needed', from: 'b7', to: 'c8' }]);
      expect(solved(await session.move({ from: 'b7', to: 'c8', promotion })), promotion).toEqual({
        type: 'puzzle-solved',
        points: 30,
      });
    }
  });

  it('a move that does not promote steps through the Hint Steps, and the app makes a queen in the end', async () => {
    const { session } = setUp(newPiece());
    await session.start();
    expect(await session.move({ from: 'g1', to: 'g2' })).toContainEqual({ type: 'hint-step', step: 1, piece: 'b7' });
    expect(await session.move({ from: 'g1', to: 'h1' })).toContainEqual({ type: 'hint-step', step: 2, move: { from: 'b7', to: 'b8' } });
    const events = await session.move({ from: 'g1', to: 'f1' });
    expect(solved(events)).toEqual({ type: 'puzzle-solved', points: 0 });
    const played = events.find((e) => e.type === 'board-changed' && e.lastMove);
    expect(played).toMatchObject({ lastMove: ['b7', 'b8'] });
    if (played?.type !== 'board-changed') throw new Error();
    expect(played.fen.split(' ')[0]).toContain('Q');
  });

  it('keeps coming: many generated puzzles in a row, each solved by its stored hint', async () => {
    const random = seededRandom(11);
    let current: Puzzle | undefined;
    const store = createProfileStore(undefined);
    const fox = store.add('fox');
    const session = createPuzzleSession({
      nextPuzzle: () => (current = generateNewPiecePuzzle(random)),
      points: createPointsLedger(store, fox.id),
    });
    await session.start();
    for (let i = 0; i < 10; i++) {
      expect(types(await session.move(current!.hint))).toContain('puzzle-solved');
    }
    expect(store.load(fox.id).points).toBe(300);
  });
});

describe('Puzzle Session with "Run away!" puzzles', () => {
  // White: Kg1, Nd4, Ra1. Black: Ke8, Rd8 attacks the knight, which nothing defends.
  const HANGING_KNIGHT = '3rk3/8/8/8/3N4/8/8/R5K1 w - - 0 1';
  const runAway = (): Puzzle => ({
    theme: 'run-away',
    fen: HANGING_KNIGHT,
    goal: 'Run away!',
    hint: { from: 'd4', to: 'b5' },
    meetsGoal: (m) => leavesItSafe(HANGING_KNIGHT, 'd4', m),
  });
  const solved = (events: PuzzleSessionEvent[]) => events.find((e) => e.type === 'puzzle-solved');

  it('speaks the goal when a generated puzzle starts', async () => {
    const { session } = setUp(generateRunAwayPuzzle(seededRandom(3)));
    const events = await session.start();
    expect(events).toContainEqual({ type: 'say', text: 'Run away!' });
    expect(events[0]).toMatchObject({ theme: 'run-away', childColour: 'white' });
  });

  it('defending the piece instead of moving it counts, for full Points', async () => {
    const { session } = setUp(runAway());
    await session.start();
    expect(solved(await session.move({ from: 'a1', to: 'd1' }))).toEqual({ type: 'puzzle-solved', points: 30 });
  });

  it('a move that leaves it to be taken wobbles the piece in danger; solving after that gives 20', async () => {
    const { session } = setUp(runAway());
    await session.start();
    expect(await session.move({ from: 'a1', to: 'a2' })).toContainEqual({ type: 'hint-step', step: 1, piece: 'd4' });
    expect(solved(await session.move({ from: 'd4', to: 'f5' }))).toEqual({ type: 'puzzle-solved', points: 20 });
  });

  it('keeps coming: many generated puzzles in a row, each solved by its stored hint', async () => {
    const random = seededRandom(13);
    let current: Puzzle | undefined;
    const store = createProfileStore(undefined);
    const fox = store.add('fox');
    const session = createPuzzleSession({
      nextPuzzle: () => (current = generateRunAwayPuzzle(random)),
      points: createPointsLedger(store, fox.id),
    });
    await session.start();
    for (let i = 0; i < 10; i++) {
      expect(types(await session.move(current!.hint))).toContain('puzzle-solved');
    }
    expect(store.load(fox.id).points).toBe(300);
  });
});