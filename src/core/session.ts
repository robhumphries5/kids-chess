import { Chess } from 'chess.js';
import type { MoveChoice, Opponent } from '../opponents/opponent';

export type Colour = 'white' | 'black';

export interface OpponentGameOptions {
  kind: 'opponent-game';
  opponent: Opponent;
  childColour: Colour;
  /** Starting position; defaults to the normal start. */
  fen?: string;
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

export type SessionEvent = BoardChanged | OpponentMoved | MoveRejected | PromotionNeeded | GameOver | Say | SoundCue;

export interface Session {
  start(): Promise<SessionEvent[]>;
  move(move: MoveChoice): Promise<SessionEvent[]>;
}

export function createSession(options: SessionOptions): Session {
  const chess = new Chess(options.fen);
  const childTurn = options.childColour === 'white' ? 'w' : 'b';
  let lastMove: [string, string] | undefined;

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
      lastMove,
      check: chess.inCheck(),
      childToMove: childToMove(),
      dests,
    };
  }

  function play(move: MoveChoice) {
    const played = chess.move(move);
    lastMove = [played.from, played.to];
    return played;
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
    return [boardChanged(), sound, ...say, ...ended];
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
      const played = play(move);
      const afterChild = afterMove(Boolean(played.captured));
      if (chess.isGameOver()) return afterChild;
      return [...afterChild, ...(await opponentTurn())];
    },
  };
}
