import { describe, expect, it } from 'vitest';
import { createSession } from './session';
import type { Opponent } from '../opponents/opponent';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** An Opponent that plays a fixed list of moves in order. */
function scripted(...moves: string[]): Opponent {
  let i = 0;
  return {
    id: 'scripted',
    name: 'Scripted',
    async pickMove() {
      const m = moves[i++];
      return { from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] as 'q' | undefined };
    },
  };
}

describe('Opponent game Session', () => {
  it('start shows the starting board with the child to move', async () => {
    const session = createSession({ kind: 'opponent-game', opponent: scripted(), childColour: 'white' });
    const events = await session.start();
    expect(events).toEqual([
      expect.objectContaining({ type: 'board-changed', fen: START, childToMove: true }),
    ]);
    const board = events[0];
    if (board.type !== 'board-changed') throw new Error('expected board-changed');
    expect(board.dests['e2']).toEqual(['e3', 'e4']);
    expect(board.dests['g1']).toEqual(['f3', 'h3']);
    expect(Object.keys(board.dests)).toHaveLength(10);
  });

  it('when the child plays black, the Opponent moves first', async () => {
    const session = createSession({ kind: 'opponent-game', opponent: scripted('d2d4'), childColour: 'black' });
    const events = await session.start();
    expect(events.map((e) => e.type)).toEqual(['board-changed', 'opponent-moved', 'board-changed']);
    expect(events[0]).toMatchObject({ fen: START, childToMove: false });
    expect(events[2]).toMatchObject({ childToMove: true, lastMove: ['d2', 'd4'] });
    if (events[2].type !== 'board-changed') throw new Error();
    expect(events[2].dests['e7']).toEqual(['e6', 'e5']);
  });

  it('a child move is played, then the Opponent replies', async () => {
    const session = createSession({ kind: 'opponent-game', opponent: scripted('e7e5'), childColour: 'white' });
    await session.start();
    const events = await session.move({ from: 'e2', to: 'e4' });
    expect(events.map((e) => e.type)).toEqual(['board-changed', 'opponent-moved', 'board-changed']);
    expect(events[0]).toMatchObject({
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      turn: 'black',
      check: false,
      childToMove: false,
      dests: {},
    });
    expect(events[1]).toMatchObject({ type: 'opponent-moved', from: 'e7', to: 'e5', san: 'e5' });
    expect(events[2]).toMatchObject({
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
      childToMove: true,
      lastMove: ['e7', 'e5'],
    });
  });

  it('an illegal move is rejected and the board stays as it was', async () => {
    const session = createSession({ kind: 'opponent-game', opponent: scripted('e7e5'), childColour: 'white' });
    await session.start();
    expect(await session.move({ from: 'e2', to: 'e5' })).toEqual([
      expect.objectContaining({ type: 'move-rejected', from: 'e2', to: 'e5' }),
      expect.objectContaining({ type: 'board-changed', fen: START, childToMove: true }),
    ]);
    // The game carries on normally afterwards.
    const events = await session.move({ from: 'e2', to: 'e4' });
    expect(events[1]).toMatchObject({ type: 'opponent-moved', san: 'e5' });
  });

  describe('game over', () => {
    it('the child checkmating wins, and the Opponent is not asked to move', async () => {
      const session = createSession({
        kind: 'opponent-game',
        opponent: scripted(), // would throw if asked for a move
        childColour: 'white',
        fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
      });
      await session.start();
      const events = await session.move({ from: 'a1', to: 'a8' });
      expect(events).toEqual([
        expect.objectContaining({ type: 'board-changed', childToMove: false, dests: {}, check: true }),
        { type: 'game-over', result: 'won', reason: 'checkmate' },
      ]);
    });

    it('the Opponent checkmating means the child lost', async () => {
      const session = createSession({
        kind: 'opponent-game',
        opponent: scripted('a7a1'),
        childColour: 'white',
        fen: '6k1/r7/8/8/8/8/1P3PPP/6K1 w - - 0 1',
      });
      await session.start();
      const events = await session.move({ from: 'b2', to: 'b3' });
      expect(events.map((e) => e.type)).toEqual(['board-changed', 'opponent-moved', 'board-changed', 'game-over']);
      expect(events[3]).toEqual({ type: 'game-over', result: 'lost', reason: 'checkmate' });
    });

    it('stalemate is a draw', async () => {
      const session = createSession({
        kind: 'opponent-game',
        opponent: scripted(),
        childColour: 'white',
        fen: 'k7/8/1K6/8/8/8/8/2Q5 w - - 0 1',
      });
      await session.start();
      const events = await session.move({ from: 'c1', to: 'c7' });
      expect(events.at(-1)).toEqual({ type: 'game-over', result: 'drawn', reason: 'stalemate' });
    });

    it('bare kings is a draw', async () => {
      const session = createSession({
        kind: 'opponent-game',
        opponent: scripted(),
        childColour: 'white',
        fen: 'k7/8/8/8/8/8/1r6/K7 w - - 0 1',
      });
      await session.start();
      const events = await session.move({ from: 'a1', to: 'b2' });
      expect(events.at(-1)).toEqual({ type: 'game-over', result: 'drawn', reason: 'insufficient-material' });
    });

    it('threefold repetition is a draw', async () => {
      const session = createSession({
        kind: 'opponent-game',
        opponent: scripted('b8c6', 'c6b8', 'b8c6', 'c6b8'),
        childColour: 'white',
      });
      await session.start();
      await session.move({ from: 'g1', to: 'f3' });
      await session.move({ from: 'f3', to: 'g1' });
      await session.move({ from: 'g1', to: 'f3' });
      const events = await session.move({ from: 'f3', to: 'g1' });
      expect(events.at(-1)).toEqual({ type: 'game-over', result: 'drawn', reason: 'threefold-repetition' });
    });

    it('no moves are accepted after the game is over', async () => {
      const session = createSession({
        kind: 'opponent-game',
        opponent: scripted(),
        childColour: 'white',
        fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
      });
      await session.start();
      await session.move({ from: 'a1', to: 'a8' });
      const events = await session.move({ from: 'g1', to: 'h1' });
      expect(events[0]).toEqual({ type: 'move-rejected', from: 'g1', to: 'h1' });
    });
  });

  describe('promotion', () => {
    // White pawn on b7 about to promote; kings far apart.
    const PROMO = '7k/1P6/8/8/8/8/8/K7 w - - 0 1';

    it('a promotion with no piece chosen asks for one and plays nothing', async () => {
      const session = createSession({ kind: 'opponent-game', opponent: scripted('h8g8'), childColour: 'white', fen: PROMO });
      await session.start();
      expect(await session.move({ from: 'b7', to: 'b8' })).toEqual([
        { type: 'promotion-needed', from: 'b7', to: 'b8' },
      ]);
    });

    it.each(['q', 'r', 'b', 'n'] as const)('promoting to %s is accepted', async (piece) => {
      const session = createSession({ kind: 'opponent-game', opponent: scripted('h8h7'), childColour: 'white', fen: PROMO });
      await session.start();
      const events = await session.move({ from: 'b7', to: 'b8', promotion: piece });
      expect(events[0]).toMatchObject({ type: 'board-changed' });
      if (events[0].type !== 'board-changed') throw new Error();
      expect(events[0].fen.startsWith(`1${piece.toUpperCase()}5k/`)).toBe(true);
    });
  });
});
