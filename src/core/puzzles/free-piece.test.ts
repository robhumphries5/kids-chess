import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { seededRandom } from '../random';
import { generateFreePiecePuzzle, takesAFreePiece } from './free-piece';

// White: Ke1, Ra4, Bf1. Black: Ke8, Nd4 (free: nothing defends it), Pa7 (defended by nothing but far).
const TWO_WAYS = '4k3/p7/8/8/R2n4/8/8/4KB2 w - - 0 1';

describe('"Take the free piece!" goal', () => {
  it('a capture of an undefended piece meets the goal', () => {
    expect(takesAFreePiece(TWO_WAYS, { from: 'a4', to: 'd4' })).toBe(true);
  });

  it('a different winning capture meets it too', () => {
    expect(takesAFreePiece(TWO_WAYS, { from: 'a4', to: 'a7' })).toBe(true);
  });

  it('a move that takes nothing does not', () => {
    expect(takesAFreePiece(TWO_WAYS, { from: 'a4', to: 'b4' })).toBe(false);
  });

  it('an illegal move does not', () => {
    expect(takesAFreePiece(TWO_WAYS, { from: 'a4', to: 'e8' })).toBe(false);
    expect(takesAFreePiece(TWO_WAYS, { from: 'f1', to: 'f8' })).toBe(false);
  });

  it('a capture that leaves the capturing piece to be taken back does not', () => {
    // Black's king on e5 guards d4.
    const defended = '8/8/8/4k3/R2n4/8/8/4K3 w - - 0 1';
    expect(takesAFreePiece(defended, { from: 'a4', to: 'd4' })).toBe(false);
  });

  it('works for black to move as well', () => {
    const blackToMove = '4k3/8/8/8/r2N4/8/8/4K3 b - - 0 1';
    expect(takesAFreePiece(blackToMove, { from: 'a4', to: 'd4' })).toBe(true);
  });
});

describe('"Take the free piece!" generator', () => {
  const SEEDS = Array.from({ length: 150 }, (_, i) => i + 1);

  it('makes a puzzle that says its goal', () => {
    const puzzle = generateFreePiecePuzzle(seededRandom(1));
    expect(puzzle.goal).toBe('Take the free piece!');
  });

  it('every puzzle is a legal position with the side to move not in check', () => {
    for (const seed of SEEDS) {
      const { fen } = generateFreePiecePuzzle(seededRandom(seed));
      const chess = new Chess(fen);
      expect(chess.inCheck(), fen).toBe(false);
      expect(chess.isGameOver(), fen).toBe(false);
    }
  });

  it('every puzzle has at least one move meeting its goal, and the stored hint move meets it', () => {
    for (const seed of SEEDS) {
      const puzzle = generateFreePiecePuzzle(seededRandom(seed));
      const moves = new Chess(puzzle.fen).moves({ verbose: true });
      const meeting = moves.filter((m) => puzzle.meetsGoal({ from: m.from, to: m.to, promotion: m.promotion as never }));
      expect(meeting.length, puzzle.fen).toBeGreaterThan(0);
      expect(puzzle.meetsGoal(puzzle.hint), puzzle.fen).toBe(true);
    }
  });

  it('every puzzle is on a near-empty board', () => {
    for (const seed of SEEDS) {
      const { fen } = generateFreePiecePuzzle(seededRandom(seed));
      const pieces = fen.split(' ')[0].replace(/[^a-zA-Z]/g, '');
      expect(pieces.length, fen).toBeLessThanOrEqual(5);
    }
  });

  it('the same seed makes the same puzzle, and different seeds vary', () => {
    expect(generateFreePiecePuzzle(seededRandom(7)).fen).toBe(generateFreePiecePuzzle(seededRandom(7)).fen);
    const fens = new Set(SEEDS.slice(0, 20).map((s) => generateFreePiecePuzzle(seededRandom(s)).fen));
    expect(fens.size).toBeGreaterThan(15);
  });
});
