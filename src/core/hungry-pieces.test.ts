import { describe, expect, it } from 'vitest';
import { seededRandom } from './random';
import { applesForLevel, fewestMoves, generateLevel, HUNGRY_PIECES, pieceMoves, pointsForMoves } from './hungry-pieces';

const sorted = (squares: string[]) => [...squares].sort();

describe('Hungry Pieces: how the hungry piece moves', () => {
  it('a knight jumps in an L, even from a corner', () => {
    expect(sorted(pieceMoves('knight', 'd4'))).toEqual(sorted(['b3', 'b5', 'c2', 'c6', 'e2', 'e6', 'f3', 'f5']));
    expect(sorted(pieceMoves('knight', 'a1'))).toEqual(['b3', 'c2']);
  });

  it('a king steps one square any way', () => {
    expect(sorted(pieceMoves('king', 'a1'))).toEqual(['a2', 'b1', 'b2']);
    expect(pieceMoves('king', 'e4')).toHaveLength(8);
  });

  it('a rook slides along its rank and file', () => {
    expect(pieceMoves('rook', 'a1')).toHaveLength(14);
    expect(pieceMoves('rook', 'a1')).toContain('a8');
    expect(pieceMoves('rook', 'a1')).toContain('h1');
  });

  it('a bishop slides diagonally', () => {
    expect(sorted(pieceMoves('bishop', 'a1'))).toEqual(['b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8']);
  });

  it('a queen moves like a rook and a bishop together', () => {
    expect(pieceMoves('queen', 'd4')).toHaveLength(27);
  });

  it('an apple stops a sliding piece: it can land on it, but not slide past it', () => {
    const moves = pieceMoves('rook', 'a1', new Set(['a3']));
    expect(moves).toContain('a2');
    expect(moves).toContain('a3');
    expect(moves).not.toContain('a4');
    expect(pieceMoves('bishop', 'a1', new Set(['c3']))).toEqual(['b2', 'c3']);
  });

  it('a knight jumps over apples', () => {
    expect(sorted(pieceMoves('knight', 'a1', new Set(['a2', 'b2', 'b1'])))).toEqual(['b3', 'c2']);
  });
});

describe('Hungry Pieces: the fewest moves to eat every apple', () => {
  it('is 0 with nothing to eat', () => {
    expect(fewestMoves({ piece: 'rook', start: 'a1', apples: [] })).toBe(0);
  });

  it('a knight: corner to corner takes 6, and the next-door diagonal square takes 4', () => {
    expect(fewestMoves({ piece: 'knight', start: 'a1', apples: ['b3'] })).toBe(1);
    expect(fewestMoves({ piece: 'knight', start: 'a1', apples: ['h8'] })).toBe(6);
    expect(fewestMoves({ piece: 'knight', start: 'a1', apples: ['b2'] })).toBe(4);
  });

  it('a rook reaches any square in 2, and an apple in the way is eaten first', () => {
    expect(fewestMoves({ piece: 'rook', start: 'a1', apples: ['h8'] })).toBe(2);
    expect(fewestMoves({ piece: 'rook', start: 'a1', apples: ['a3', 'a5'] })).toBe(2);
  });

  it('a bishop: two apples on far corners of its colour take 3', () => {
    expect(fewestMoves({ piece: 'bishop', start: 'c1', apples: ['a3', 'h6'] })).toBe(3);
  });

  it('a bishop can never eat an apple on the other colour', () => {
    expect(fewestMoves({ piece: 'bishop', start: 'c1', apples: ['c2'] })).toBeUndefined();
  });

  it('a king picks the best order: the near apple first', () => {
    expect(fewestMoves({ piece: 'king', start: 'a1', apples: ['h8'] })).toBe(7);
    expect(fewestMoves({ piece: 'king', start: 'd1', apples: ['d8', 'd2'] })).toBe(7);
  });

  it('a queen eats two corners in 2', () => {
    expect(fewestMoves({ piece: 'queen', start: 'a1', apples: ['h8', 'a8'] })).toBe(2);
  });
});

describe('Hungry Pieces: Points by moves used', () => {
  it('the fewest possible moves earns 30', () => {
    expect(pointsForMoves(3, 3)).toBe(30);
  });

  it('one or two extra moves earns 20', () => {
    expect(pointsForMoves(4, 3)).toBe(20);
    expect(pointsForMoves(5, 3)).toBe(20);
  });

  it('any more still earns 10 for eating them all: finishing is never worth nothing', () => {
    expect(pointsForMoves(6, 3)).toBe(10);
    expect(pointsForMoves(60, 3)).toBe(10);
  });

  it('fewer moves always gives at least as many Points', () => {
    for (const fewest of [1, 2, 5]) {
      for (let used = fewest; used < fewest + 20; used++) {
        expect(pointsForMoves(used, fewest)).toBeGreaterThanOrEqual(pointsForMoves(used + 1, fewest));
      }
    }
  });
});

describe('Hungry Pieces: levels', () => {
  it('start tiny and grow: 1 apple, then 2, then more, up to 6', () => {
    expect(applesForLevel(1)).toBe(1);
    expect(applesForLevel(2)).toBe(2);
    const counts = Array.from({ length: 30 }, (_, i) => applesForLevel(i + 1));
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    expect(Math.max(...counts)).toBe(6);
  });

  it('every level can be finished by the chosen piece, without too long a walk', () => {
    const random = seededRandom(22);
    for (const piece of HUNGRY_PIECES) {
      for (let n = 1; n <= 15; n++) {
        const level = generateLevel(n, piece, random);
        expect(level.piece).toBe(piece);
        expect(level.apples).toHaveLength(applesForLevel(n));
        expect(new Set(level.apples).size).toBe(level.apples.length);
        expect(level.apples).not.toContain(level.start);
        const fewest = fewestMoves(level);
        expect(fewest).toBeDefined();
        expect(fewest!).toBeLessThanOrEqual(2 * level.apples.length);
      }
    }
  });

  it('a bishop\'s apples are all on its own colour', () => {
    const random = seededRandom(7);
    const shade = (sq: string) => ('abcdefgh'.indexOf(sq[0]) + Number(sq[1])) % 2;
    for (let n = 1; n <= 15; n++) {
      const level = generateLevel(n, 'bishop', random);
      for (const apple of level.apples) expect(shade(apple)).toBe(shade(level.start));
    }
  });
});
