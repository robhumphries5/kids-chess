import { Chess } from 'chess.js';
import type { Analyser } from '../engine/analyser';
import type { MoveChoice, Opponent } from '../opponents/opponent';
import { findBlunder, type Blunder } from './blunder-warnings';
import { pointsForResult } from './game-rewards';
import { findMissedChance, type MissedChance } from './missed-chances';
import type { PointsAwarded, PointsLedger } from './points';
import type { KindSwitches } from './profiles';
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
  /** The Profile's help switches for this game. Absent: no help. */
  help?: GameHelp;
}

/**
 * The help an Opponent game gives, from the Profile's Settings. Later help (Move Colours) adds its
 * switches here and shares the analyser.
 */
export interface GameHelp {
  /** Scores positions for the help features. */
  analyser: Analyser;
  /** Which Blunder Warnings are on. Absent: none. */
  blunderWarning?: KindSwitches;
  /** Which Missed-Chance Alerts are on. Absent: none. */
  missedChance?: KindSwitches;
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

/**
 * The child's move (already played) gives something away. The Opponent waits until the child
 * chooses Keep it (`keep`) or Undo (`undo`); the move itself is never blocked. The reason is spoken too.
 */
export interface BlunderWarning extends Blunder {
  type: 'blunder-warning';
}

/**
 * At the start of the child's turn, the Opponent has left a treat to find. The text (spoken too, by
 * the `say` that follows) says what kind, never where or how. Any move may be played next.
 */
export interface MissedChanceAlert extends MissedChance {
  type: 'missed-chance';
}

export type SessionEvent =
  | BoardChanged
  | OpponentMoved
  | MoveRejected
  | PromotionNeeded
  | GameOver
  | Say
  | SoundCue
  | BlunderWarning
  | MissedChanceAlert
  | PointsAwarded
  | StarEarned;

export interface Session {
  start(): Promise<SessionEvent[]>;
  move(move: MoveChoice): Promise<SessionEvent[]>;
  /** Take back the child's last move, and the Opponent's reply if it has been played. No confirmation. */
  undo(): Promise<SessionEvent[]>;
  /** Step forward again over what Undo took back, one turn at a time. A new move by the child clears it. */
  redo(): Promise<SessionEvent[]>;
  /** Keep it: after a Blunder Warning, carry on as if there had been none. Otherwise does nothing. */
  keep(): Promise<SessionEvent[]>;
}

export function createSession(options: SessionOptions): Session {
  const chess = new Chess(options.fen);
  const childTurn = options.childColour === 'white' ? 'w' : 'b';
  /** What Undo took back, latest last: each entry is one turn (the child's move and any reply), in SAN. */
  const redoable: string[][] = [];
  /** True once this game's result has earned its rewards. */
  let rewarded = false;
  /** True while a Blunder Warning waits for Keep it or Undo: the Opponent holds its reply. */
  let warningWaits = false;

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
  function afterMove(captured: boolean, note?: { event: BlunderWarning | MissedChanceAlert; text: string }): SessionEvent[] {
    const ended = gameOver();
    const check = chess.inCheck();
    const sound: SoundCue = {
      type: 'sound',
      sound: ended[0]?.result === 'won' ? 'win' : check ? 'check' : captured ? 'capture' : 'move',
    };
    // One message: two would cut each other off when spoken.
    const text = ended.length ? spokenResult(ended[0]) : [check && 'Check!', note?.text].filter(Boolean).join(' ');
    const say: Say[] = text ? [{ type: 'say', text }] : [];
    return [boardChanged(), sound, ...(note ? [note.event] : []), ...say, ...reward(ended[0]), ...ended];
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

  /** A Blunder Warning for the child's move just played from `before`, if one is switched on and due. */
  async function blunderWarning(before: string, move: MoveChoice): Promise<BlunderWarning | undefined> {
    const help = options.help;
    if (!help?.blunderWarning || chess.isGameOver()) return undefined;
    const blunder = await findBlunder(before, move, help.analyser, help.blunderWarning);
    return blunder && { type: 'blunder-warning', ...blunder };
  }

  /** A Missed-Chance Alert for the start of the child's turn, if one is switched on and due. */
  async function missedChanceAlert(): Promise<MissedChanceAlert | undefined> {
    const help = options.help;
    if (!help?.missedChance || !childToMove()) return undefined;
    const chance = await findMissedChance(chess.fen(), help.analyser, help.missedChance);
    return chance && { type: 'missed-chance', ...chance };
  }

  async function opponentTurn(): Promise<SessionEvent[]> {
    const played = play(await options.opponent.pickMove(chess.fen()));
    const alert = await missedChanceAlert();
    return [
      { type: 'opponent-moved', from: played.from, to: played.to, san: played.san },
      ...afterMove(Boolean(played.captured), alert && { event: alert, text: alert.text }),
    ];
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
      const before = chess.fen();
      const played = play(move);
      const warning = await blunderWarning(before, move);
      const afterChild = afterMove(Boolean(played.captured), warning && { event: warning, text: warning.reason });
      if (chess.isGameOver()) return afterChild;
      if (warning) {
        warningWaits = true;
        return afterChild;
      }
      return [...afterChild, ...(await opponentTurn())];
    },

    async keep() {
      if (!warningWaits) return [];
      warningWaits = false;
      return opponentTurn();
    },

    async undo() {
      warningWaits = false;
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
        // A move taken back from a Blunder Warning had no reply yet: replaying it means Keep it.
        if (!childToMove() && !chess.isGameOver()) return [boardChanged(), ...(await opponentTurn())];
      }
      return [boardChanged()];
    },
  };
}
