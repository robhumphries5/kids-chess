import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { seededRandom } from '../random';
import { captureGain, matesInOne } from '../tactics';
import { generateForkPuzzle } from './fork';

describe('Simple fork generator', () => {
  const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);
  const puzzles = SEEDS.map((seed) => generateForkPuzzle(seededRandom(seed)));

  it('makes a puzzle of its own theme that says its goal', () => {
    expect(puzzles[0].theme).toBe('simple-fork');
    expect(puzzles[0].goal).toBe('Attack two pieces at once!');
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

  it('the hint move attacks two or more pieces', () => {
    for (const { fen, hint } of puzzles) {
      expect(piecesAttackedBy(fen, hint), fen).toBeGreaterThanOrEqual(2);
    }
  });

  it('a move whose piece attacks fewer than two enemy pieces never meets the goal', () => {
    for (const puzzle of puzzles.slice(0, 30)) {
      for (const m of new Chess(puzzle.fen).moves({ verbose: true })) {
        if (piecesAttackedBy(puzzle.fen, m) >= 2) continue;
        const choice = { from: m.from, to: m.to, promotion: m.promotion as never };
        expect(puzzle.meetsGoal(choice), `${puzzle.fen} ${m.san}`).toBe(false);
      }
    }
  });

  it('a fork is the idea: nothing can be taken for a gain, and there is no checkmate, before the fork', () => {
    for (const { fen } of puzzles) {
      const captures = new Chess(fen).moves({ verbose: true }).filter((m) => m.captured);
      for (const c of captures) expect(captureGain(fen, c), fen).toBeLessThanOrEqual(0);
      expect(matesInOne(fen), fen).toEqual([]);
    }
  });

  it('knight forks are the most common, and other pieces fork too', () => {
    const forkers = puzzles.map((p) => new Chess(p.fen).get(p.hint.from as never)?.type);
    const knights = forkers.filter((f) => f === 'n').length;
    expect(knights).toBeGreaterThan(puzzles.length / 3);
    expect(new Set(forkers).size).toBeGreaterThan(1);
  });

  it('every puzzle is on a near-empty board', () => {
    for (const { fen } of puzzles) {
      const pieces = fen.split(' ')[0].replace(/[^a-zA-Z]/g, '');
      expect(pieces.length, fen).toBeLessThanOrEqual(6);
    }
  });

  it('the same seed makes the same puzzle, and different seeds vary', () => {
    expect(generateForkPuzzle(seededRandom(7)).fen).toBe(generateForkPuzzle(seededRandom(7)).fen);
    expect(new Set(puzzles.slice(0, 20).map((p) => p.fen)).size).toBeGreaterThan(15);
  });
});

/** How many black pieces the moved piece attacks once `move` is played. */
function piecesAttackedBy(fen: string, move: { from: string; to: string }): number {
  const chess = new Chess(fen);
  const played = chess.move(move);
  return chess
    .board()
    .flat()
    .filter((p) => p && p.color === 'b' && chess.attackers(p.square, 'w').includes(played.to)).length;
}