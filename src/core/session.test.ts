import { describe, expect, it } from 'vitest';
import { createSession, type SessionEvent } from './session';
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
    expect(events.map((e) => e.type)).toEqual(['board-changed', 'opponent-moved', 'board-changed', 'sound']);
    expect(events[0]).toMatchObject({ fen: START, childToMove: false });
    expect(events[2]).toMatchObject({ childToMove: true, lastMove: ['d2', 'd4'] });
    if (events[2].type !== 'board-changed') throw new Error();
    expect(events[2].dests['e7']).toEqual(['e6', 'e5']);
  });

  it('a child move is played, then the Opponent replies', async () => {
    const session = createSession({ kind: 'opponent-game', opponent: scripted('e7e5'), childColour: 'white' });
    await session.start();
    const events = await session.move({ from: 'e2', to: 'e4' });
    expect(events.map((e) => e.type)).toEqual(['board-changed', 'sound', 'opponent-moved', 'board-changed', 'sound']);
    expect(events[0]).toMatchObject({
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      turn: 'black',
      check: false,
      childToMove: false,
      dests: {},
    });
    expect(events[2]).toMatchObject({ type: 'opponent-moved', from: 'e7', to: 'e5', san: 'e5' });
    expect(events[3]).toMatchObject({
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
    expect(events).toContainEqual(expect.objectContaining({ type: 'opponent-moved', san: 'e5' }));
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
      expect(events[0]).toMatchObject({ type: 'board-changed', childToMove: false, dests: {}, check: true });
      expect(events.at(-1)).toEqual({ type: 'game-over', result: 'won', reason: 'checkmate' });
      expect(events.some((e) => e.type === 'opponent-moved')).toBe(false);
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
      expect(events.at(-1)).toEqual({ type: 'game-over', result: 'lost', reason: 'checkmate' });
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

  describe('speaking and sounds', () => {
    const said = (events: SessionEvent[]) => events.flatMap((e) => (e.type === 'say' ? [e.text] : []));
    const sounds = (events: SessionEvent[]) => events.flatMap((e) => (e.type === 'sound' ? [e.sound] : []));

    it('the child giving check says "Check!"', async () => {
      // Rook to e1 checks the black king on e8.
      const session = createSession({
        kind: 'opponent-game',
        opponent: scripted('e8d8'),
        childColour: 'white',
        fen: '4k3/8/8/8/8/8/8/R5K1 w - - 0 1',
      });
      await session.start();
      const events = await session.move({ from: 'a1', to: 'e1' });
      expect(said(events)).toEqual(['Check!']);
    });

    it('the child checkmating says "Checkmate!" and that they won, once', async () => {
      const session = createSession({
        kind: 'opponent-game',
        opponent: scripted(),
        childColour: 'white',
        fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
      });
      await session.start();
      expect(said(await session.move({ from: 'a1', to: 'a8' }))).toEqual(['Checkmate! You won! Well done!']);
    });

    it('the Opponent checkmating says "Checkmate!" and gently names the winner', async () => {
      const session = createSession({
        kind: 'opponent-game',
        opponent: scripted('a7a1'),
        childColour: 'white',
        fen: '6k1/r7/8/8/8/8/1P3PPP/6K1 w - - 0 1',
      });
      await session.start();
      expect(said(await session.move({ from: 'b2', to: 'b3' }))).toEqual([
        'Checkmate! Scripted won this time! Good game!',
      ]);
    });

    it('a draw says so', async () => {
      const session = createSession({
        kind: 'opponent-game',
        opponent: scripted(),
        childColour: 'white',
        fen: 'k7/8/1K6/8/8/8/8/2Q5 w - - 0 1',
      });
      await session.start();
      expect(said(await session.move({ from: 'c1', to: 'c7' }))).toEqual(['It’s a draw! Good game!']);
    });

    it('each move makes one sound: a plain move, then a capture', async () => {
      const session = createSession({ kind: 'opponent-game', opponent: scripted('d7d5', 'd8d5'), childColour: 'white' });
      await session.start();
      // The child's e4 and the Opponent's d5 are plain moves.
      expect(sounds(await session.move({ from: 'e2', to: 'e4' }))).toEqual(['move', 'move']);
      // exd5 is a capture, and so is the queen taking back.
      expect(sounds(await session.move({ from: 'e4', to: 'd5' }))).toEqual(['capture', 'capture']);
    });

    it('a check makes the check sound, even when it captures', async () => {
      const session = createSession({
        kind: 'opponent-game',
        opponent: scripted('e8d8'),
        childColour: 'white',
        fen: '4k3/8/8/8/4p3/8/8/4R1K1 w - - 0 1',
      });
      await session.start();
      // Rxe4+ takes the pawn and checks the king; the king steps aside.
      expect(sounds(await session.move({ from: 'e1', to: 'e4' }))).toEqual(['check', 'move']);
    });

    it('winning makes the win sound; losing makes no special sound', async () => {
      const win = createSession({
        kind: 'opponent-game',
        opponent: scripted(),
        childColour: 'white',
        fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
      });
      await win.start();
      expect(sounds(await win.move({ from: 'a1', to: 'a8' }))).toEqual(['win']);

      const lose = createSession({
        kind: 'opponent-game',
        opponent: scripted('a7a1'),
        childColour: 'white',
        fen: '6k1/r7/8/8/8/8/1P3PPP/6K1 w - - 0 1',
      });
      await lose.start();
      expect(sounds(await lose.move({ from: 'b2', to: 'b3' }))).toEqual(['move', 'check']);
    });

    it('a quiet move says nothing', async () => {
      const session = createSession({ kind: 'opponent-game', opponent: scripted('e7e5'), childColour: 'white' });
      await session.start();
      expect(said(await session.move({ from: 'e2', to: 'e4' }))).toEqual([]);
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

    it('asking for a piece leaves the board as it was, and the child can then choose', async () => {
      // A spare pawn each way keeps the game going after a knight appears.
      const fen = '7k/1P6/8/8/8/8/P7/K7 w - - 0 1';
      const session = createSession({ kind: 'opponent-game', opponent: scripted('h8h7'), childColour: 'white', fen });
      await session.start();
      await session.move({ from: 'b7', to: 'b8' });
      // A second ask still asks: the first one played nothing.
      expect(await session.move({ from: 'b7', to: 'b8' })).toEqual([
        { type: 'promotion-needed', from: 'b7', to: 'b8' },
      ]);
      const events = await session.move({ from: 'b7', to: 'b8', promotion: 'n' });
      expect(events.map((e) => e.type)).toEqual(['board-changed', 'sound', 'opponent-moved', 'board-changed', 'sound']);
      expect(events[0]).toMatchObject({ fen: '1N5k/8/8/8/8/8/P7/K7 b - - 0 1', lastMove: ['b7', 'b8'] });
    });

    it('a capture that promotes also asks for a piece', async () => {
      const session = createSession({
        kind: 'opponent-game',
        opponent: scripted('h8h7'),
        childColour: 'white',
        fen: 'r6k/1P6/8/8/8/8/8/K7 w - - 0 1',
      });
      await session.start();
      expect(await session.move({ from: 'b7', to: 'a8' })).toEqual([
        { type: 'promotion-needed', from: 'b7', to: 'a8' },
      ]);
      const events = await session.move({ from: 'b7', to: 'a8', promotion: 'r' });
      expect(events[0]).toMatchObject({ fen: 'R6k/8/8/8/8/8/8/K7 b - - 0 1' });
    });

    it.each(['q', 'r', 'b', 'n'] as const)('a black pawn can become %s', async (piece) => {
      const session = createSession({
        kind: 'opponent-game',
        opponent: scripted('a1a2'),
        childColour: 'black',
        fen: '7k/7p/8/8/8/8/6p1/K7 b - - 0 1',
      });
      await session.start();
      expect(await session.move({ from: 'g2', to: 'g1' })).toEqual([
        { type: 'promotion-needed', from: 'g2', to: 'g1' },
      ]);
      const events = await session.move({ from: 'g2', to: 'g1', promotion: piece });
      expect(events[0]).toMatchObject({ type: 'board-changed', fen: `7k/7p/8/8/8/8/8/K5${piece}1 w - - 0 2` });
    });

    it('a piece choice on a move that is not a promotion is rejected', async () => {
      const session = createSession({ kind: 'opponent-game', opponent: scripted(), childColour: 'white' });
      await session.start();
      expect((await session.move({ from: 'e2', to: 'e4', promotion: 'q' }))[0]).toEqual({
        type: 'move-rejected',
        from: 'e2',
        to: 'e4',
      });
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

  describe('undo', () => {
    it('takes back the child’s move and the Opponent’s reply', async () => {
      const session = createSession({ kind: 'opponent-game', opponent: scripted('e7e5'), childColour: 'white' });
      await session.start();
      await session.move({ from: 'e2', to: 'e4' });
      const events = await session.undo();
      expect(events).toEqual([
        expect.objectContaining({ type: 'board-changed', fen: START, childToMove: true, lastMove: undefined }),
      ]);
      if (events[0].type !== 'board-changed') throw new Error();
      expect(events[0].dests['e2']).toEqual(['e3', 'e4']);
    });

    it('works several times in a row, all the way back to the start', async () => {
      const session = createSession({ kind: 'opponent-game', opponent: scripted('e7e5', 'b8c6'), childColour: 'white' });
      await session.start();
      await session.move({ from: 'e2', to: 'e4' });
      await session.move({ from: 'g1', to: 'f3' });
      expect(await session.undo()).toEqual([
        expect.objectContaining({
          fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
          lastMove: ['e7', 'e5'],
          childToMove: true,
        }),
      ]);
      expect(await session.undo()).toEqual([expect.objectContaining({ fen: START, childToMove: true })]);
      // Nothing left to take back: the board stays at the start.
      expect(await session.undo()).toEqual([expect.objectContaining({ fen: START, childToMove: true })]);
    });

    it('never takes back the Opponent’s first move when the child is black and has not moved', async () => {
      const session = createSession({ kind: 'opponent-game', opponent: scripted('d2d4', 'c2c4'), childColour: 'black' });
      await session.start();
      const afterD4 = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1';
      expect(await session.undo()).toEqual([expect.objectContaining({ fen: afterD4, childToMove: true })]);
      await session.move({ from: 'd7', to: 'd5' });
      expect(await session.undo()).toEqual([expect.objectContaining({ fen: afterD4, childToMove: true })]);
    });

    it('once the game is over there is nothing to undo: the result stands', async () => {
      const session = createSession({
        kind: 'opponent-game',
        opponent: scripted('a7a1'),
        childColour: 'white',
        fen: '6k1/r7/8/8/8/8/1P3PPP/6K1 w - - 0 1',
      });
      await session.start();
      await session.move({ from: 'b2', to: 'b3' });
      expect(await session.undo()).toEqual([expect.objectContaining({ fen: '6k1/8/8/8/8/1P6/5PPP/r5K1 w - - 1 2' })]);
    });

    it('the board says whether there is anything to undo or redo', async () => {
      const session = createSession({ kind: 'opponent-game', opponent: scripted('e7e5'), childColour: 'white' });
      expect(await session.start()).toEqual([expect.objectContaining({ canUndo: false, canRedo: false })]);
      const moved = await session.move({ from: 'e2', to: 'e4' });
      expect(moved.at(-2)).toMatchObject({ type: 'board-changed', canUndo: true, canRedo: false });
      expect(await session.undo()).toEqual([expect.objectContaining({ canUndo: false, canRedo: true })]);
    });
  });

  describe('redo', () => {
    it('steps forward again, replaying the Opponent’s reply without asking it again', async () => {
      // The scripted Opponent would throw if asked for a second move.
      const session = createSession({ kind: 'opponent-game', opponent: scripted('e7e5'), childColour: 'white' });
      await session.start();
      await session.move({ from: 'e2', to: 'e4' });
      await session.undo();
      expect(await session.redo()).toEqual([
        expect.objectContaining({
          type: 'board-changed',
          fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
          lastMove: ['e7', 'e5'],
          childToMove: true,
          canUndo: true,
          canRedo: false,
        }),
      ]);
    });

    it('steps forward one turn at a time, up to the latest move', async () => {
      const session = createSession({ kind: 'opponent-game', opponent: scripted('e7e5', 'b8c6'), childColour: 'white' });
      await session.start();
      await session.move({ from: 'e2', to: 'e4' });
      await session.move({ from: 'g1', to: 'f3' });
      await session.undo();
      await session.undo();
      await session.redo();
      expect(await session.redo()).toEqual([
        expect.objectContaining({ lastMove: ['b8', 'c6'], canRedo: false }),
      ]);
      // Nothing more to replay.
      expect(await session.redo()).toEqual([expect.objectContaining({ lastMove: ['b8', 'c6'] })]);
    });

    it('a different move after undo means there is nothing to redo', async () => {
      const session = createSession({ kind: 'opponent-game', opponent: scripted('e7e5', 'e7e5'), childColour: 'white' });
      await session.start();
      await session.move({ from: 'e2', to: 'e4' });
      await session.undo();
      const moved = await session.move({ from: 'd2', to: 'd4' });
      expect(moved.at(-2)).toMatchObject({ type: 'board-changed', canRedo: false });
      expect(await session.redo()).toEqual([expect.objectContaining({ lastMove: ['e7', 'e5'], canRedo: false })]);
    });
  });
});
