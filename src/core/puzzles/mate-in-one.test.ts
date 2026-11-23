import { Chess, type Square } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { seededRandom } from '../random';
import { deliversCheckmate, generateMateInOnePuzzle } from './mate-in-one';

// White: Kg6, Qa7. Black: Kh8. Four different mates: Qa8, Qb8, Qg7 and Qh7.
const FOUR_MATES = '7k/Q7/6K1/8/8/8/8/8 w - - 0 1';

describe('"Checkmate in one!" goal', () => {
  it('every checkmating move meets the goal, not just one stored answer', () => {
    for (const to of ['a8', 'b8', 'g7', 'h7']) {
      expect(deliversCheckmate(FOUR_MATES, { from: 'a7', to }), to).toBe(true);
    }
  });

  it('a check that is not mate does not', () => {
    expect(new Chess(FOUR_MATES).move({ from: 'a7', to: 'd4' }).san).toBe('Qd4+');
    expect(deliversCheckmate(FOUR_MATES, { from: 'a7', to: 'd4' })).toBe(false);
  });

  it('a move that gives no check does not', () => {
    expect(deliversCheckmate(FOUR_MATES, { from: 'a7', to: 'a6' })).toBe(false);
  });

  it('an illegal move does not', () => {
    expect(deliversCheckmate(FOUR_MATES, { from: 'a7', to: 'h1' })).toBe(false);
    expect(deliversCheckmate(FOUR_MATES, { from: 'g6', to: 'g7' })).toBe(false);
  });

  it('a back-rank mate with a rook counts', () => {
    const backRank = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1';
    expect(deliversCheckmate(backRank, { from: 'a1', to: 'a8' })).toBe(true);
  });

  it('works for black to move as well', () => {
    const blackToMove = 'r5k1/8/8/8/8/8/5PPP/6K1 b - - 0 1';
    expect(deliversCheckmate(blackToMove, { from: 'a8', to: 'a1' })).toBe(true);
  });
});

describe('"Checkmate in one!" generator', () => {
  const SEEDS = Array.from({ length: 150 }, (_, i) => i + 1);
  const puzzles = SEEDS.map((seed) => generateMateInOnePuzzle(seededRandom(seed)));

  it('makes a puzzle that says its goal', () => {
    expect(puzzles[0].goal).toBe('Checkmate in one!');
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

  it('every puzzle has at least one mating move, and the stored hint move mates', () => {
    for (const puzzle of puzzles) {
      const mates = new Chess(puzzle.fen).moves({ verbose: true }).filter((m) => {
        const after = new Chess(puzzle.fen);
        after.move(m);
        return after.isCheckmate();
      });
      expect(mates.length, puzzle.fen).toBeGreaterThan(0);
      expect(puzzle.meetsGoal(puzzle.hint), puzzle.fen).toBe(true);
      expect(mates.some((m) => m.from === puzzle.hint.from && m.to === puzzle.hint.to), puzzle.fen).toBe(true);
    }
  });

  it('the mate is made by a queen or a rook, and both kinds of puzzle turn up', () => {
    const movers = puzzles.map((p) => new Chess(p.fen).get(p.hint.from as Square)?.type);
    for (const mover of movers) expect(['q', 'r']).toContain(mover);
    expect(movers).toContain('q');
    expect(movers).toContain('r');
  });

  it('every puzzle is on a near-empty board', () => {
    for (const { fen } of puzzles) {
      const pieces = fen.split(' ')[0].replace(/[^a-zA-Z]/g, '');
      expect(pieces.length, fen).toBeLessThanOrEqual(5);
    }
  });

  it('the same seed makes the same puzzle, and different seeds vary', () => {
    expect(generateMateInOnePuzzle(seededRandom(7)).fen).toBe(generateMateInOnePuzzle(seededRandom(7)).fen);
    expect(new Set(puzzles.slice(0, 20).map((p) => p.fen)).size).toBeGreaterThan(15);
  });
});
