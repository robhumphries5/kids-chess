import { Chess } from 'chess.js';
import type { MoveChoice, Opponent } from '../opponents/opponent';
import { pointsForResult } from './game-rewards';
import type { PointsAwarded, PointsLedger } from './points';
import type { SavedGame, SavedGameStore } from './saved-game';
import type { StarEarned, Stars } from './stars';

export type Colour = 'white' | 'black';

export interface OpponentGameOptions {
  kind: 'opponent-game';
  opponent: Opponent;
  childColour: Colour;
  /** Starting position; defaults to the normal start. */
  fen?: string;
  /** Moves already played from the starting position, in SAN: resumes a saved game. */
  moves?: string[];
  /** Where to save the game after every move, so it can be resumed. A finished game is cleared. */
  saveTo?: { store: SavedGameStore; profileId: string };
  /** What the child earns when the game ends: Points (through the ledger) and a star for a win. */
  rewards?: GameRewards;
}

/** Where a finished game's rewards go. */
export interface GameRewards {
  points: PointsLedger;
  stars: Stars;
  /** The Opponent's place on the ladder, 1 for the weakest: sets the Points for a win. */
  strength: number;
}

export type SessionOptions = OpponentGameOptions;

export interface BoardChanged {
  type: 'board-changed';
  fen: string;
  /** The move that produced this position, as [from, to]. */
  lastMove?: [string, string];
  /** The side to move. */
  turn: Colour;
  /** True when the side to move is in check (or checkmate). */
  check: boolean;
  /** True when it is the child's turn and the game is not over. */
  childToMove: boolean;
  /** Legal destinations for the child's pieces (empty when it isn't their turn). */
  dests: Record<string, string[]>;
  /** Opponent games: true when Undo would take something back. */
  canUndo?: boolean;
  /** Opponent games: true when Redo would replay something that was undone. */
  canRedo?: boolean;
}

export interface OpponentMoved {
  type: 'opponent-moved';
  from: string;
  to: string;
  san: string;
}

/** The child's move wasn't legal (or it wasn't their turn); nothing changed. */
export interface MoveRejected {
  type: 'move-rejected';
  from: string;
  to: string;
}

/** A pawn reached the end and the child must pick a piece (the Promotion Picker). Never auto-queen. */
export interface PromotionNeeded {
  type: 'promotion-needed';
  from: string;
  to: string;
}

export type GameResult = 'won' | 'lost' | 'drawn';
export type GameOverReason = 'checkmate' | 'stalemate' | 'insufficient-material' | 'threefold-repetition' | 'fifty-move-rule';

/** The game has ended. The result is from the child's point of view. */
export interface GameOver {
  type: 'game-over';
  result: GameResult;
  reason: GameOverReason;
}

/** Something to read aloud (and show, with a 🔊 replay). British English. */
export interface Say {
  type: 'say';
  text: string;
}

/** One sound effect per move landing. Check beats capture; winning beats both. Losing has no special sound. */
export interface SoundCue {
  type: 'sound';
  sound: 'move' | 'capture' | 'check' | 'win';
}

export type SessionEvent =
  | BoardChanged
  | OpponentMoved
  | MoveRejected
  | PromotionNeeded
  | GameOver
  | Say
  | SoundCue
  | PointsAwarded
  | StarEarned;

export interface Session {
  start(): Promise<SessionEvent[]>;
  move(move: MoveChoice): Promise<SessionEvent[]>;
  /** Take back the child's last move, and the Opponent's reply if it has been played. No confirmation. */
  undo(): Promise<SessionEvent[]>;
  /** Step forward again over what Undo took back, one turn at a time. A new move by the child clears it. */
  redo(): Promise<SessionEvent[]>;
}

