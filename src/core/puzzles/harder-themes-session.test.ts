// The "Is it really free?" and simple-fork themes inside a Puzzle Session: Hint Steps and Points.
import { Chess, type Move } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { MoveChoice, PromotionPiece } from '../../opponents/opponent';
import { createPointsLedger } from '../points';
import { createProfileStore, type KeyValueStorage } from '../profiles';
import { createPuzzleSession, type PuzzleSessionEvent } from '../puzzle-session';
import { seededRandom } from '../random';
import { captureGain, isWinningFork } from '../tactics';
import { FORK_THEME, generateForkPuzzle } from './fork';
import type { Puzzle } from './puzzle';
import { generateReallyFreePuzzle } from './really-free';

function sessionFor(puzzle: Puzzle) {
  const map = new Map<string, string>();
  const storage: KeyValueStorage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
  const store = createProfileStore(storage);
  const fox = store.add('fox');
  return createPuzzleSession({ nextPuzzle: () => puzzle, points: createPointsLedger(store, fox.id) });
}

/** A legal move as the board would send it. */
const choice = (m: Move): MoveChoice => ({ from: m.from, to: m.to, promotion: m.promotion as PromotionPiece | undefined });

const solved = (events: PuzzleSessionEvent[]) => events.find((e) => e.type === 'puzzle-solved');

describe('"Is it really free?" in a Puzzle Session', () => {
  const puzzle = generateReallyFreePuzzle(seededRandom(11));
  const trap = new Chess(puzzle.fen).moves({ verbose: true }).find((m) => m.captured && (captureGain(puzzle.fen, m) ?? 0) < 0)!;

  it('says its goal when it starts', async () => {
    expect(await sessionFor(puzzle).start()).toContainEqual({ type: 'say', text: 'Is it really free? Find a good piece to take!' });
  });

  it('taking the defended bait is a gentle miss with Hint Step 1; the answer then earns 20 Points', async () => {
    const session = sessionFor(puzzle);
    await session.start();
    const miss = await session.move({ from: trap.from, to: trap.to });
    expect(miss).toContainEqual({ type: 'say', text: 'Nearly! Try again!' });
    expect(miss).toContainEqual({ type: 'hint-step', step: 1, piece: puzzle.hint.from });
    expect(solved(await session.move(puzzle.hint))).toEqual({ type: 'puzzle-solved', points: 20 });
  });
});

describe('Simple forks in a Puzzle Session', () => {
  // White: Ke1, Nb5, Nd5. Black: Ke8, Ra8. Either knight to c7 forks king and rook.
  const KING_AND_ROOK = 'r3k3/8/8/1N1N4/8/8/8/4K3 w - - 0 1';
  const twoForks: Puzzle = {
    theme: FORK_THEME,
    fen: KING_AND_ROOK,
    goal: 'Attack two pieces at once!',
    hint: { from: 'b5', to: 'c7' },
    meetsGoal: (m) => isWinningFork(KING_AND_ROOK, m),
  };

  it('a different winning fork from the stored hint is accepted, for full Points', async () => {
    const session = sessionFor(twoForks);
    await session.start();
    expect(solved(await session.move({ from: 'd5', to: 'c7' }))).toEqual({ type: 'puzzle-solved', points: 30 });
  });

  it('misses step through the Hint Steps, and the app plays the fork after the third', async () => {
    const puzzle = generateForkPuzzle(seededRandom(4));
    const misses = new Chess(puzzle.fen).moves({ verbose: true }).map(choice).filter((m) => !puzzle.meetsGoal(m));
    const session = sessionFor(puzzle);
    await session.start();
    expect(await session.move(misses[0])).toContainEqual({ type: 'hint-step', step: 1, piece: puzzle.hint.from });
    expect(await session.move(misses[0])).toContainEqual({ type: 'hint-step', step: 2, move: puzzle.hint });
    const third = await session.move(misses[0]);
    expect(third).toContainEqual({ type: 'hint-step', step: 3, move: puzzle.hint });
    expect(solved(third)).toEqual({ type: 'puzzle-solved', points: 0 });
  });

  it('after the arrow, playing the fork earns 10 Points', async () => {
    const puzzle = generateForkPuzzle(seededRandom(9));
    const miss = new Chess(puzzle.fen).moves({ verbose: true }).map(choice).find((m) => !puzzle.meetsGoal(m))!;
    const session = sessionFor(puzzle);
    await session.start();
    await session.move(miss);
    await session.move(miss);
    expect(solved(await session.move(puzzle.hint))).toEqual({ type: 'puzzle-solved', points: 10 });
  });
});
