// The help features in an Opponent game: Blunder Warnings (and, later, Missed-Chance Alerts and
// Move Colours). Detection itself is tested in blunder-warnings.test.ts; this is how the Session uses it.
import { describe, expect, it } from 'vitest';
import { createFakeAnalyser } from '../engine/fake-analyser';
import type { Opponent } from '../opponents/opponent';
import type { KindSwitches } from './profiles';
import { createSavedGameStore } from './saved-game';
import { createSession, type GameHelp } from './session';

const ALL_ON: KindSwitches = { checkmate: true, queen: true, rook: true, bishopKnight: true };

/** White to move; Qd5 would leave the queen for the f6 knight, Qd2 is safe. The pawn keeps the game going after Nxd5. */
const QUEEN = '7k/8/5n2/8/8/8/P7/3Q2K1 w - - 0 1';
const QUEEN_ON_D5 = '7k/8/5n2/3Q4/8/8/P7/6K1 b - - 1 1';

/** An Opponent that plays a fixed list of moves in order, and counts how often it was asked. */
function scripted(...moves: string[]): Opponent & { asked: number } {
  const opponent = {
    id: 'scripted',
    name: 'Scripted',
    asked: 0,
    async pickMove() {
      const m = moves[opponent.asked++];
      return { from: m.slice(0, 2), to: m.slice(2, 4) };
    },
  };
  return opponent;
}

const help = (blunderWarning: KindSwitches = ALL_ON): GameHelp => ({ analyser: createFakeAnalyser({}), blunderWarning });

function game(opponent: Opponent, gameHelp?: GameHelp, saveTo?: { store: ReturnType<typeof createSavedGameStore>; profileId: string }) {
  return createSession({ kind: 'opponent-game', opponent, childColour: 'white', fen: QUEEN, help: gameHelp, saveTo });
}

describe('Blunder Warnings in a game', () => {
  it('a blunder is played, then warned about with why, and the Opponent waits', async () => {
    const opponent = scripted('f6d5');
    const session = game(opponent, help());
    await session.start();
    const events = await session.move({ from: 'd1', to: 'd5' });
    expect(events).toEqual([
      expect.objectContaining({ type: 'board-changed', fen: QUEEN_ON_D5, childToMove: false, canUndo: true }),
      { type: 'sound', sound: 'move' },
      { type: 'blunder-warning', kind: 'queen', reason: 'The knight could take your queen!', threat: ['f6', 'd5'] },
      { type: 'say', text: 'The knight could take your queen!' },
    ]);
    expect(opponent.asked).toBe(0);
  });

  it('Keep it carries on exactly as if there had been no warning', async () => {
    const warned = game(scripted('f6d5'), help());
    await warned.start();
    await warned.move({ from: 'd1', to: 'd5' });
    const kept = await warned.keep();

    const plain = game(scripted('f6d5'));
    await plain.start();
    const unwarned = await plain.move({ from: 'd1', to: 'd5' });

    // Everything after the child's move landing: the Opponent's reply and the board after it.
    expect(kept).toEqual(unwarned.slice(2));
    expect(kept).toContainEqual(expect.objectContaining({ type: 'opponent-moved', san: 'Nxd5' }));
  });

  it('Undo takes the move back, and the child can choose again', async () => {
    const opponent = scripted('h8g8');
    const saveTo = { store: createSavedGameStore(undefined), profileId: 'fox' };
    const session = game(opponent, help(), saveTo);
    await session.start();
    await session.move({ from: 'd1', to: 'd5' });
    expect(await session.undo()).toEqual([expect.objectContaining({ type: 'board-changed', fen: QUEEN, childToMove: true })]);
    expect(saveTo.store.load('fox')?.moves).toEqual([]);
    expect(opponent.asked).toBe(0);

    const safe = await session.move({ from: 'd1', to: 'd2' });
    expect(safe.map((e) => e.type)).not.toContain('blunder-warning');
    expect(safe).toContainEqual(expect.objectContaining({ type: 'opponent-moved', san: 'Kg8' }));
  });

  it('Redo after undoing a warned move plays it again, and the Opponent replies', async () => {
    const session = game(scripted('f6d5'), help());
    await session.start();
    await session.move({ from: 'd1', to: 'd5' });
    await session.undo();
    const events = await session.redo();
    expect(events.map((e) => e.type)).not.toContain('blunder-warning');
    expect(events).toContainEqual(expect.objectContaining({ type: 'opponent-moved', san: 'Nxd5' }));
    expect(events.at(-2)).toMatchObject({ type: 'board-changed', childToMove: true });
  });

  it('Keep it with no warning waiting does nothing', async () => {
    const opponent = scripted('h8g8');
    const session = game(opponent, help());
    await session.start();
    expect(await session.keep()).toEqual([]);
    await session.move({ from: 'd1', to: 'd2' });
    expect(await session.keep()).toEqual([]);
    expect(opponent.asked).toBe(1);
  });

  it('with that kind switched off, there is no warning and the Opponent replies straight away', async () => {
    const session = game(scripted('f6d5'), help({ ...ALL_ON, queen: false }));
    await session.start();
    const events = await session.move({ from: 'd1', to: 'd5' });
    expect(events.map((e) => e.type)).not.toContain('blunder-warning');
    expect(events).toContainEqual(expect.objectContaining({ type: 'opponent-moved', san: 'Nxd5' }));
  });

  it('a check that is also a blunder says both, in one message', async () => {
    // Qd5+ checks the king on g8 and leaves the queen for the f6 knight.
    const session = createSession({
      kind: 'opponent-game',
      opponent: scripted('f6d5'),
      childColour: 'white',
      fen: '6k1/8/5n2/8/8/8/P7/3Q2K1 w - - 0 1',
      help: help(),
    });
    await session.start();
    const says = (await session.move({ from: 'd1', to: 'd5' })).filter((e) => e.type === 'say');
    expect(says).toEqual([{ type: 'say', text: 'Check! The knight could take your queen!' }]);
  });
});