export function createSession(options: SessionOptions): Session {
  const chess = new Chess(options.fen);
  const childTurn = options.childColour === 'white' ? 'w' : 'b';
  /** What Undo took back, latest last: each entry is one turn (the child's move and any reply), in SAN. */
  const redoable: string[][] = [];
  /** True once this game's result has earned its rewards. */
  let rewarded = false;

  for (const san of options.moves ?? []) {
    try {
      chess.move(san);
    } catch {
      // Corrupt saved data: carry on from the last good position.
      break;
    }
  }

  /** Keep the game for later, or forget it once it is over. */
  function save(): void {
    if (!options.saveTo) return;
    const { store, profileId } = options.saveTo;
    if (chess.isGameOver()) return store.clear(profileId);
    const game: SavedGame = { opponentId: options.opponent.id, childColour: options.childColour, moves: chess.history() };
    if (options.fen) game.fen = options.fen;
    store.save(profileId, game);
  }

  /** Where in the game's moves the child's last move is, or -1 when the result stands or they haven't moved. */
  function undoFrom(): number {
    if (chess.isGameOver()) return -1;
    const history = chess.history({ verbose: true });
    let i = history.length - 1;
    while (i >= 0 && history[i].color !== childTurn) i--;
    return i;
  }

  function childToMove(): boolean {
    return chess.turn() === childTurn && !chess.isGameOver();
  }

  /** The child's legal moves from `from` to `to` (several when promoting); none if it isn't their turn. */
  function childMovesBetween(from: string, to: string) {
    if (!childToMove()) return [];
    return chess.moves({ verbose: true }).filter((m) => m.from === from && m.to === to);
  }

  function boardChanged(): BoardChanged {
    const dests: Record<string, string[]> = {};
    if (childToMove()) {
      for (const m of chess.moves({ verbose: true })) {
        const list = (dests[m.from] ??= []);
        if (!list.includes(m.to)) list.push(m.to);
      }
    }
    return {
      type: 'board-changed',
      fen: chess.fen(),
      turn: chess.turn() === 'w' ? 'white' : 'black',
      lastMove: lastMove(),
      check: chess.inCheck(),
      childToMove: childToMove(),
      dests,
      canUndo: undoFrom() >= 0,
      canRedo: redoable.length > 0,
    };
  }

  function play(move: MoveChoice) {
    const played = chess.move(move);
    save();
    return played;
  }

  /** The move that produced the current position, as [from, to]. */
  function lastMove(): [string, string] | undefined {
    const last = chess.history({ verbose: true }).at(-1);
    return last && [last.from, last.to];
  }

  /** Everything that follows a move landing: the new board, what to say, and the end of the game if it has ended. */
  function afterMove(captured: boolean): SessionEvent[] {
    const ended = gameOver();
    const check = chess.inCheck();
    const sound: SoundCue = {
      type: 'sound',
      sound: ended[0]?.result === 'won' ? 'win' : check ? 'check' : captured ? 'capture' : 'move',
    };
    const text = ended.length ? spokenResult(ended[0]) : check ? 'Check!' : undefined;
    const say: Say[] = text ? [{ type: 'say', text }] : [];
    return [boardChanged(), sound, ...say, ...reward(ended[0]), ...ended];
  }

  /**
   * What the game just finished earns, awarded once only: a finished game can't be undone, and its
   * saved copy is cleared, so it is never resumed and rewarded again.
   */
  function reward(ended: GameOver | undefined): SessionEvent[] {
    const rewards = options.rewards;
    if (!ended || !rewards || rewarded) return [];
    rewarded = true;
    const events: SessionEvent[] = [rewards.points.award(pointsForResult(ended.result, rewards.strength))];
    if (ended.result === 'won') events.push(rewards.stars.add(options.opponent.id));
    return events;
  }

  /** One message for the end of the game (two would cut each other off when spoken). Gentle when the child loses. */
  function spokenResult({ result, reason }: GameOver): string {
    const message =
      result === 'won'
        ? 'You won! Well done!'
        : result === 'lost'
          ? `${options.opponent.name} won this time! Good game!`
          : 'It’s a draw! Good game!';
    return reason === 'checkmate' ? `Checkmate! ${message}` : message;
  }

  /** A game-over event if the game has just ended, else nothing. */
  function gameOver(): GameOver[] {
    if (!chess.isGameOver()) return [];
    if (chess.isCheckmate()) {
      // The side to move has been mated.
      return [{ type: 'game-over', result: chess.turn() === childTurn ? 'lost' : 'won', reason: 'checkmate' }];
    }
    const reason: GameOverReason = chess.isStalemate()
      ? 'stalemate'
      : chess.isInsufficientMaterial()
        ? 'insufficient-material'
        : chess.isThreefoldRepetition()
          ? 'threefold-repetition'
          : 'fifty-move-rule';
    return [{ type: 'game-over', result: 'drawn', reason }];
  }

  async function opponentTurn(): Promise<SessionEvent[]> {
    const played = play(await options.opponent.pickMove(chess.fen()));
    return [{ type: 'opponent-moved', from: played.from, to: played.to, san: played.san }, ...afterMove(Boolean(played.captured))];
  }

  return {
    async start() {
      const events: SessionEvent[] = [boardChanged()];
      if (!childToMove() && !chess.isGameOver()) events.push(...(await opponentTurn()));
      return events;
    },

    async move(move) {
      const candidates = childMovesBetween(move.from, move.to);
      if (!move.promotion && candidates.some((m) => m.promotion)) {
        return [{ type: 'promotion-needed', from: move.from, to: move.to }];
      }
      if (!candidates.some((m) => m.promotion === move.promotion)) {
        return [{ type: 'move-rejected', from: move.from, to: move.to }, boardChanged()];
      }
      // A different move: what was undone can no longer be replayed.
      redoable.length = 0;
      const played = play(move);
      const afterChild = afterMove(Boolean(played.captured));
      if (chess.isGameOver()) return afterChild;
      return [...afterChild, ...(await opponentTurn())];
    },

    async undo() {
      const from = undoFrom();
      if (from >= 0) {
        const turn = chess.history().slice(from);
        for (const _ of turn) chess.undo();
        redoable.push(turn);
        save();
      }
      return [boardChanged()];
    },

    async redo() {
      const turn = redoable.pop();
      if (turn) {
        for (const san of turn) chess.move(san);
        save();
      }
      return [boardChanged()];
    },
  };
}
