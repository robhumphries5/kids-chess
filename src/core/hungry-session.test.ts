import { describe, expect, it } from 'vitest';
import type { HungryLevel, HungryPiece } from './hungry-pieces';
import { createHungrySession, type HungryBoard, type HungrySessionEvent } from './hungry-session';
import { createPointsLedger } from './points';
import { createProfileStore, type KeyValueStorage } from './profiles';

function memoryStorage(map = new Map<string, string>()): KeyValueStorage {
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** Rook levels laid out by hand: level n has the apples listed for it. */
const ROOK_LEVELS: Record<number, Omit<HungryLevel, 'piece'>> = {
  1: { start: 'a1', apples: ['a5'] },
  2: { start: 'a1', apples: ['a5', 'h5'] },
  3: { start: 'h8', apples: ['a1', 'b2'] },
};

function setUp(piece: HungryPiece = 'rook') {
  const store = createProfileStore(memoryStorage());
  const fox = store.add('fox');
  const points = createPointsLedger(store, fox.id);
  const session = createHungrySession({
    piece,
    points,
    nextLevel: (n, p) => ({ piece: p, ...ROOK_LEVELS[Math.min(n, 3)] }),
    random: () => 0,
  });
  return { session, points };
}

const boards = (events: HungrySessionEvent[]) => events.filter((e): e is HungryBoard => e.type === 'hungry-board');
const lastBoard = (events: HungrySessionEvent[]) => boards(events).at(-1)!;
const said = (events: HungrySessionEvent[]) => events.flatMap((e) => (e.type === 'say' ? [e.text] : []));
const sounds = (events: HungrySessionEvent[]) => events.flatMap((e) => (e.type === 'sound' ? [e.sound] : []));

describe('Hungry Pieces session', () => {
  it('starts the first level: the piece, its apples and where it can go, with the goal spoken', () => {
    const { session } = setUp();
    const events = session.start();
    expect(events[0]).toEqual({ type: 'level-started', level: 1, apples: 1 });
    const board = lastBoard(events);
    expect(board).toMatchObject({ piece: 'rook', square: 'a1', apples: ['a5'], moves: 0 });
    expect(board.dests).toContain('a5');
    expect(board.dests).not.toContain('a6');
    expect(said(events)).toEqual(['Eat the apple!']);
  });

  it('says "apples" when there is more than one', () => {
    const { session } = setUp();
    session.start();
    session.move('a2');
    session.move('a3');
    const events = session.move('a5');
    expect(said(events.slice(events.findIndex((e) => e.type === 'level-started')))).toEqual(['Eat all the apples!']);
  });

  it('a plain move goes "tok" and the apples stay', () => {
    const { session } = setUp();
    session.start();
    const events = session.move('a3');
    expect(sounds(events)).toEqual(['move']);
    expect(lastBoard(events)).toMatchObject({ square: 'a3', apples: ['a5'], moves: 1, lastMove: ['a1', 'a3'] });
  });

  it('a move the piece cannot make changes nothing', () => {
    const { session, points } = setUp();
    session.start();
    const events = session.move('b2');
    expect(events[0]).toEqual({ type: 'move-rejected', to: 'b2' });
    expect(lastBoard(events)).toMatchObject({ square: 'a1', moves: 0 });
    expect(points.total()).toBe(0);
  });

  it('landing on an apple eats it, with a chomp and a happy line', () => {
    const { session } = setUp();
    session.start();
    session.move('a2'); // Level 1 has one apple; get to level 2 first.
    session.move('a5');
    const events = session.move('a5');
    expect(events).toContainEqual({ type: 'apple-eaten', square: 'a5', left: 1 });
    expect(sounds(events)).toEqual(['capture']);
    expect(said(events)).toHaveLength(1);
    expect(lastBoard(events).apples).toEqual(['h5']);
  });

  it('eating the last apple in the fewest moves earns 30 Points through the ledger and moves on', () => {
    const { session, points } = setUp();
    session.start();
    const events = session.move('a5');
    expect(events).toContainEqual({ type: 'level-finished', moves: 1, fewest: 1, points: 30 });
    expect(events).toContainEqual({ type: 'points-awarded', amount: 30, total: 30 });
    expect(points.total()).toBe(30);
    expect(sounds(events)).toContain('win');
    expect(events).toContainEqual({ type: 'level-started', level: 2, apples: 2 });
    expect(lastBoard(events)).toMatchObject({ square: 'a1', apples: ['a5', 'h5'], moves: 0 });
  });

  it('taking more moves still earns Points, just fewer', () => {
    const { session, points } = setUp();
    session.start();
    session.move('a2');
    const events = session.move('a5');
    expect(events).toContainEqual({ type: 'level-finished', moves: 2, fewest: 1, points: 20 });
    expect(points.total()).toBe(20);
  });

  it('compares with the fewest moves the search finds for the level', () => {
    const { session } = setUp();
    session.start();
    session.move('a5'); // Level 2.
    session.move('a5');
    session.move('h5'); // Level 3: rook on h8, apples a1 and b2; 4 moves at best.
    session.move('h2');
    session.move('b2');
    session.move('b1');
    const events = session.move('a1');
    expect(events).toContainEqual({ type: 'level-finished', moves: 4, fewest: 4, points: 30 });
  });

  it('says how many moves it took, and cheers the fewest possible', () => {
    const { session } = setUp();
    session.start();
    const perfect = said(session.move('a5'));
    expect(perfect.some((t) => t.includes('1 move') && t.includes('fewest'))).toBe(true);
    session.move('a2');
    session.move('a5');
    const slower = said(session.move('h5'));
    expect(slower.some((t) => t.includes('3 moves') && !t.includes('fewest'))).toBe(true);
  });
});
