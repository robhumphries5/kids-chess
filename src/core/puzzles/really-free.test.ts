import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { captureGain } from '../tactics';
import { seededRandom } from '../random';
import { generateReallyFreePuzzle, winsMaterial } from './really-free';

// White: Ke1, Ra4, Nf3. Black: Ke8, Nd4 (defended by the pawn on e5), Pe5 (loose), Bh5.
// Rxd4 loses the rook for a knight; Nxe5 wins the pawn.
const SOME_DEFENDED = '4k3/8/8/4p2b/R2n4/5N2/8/4K3 w - - 0 1';

describe('"Is it really free?" goal', () => {
  it('taking a loose piece meets the goal', () => {
    expect(winsMaterial('4k3/8/8/7b/R2n4/8/8/4K3 w - - 0 1', { from: 'a4', to: 'd4' })).toBe(true);
  });

  it('taking a defended piece that loses the capturer does not', () => {
    // Rxd4, then exd4: a rook for a knight.
    expect(winsMaterial(SOME_DEFENDED, { from: 'a4', to: 'd4' })).toBe(false);
  });

  it('an even swap wins nothing, so does not count', () => {
    // Nxd4, then exd4: a knight for a knight.
    expect(winsMaterial('4k3/8/8/4p3/3n4/5N2/8/4K3 w - - 0 1', { from: 'f3', to: 'd4' })).toBe(false);
    // With the rook behind to take back again, the same capture wins a pawn.
    expect(winsMaterial(SOME_DEFENDED, { from: 'f3', to: 'd4' })).toBe(true);
  });

  it('any capture that wins material counts, even of a defended piece', () => {
    // Nxe5 takes a pawn nothing guards.
    expect(captureGain(SOME_DEFENDED, { from: 'f3', to: 'e5' })).toBe(100);
    expect(winsMaterial(SOME_DEFENDED, { from: 'f3', to: 'e5' })).toBe(true);
    // A knight taking a defended rook wins the difference.
    expect(winsMaterial('4k3/8/2p5/3r4/8/4N3/8/4K3 w - - 0 1', { from: 'e3', to: 'd5' })).toBe(true);
  });

  it('a move that takes nothing, or an illegal move, does not', () => {
    expect(winsMaterial(SOME_DEFENDED, { from: 'a4', to: 'a5' })).toBe(false);
    expect(winsMaterial(SOME_DEFENDED, { from: 'a4', to: 'h4' })).toBe(false);
  });
});

describe('"Is it really free?" generator', () => {
  const SEEDS = Array.from({ length: 150 }, (_, i) => i + 1);
  const puzzles = SEEDS.map((seed) => generateReallyFreePuzzle(seededRandom(seed)));

  it('makes a puzzle of its own theme that says its goal', () => {
    expect(puzzles[0].theme).toBe('is-it-really-free');
    expect(puzzles[0].goal).toBe('Is it really free? Find a good piece to take!');
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
      const someMeet = moves.some((m) => puzzle.meetsGoal({ from: m.from, to: m.to, promotion: m.promotion as never }));
      expect(someMeet, puzzle.fen).toBe(true);
      expect(puzzle.meetsGoal(puzzle.hint), puzzle.fen).toBe(true);
    }
  });

  it('every puzzle also has a trap: a capture that loses the capturing piece for less', () => {
    for (const puzzle of puzzles) {
      const captures = new Chess(puzzle.fen).moves({ verbose: true }).filter((m) => m.captured);
      const traps = captures.filter((m) => (captureGain(puzzle.fen, m) ?? 0) < 0);
      expect(traps.length, puzzle.fen).toBeGreaterThan(0);
      for (const trap of traps) expect(puzzle.meetsGoal({ from: trap.from, to: trap.to }), puzzle.fen).toBe(false);
    }
  });

  it('every puzzle is on a near-empty board', () => {
    for (const { fen } of puzzles) {
      const pieces = fen.split(' ')[0].replace(/[^a-zA-Z]/g, '');
      expect(pieces.length, fen).toBeLessThanOrEqual(7);
    }
  });

  it('the same seed makes the same puzzle, and different seeds vary', () => {
    expect(generateReallyFreePuzzle(seededRandom(7)).fen).toBe(generateReallyFreePuzzle(seededRandom(7)).fen);
    expect(new Set(puzzles.slice(0, 20).map((p) => p.fen)).size).toBeGreaterThan(15);
  });
});
