import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { seededRandom } from '../random';
import { generateNewPiecePuzzle, makesANewPiece } from './new-piece';

// White: Kg1, Pb7. Black: Ke8, Nc8 (b8 is empty, so the pawn can go straight on or take the knight).
const TWO_WAYS = '2n1k3/1P6/8/8/8/8/8/6K1 w - - 0 1';

describe('"Make a new piece!" goal', () => {
  it('promoting to any piece meets the goal', () => {
    for (const promotion of ['q', 'r', 'b', 'n'] as const) {
      expect(makesANewPiece(TWO_WAYS, { from: 'b7', to: 'b8', promotion }), promotion).toBe(true);
    }
  });

  it('promoting by taking a piece counts too', () => {
    expect(makesANewPiece(TWO_WAYS, { from: 'b7', to: 'c8', promotion: 'n' })).toBe(true);
  });

  it('a move that does not promote does not', () => {
    expect(makesANewPiece(TWO_WAYS, { from: 'g1', to: 'g2' })).toBe(false);
  });

  it('an illegal move, or a promotion with no piece chosen, does not', () => {
    expect(makesANewPiece(TWO_WAYS, { from: 'b7', to: 'b6', promotion: 'q' })).toBe(false);
    expect(makesANewPiece(TWO_WAYS, { from: 'b7', to: 'a8', promotion: 'q' })).toBe(false);
    expect(makesANewPiece(TWO_WAYS, { from: 'b7', to: 'b8' })).toBe(false);
  });

  it('works for black to move as well', () => {
    expect(makesANewPiece('4k3/8/8/8/8/8/3p4/6K1 b - - 0 1', { from: 'd2', to: 'd1', promotion: 'r' })).toBe(true);
  });
});

describe('"Make a new piece!" generator', () => {
  const SEEDS = Array.from({ length: 150 }, (_, i) => i + 1);
  const puzzles = SEEDS.map((seed) => generateNewPiecePuzzle(seededRandom(seed)));

  it('makes a puzzle that says its goal', () => {
    expect(puzzles[0].goal).toBe('Make a new piece!');
    expect(puzzles[0].theme).toBe('make-a-new-piece');
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

  it('every puzzle has at least one move meeting its goal, and the stored hint move meets it', () => {
    for (const puzzle of puzzles) {
      const moves = new Chess(puzzle.fen).moves({ verbose: true });
      const meeting = moves.filter((m) => puzzle.meetsGoal({ from: m.from, to: m.to, promotion: m.promotion as never }));
      expect(meeting.length, puzzle.fen).toBeGreaterThan(0);
      expect(puzzle.meetsGoal(puzzle.hint), puzzle.fen).toBe(true);
    }
  });

  it('every piece in the Promotion Picker counts', () => {
    for (const puzzle of puzzles) {
      for (const promotion of ['q', 'r', 'b', 'n'] as const) {
        expect(puzzle.meetsGoal({ ...puzzle.hint, promotion }), puzzle.fen).toBe(true);
      }
    }
  });

  it('every puzzle is on a near-empty board', () => {
    for (const { fen } of puzzles) {
      const pieces = fen.split(' ')[0].replace(/[^a-zA-Z]/g, '');
      expect(pieces.length, fen).toBeLessThanOrEqual(5);
    }
  });

  it('sometimes the way straight on is blocked, so the pawn must take to promote', () => {
    const mustTake = puzzles.filter((p) => !new Chess(p.fen).moves({ verbose: true }).some((m) => m.promotion && !m.captured));
    expect(mustTake.length).toBeGreaterThan(0);
  });

  it('the same seed makes the same puzzle, and different seeds vary', () => {
    expect(generateNewPiecePuzzle(seededRandom(7)).fen).toBe(generateNewPiecePuzzle(seededRandom(7)).fen);
    expect(new Set(puzzles.slice(0, 20).map((p) => p.fen)).size).toBeGreaterThan(15);
  });
});
