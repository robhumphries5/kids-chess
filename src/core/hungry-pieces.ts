// Hungry Pieces: one piece eats all the apples on the board in as few moves as possible. No enemies.
import { pickOne, type Random } from './random';

/** The pieces a child can choose to be hungry. */
export type HungryPiece = 'knight' | 'rook' | 'bishop' | 'queen' | 'king';

/** In the order the piece picker shows them. */
export const HUNGRY_PIECES: readonly HungryPiece[] = ['knight', 'rook', 'bishop', 'queen', 'king'];

/** A square such as "e4". */
export type Square = string;

const FILES = 'abcdefgh';

const toXY = (square: Square): [number, number] => [FILES.indexOf(square[0]), Number(square[1]) - 1];
const onBoard = (x: number, y: number) => x >= 0 && x < 8 && y >= 0 && y < 8;
const toSquare = (x: number, y: number): Square => `${FILES[x]}${y + 1}`;

const STRAIGHT: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAGONAL: readonly [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const KNIGHT: readonly [number, number][] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

const STEPS: Record<HungryPiece, { directions: readonly [number, number][]; slides: boolean }> = {
  knight: { directions: KNIGHT, slides: false },
  king: { directions: [...STRAIGHT, ...DIAGONAL], slides: false },
  rook: { directions: STRAIGHT, slides: true },
  bishop: { directions: DIAGONAL, slides: true },
  queen: { directions: [...STRAIGHT, ...DIAGONAL], slides: true },
};

/**
 * Where the piece on `from` can move, by its normal chess rules. Apples are like pieces to capture:
 * a sliding piece can land on one (and eat it) but can't slide past it. Knights jump as usual.
 */
export function pieceMoves(piece: HungryPiece, from: Square, apples: ReadonlySet<Square> = new Set()): Square[] {
  const [x, y] = toXY(from);
  const { directions, slides } = STEPS[piece];
  const moves: Square[] = [];
  for (const [dx, dy] of directions) {
    let [nx, ny] = [x + dx, y + dy];
    while (onBoard(nx, ny)) {
      const square = toSquare(nx, ny);
      moves.push(square);
      if (!slides || apples.has(square)) break;
      nx += dx;
      ny += dy;
    }
  }
  return moves;
}

/** One Hungry Pieces level: where the hungry piece starts and where the apples are. */
export interface HungryLevel {
  piece: HungryPiece;
  start: Square;
  apples: readonly Square[];
}

/**
 * The fewest moves that eat every apple, or undefined if they can't all be eaten (a bishop can only
 * reach its own colour). A breadth-first search where a state is the piece's square plus which
 * apples are already eaten, since eaten apples no longer block a sliding piece.
 */
export function fewestMoves(level: HungryLevel): number | undefined {
  const apples = [...new Set(level.apples)].filter((a) => a !== level.start);
  const all = (1 << apples.length) - 1;
  const index = new Map(apples.map((a, i) => [a, i]));
  const key = (square: Square, eaten: number) => `${square}:${eaten}`;

  let frontier: [Square, number][] = [[level.start, 0]];
  const seen = new Set([key(level.start, 0)]);
  for (let moves = 0; frontier.length > 0; moves++) {
    const next: [Square, number][] = [];
    for (const [square, eaten] of frontier) {
      if (eaten === all) return moves;
      const left = new Set(apples.filter((_, i) => !(eaten & (1 << i))));
      for (const to of pieceMoves(level.piece, square, left)) {
        const i = index.get(to);
        const after = i !== undefined && left.has(to) ? eaten | (1 << i) : eaten;
        const k = key(to, after);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push([to, after]);
      }
    }
    frontier = next;
  }
  return undefined;
}

/**
 * Points for eating every apple in `used` moves when `fewest` was possible: 30 for the fewest,
 * 20 for one or two extra, 10 for any more. Fewer moves never earns less, and finishing always earns something.
 */
export function pointsForMoves(used: number, fewest: number): number {
  const extra = used - fewest;
  if (extra <= 0) return 30;
  if (extra <= 2) return 20;
  return 10;
}

const MAX_APPLES = 6;

/** Apples on level `n` (from 1): 1, 2, 2, 3, 3, 4, … up to 6. */
export function applesForLevel(n: number): number {
  return Math.min(MAX_APPLES, 1 + Math.floor(Math.max(1, n) / 2));
}

const ALL_SQUARES: Square[] = [...FILES].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`));

/** Far more tries than ever needed: almost every trail drawn works first time. */
const MAX_TRIES = 1000;

/**
 * Level `n` for the chosen piece. The apples are laid as a trail, each one or two moves on from the
 * last, so the piece can always reach them all (a bishop's trail stays on its own colour) and the
 * walk is never long. The search then checks the whole level can be finished.
 */
export function generateLevel(n: number, piece: HungryPiece, random: Random): HungryLevel {
  const count = applesForLevel(n);
  for (let i = 0; i < MAX_TRIES; i++) {
    const start = pickOne(ALL_SQUARES, random);
    const apples: Square[] = [];
    let at = start;
    while (apples.length < count) {
      const near = new Set(pieceMoves(piece, at).flatMap((s) => [s, ...pieceMoves(piece, s)]));
      const options = [...near].filter((s) => s !== start && !apples.includes(s));
      if (options.length === 0) break;
      at = pickOne(options, random);
      apples.push(at);
    }
    if (apples.length < count) continue;
    const level = { piece, start, apples };
    const fewest = fewestMoves(level);
    if (fewest !== undefined && fewest <= 2 * count) return level;
  }
  throw new Error(`Could not make a Hungry Pieces level for the ${piece}`);
}
