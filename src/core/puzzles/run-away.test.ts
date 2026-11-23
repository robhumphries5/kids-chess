import { Chess, type Square } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { seededRandom } from '../random';
import { winningCaptures } from '../tactics';
import { generateRunAwayPuzzle, leavesItSafe } from './run-away';

// White: Kg1, Nd4, Ra1. Black: Ke8, Rd8 attacks the knight on d4, which nothing defends.
const HANGING_KNIGHT = '3rk3/8/8/8/3N4/8/8/R5K1 w - - 0 1';

describe('"Run away!" goal', () => {
  it('moving the attacked piece to a safe square meets the goal', () => {
    expect(leavesItSafe(HANGING_KNIGHT, 'd4', { from: 'd4', to: 'b5' })).toBe(true);
  });

  it('moving it to another square where it can be taken for free does not', () => {
    // The rook on d8 still sees d5.
    expect(leavesItSafe('3rk3/8/8/8/8/2N5/8/R5K1 w - - 0 1', 'c3', { from: 'c3', to: 'd5' })).toBe(false);
  });

  it('defending it meets the goal', () => {
    expect(leavesItSafe(HANGING_KNIGHT, 'd4', { from: 'a1', to: 'd1' })).toBe(true);
  });

  it('blocking the attack meets the goal', () => {
    // White: Kg1, Nd4, Rh6. The rook steps between: Rd6 is defended by nothing, but the knight is safe.
    const block = '3rk3/8/7R/8/3N4/8/8/6K1 w - - 0 1';
    expect(leavesItSafe(block, 'd4', { from: 'h6', to: 'd6' })).toBe(true);
  });

  it('a move that leaves it to be taken for free does not', () => {
    expect(leavesItSafe(HANGING_KNIGHT, 'd4', { from: 'g1', to: 'h1' })).toBe(false);
    expect(leavesItSafe(HANGING_KNIGHT, 'd4', { from: 'a1', to: 'a2' })).toBe(false);
  });

  it('defending it is not enough when the attacker is worth less', () => {
    // A black pawn on e5 attacks the queen on d4; a defender doesn't save it.
    const pawnAttack = '4k3/8/8/4p3/3Q4/8/8/R5K1 w - - 0 1';
    expect(leavesItSafe(pawnAttack, 'd4', { from: 'a1', to: 'd1' })).toBe(false);
    expect(leavesItSafe(pawnAttack, 'd4', { from: 'd4', to: 'a4' })).toBe(true);
  });

  it('an illegal move does not', () => {
    expect(leavesItSafe(HANGING_KNIGHT, 'd4', { from: 'd4', to: 'd5' })).toBe(false);
  });
});

describe('"Run away!" generator', () => {
  const SEEDS = Array.from({ length: 150 }, (_, i) => i + 1);
  const puzzles = SEEDS.map((seed) => generateRunAwayPuzzle(seededRandom(seed)));

  it('makes a puzzle that says its goal', () => {
    expect(puzzles[0].goal).toBe('Run away!');
    expect(puzzles[0].theme).toBe('run-away');
  });

  it('every puzzle is a legal position, white to move, with neither side in check', () => {
    for (const { fen } of puzzles) {
      const chess = new Chess(fen);
      expect(chess.turn(), fen).toBe('w');
      expect(chess.inCheck(), fen).toBe(false);
      expect(chess.isGameOver(), fen).toBe(false);
      expect(new Chess(fen.replace(' w ', ' b ')).inCheck(), fen).toBe(false);
    }
  });

  it("one of the child's pieces is attacked, black could take it for free, and the hint runs it away", () => {
    for (const puzzle of puzzles) {
      const target = puzzle.hint.from as Square;
      const piece = new Chess(puzzle.fen).get(target);
      expect(piece?.color, puzzle.fen).toBe('w');
      expect(['q', 'r', 'b', 'n'], puzzle.fen).toContain(piece?.type);
      const takers = winningCaptures(puzzle.fen.replace(' w ', ' b ')).filter((m) => m.to === target);
      expect(takers.length, puzzle.fen).toBeGreaterThan(0);
    }
  });

  it('every puzzle has at least one move meeting its goal, and the stored hint move meets it', () => {
    for (const puzzle of puzzles) {
      const moves = new Chess(puzzle.fen).moves({ verbose: true });
      expect(moves.some((m) => puzzle.meetsGoal({ from: m.from, to: m.to })), puzzle.fen).toBe(true);
      expect(puzzle.meetsGoal(puzzle.hint), puzzle.fen).toBe(true);
    }
  });

  it('some moves leave it free, so not every move is an answer', () => {
    for (const puzzle of puzzles) {
      const moves = new Chess(puzzle.fen).moves({ verbose: true });
      expect(moves.some((m) => !puzzle.meetsGoal({ from: m.from, to: m.to })), puzzle.fen).toBe(true);
    }
  });

  it('the lesson is running away, not taking: no puzzle offers a free piece to take', () => {
    for (const { fen } of puzzles) {
      const chess = new Chess(fen);
      const winning = chess.moves({ verbose: true }).filter((m) => {
        if (!m.captured) return false;
        chess.move(m);
        const back = chess.moves({ verbose: true }).some((r) => r.to === m.to);
        chess.undo();
        return !back;
      });
      expect(winning, fen).toEqual([]);
    }
  });

  it('every puzzle is on a near-empty board', () => {
    for (const { fen } of puzzles) {
      const pieces = fen.split(' ')[0].replace(/[^a-zA-Z]/g, '');
      expect(pieces.length, fen).toBeLessThanOrEqual(5);
    }
  });

  it('the same seed makes the same puzzle, and different seeds vary', () => {
    expect(generateRunAwayPuzzle(seededRandom(7)).fen).toBe(generateRunAwayPuzzle(seededRandom(7)).fen);
    expect(new Set(puzzles.slice(0, 20).map((p) => p.fen)).size).toBeGreaterThan(15);
  });
});
