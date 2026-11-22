import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import { resolveColour, type ColourChoice } from '../core/colour';
import type { SavedGame, SavedGameStore } from '../core/saved-game';
import { createSession, type BoardChanged, type Colour, type SessionEvent } from '../core/session';
import type { MoveChoice } from '../opponents/opponent';
import type { OpponentCharacter } from '../opponents/roster';
import { promotionChoices } from './promotion-picker';
import type { Sound } from './sound';
import type { Speaker } from './speech';
import { spokenMessage } from './spoken';

/** Pause before showing the Opponent's reply, so the child sees their own move land. */
const OPPONENT_DELAY_MS = 600;

interface Elements {
  board: HTMLElement;
  /** Where the latest spoken message is shown, with its 🔊 replay. */
  message: HTMLElement;
  overlay: HTMLElement;
  /** Where the Undo and Redo buttons go. Shown only during a game. */
  controls: HTMLElement;
}

/** Where a Profile's game in progress is saved after every move, and an earlier one to carry on. */
export interface GameSaving {
  store: SavedGameStore;
  profileId: string;
  /** A saved game to resume. "Play again" afterwards starts a fresh one. */
  resume?: SavedGame;
}

/** The Speak and Sound adapters, shared across games. */
export interface GameAudio {
  speaker: Speaker;
  sound: Sound;
}

/** A game in progress. */
export interface Game {
  /** Leave the game: the board is cleared and nothing more is said or played. */
  stop(): void;
}

/**
 * Start a game against the chosen Opponent. The board faces the child's side. "Play again" starts a
 * fresh one in the same place, with the same Opponent and colour choice (🎲 picks again). The game is
 * saved after every move, so the child can quit any time and carry on later.
 */
export function startGame(
  el: Elements,
  audio: GameAudio,
  character: OpponentCharacter,
  colour: ColourChoice,
  saving: GameSaving,
): Game {
  const fresh = (resume?: SavedGame) =>
    playOne(el, audio, character, resume?.childColour ?? resolveColour(colour), playAgain, saving, resume);
  // Only called from a click, after `current` is set.
  let current = fresh(saving.resume);
  function playAgain(): void {
    current.stop();
    current = fresh();
  }
  return { stop: () => current.stop() };
}

/** Thin UI: renders Session events and forwards the child's moves. No chess rules here. */
function playOne(
  el: Elements,
  audio: GameAudio,
  character: OpponentCharacter,
  childColour: Colour,
  playAgain: () => void,
  saving: GameSaving,
  resume: SavedGame | undefined,
): Game {
  const opponent = character.create();
  const session = createSession({
    kind: 'opponent-game',
    opponent,
    childColour,
    fen: resume?.fen,
    moves: resume?.moves,
    saveTo: { store: saving.store, profileId: saving.profileId },
  });
  let busy = false;
  let lastBoardEvent: BoardChanged | undefined;
  let lastSaid = '';
  let stopped = false;
  el.message.replaceChildren();

  const cg: Api = Chessground(el.board, {
    orientation: childColour,
    movable: { free: false, showDests: true, color: undefined },
    premovable: { enabled: false },
    draggable: { enabled: true, showGhost: true },
    animation: { enabled: true, duration: 250 },
    events: {
      move: (from, to) => void sendMove({ from, to }),
    },
  });

  // Undo and Redo work straight away, with no confirmation. Greyed out when there is nothing to do.
  const undoButton = controlButton('↶', 'Undo', () => void send(() => session.undo()));
  const redoButton = controlButton('↷', 'Redo', () => void send(() => session.redo()));
  undoButton.disabled = redoButton.disabled = true;
  el.controls.replaceChildren(undoButton, redoButton);
  el.controls.hidden = false;

  const sendMove = (move: MoveChoice) => send(() => session.move(move));

  /** One command at a time: nothing else is taken while the Opponent is thinking. */
  async function send(command: () => Promise<SessionEvent[]>): Promise<void> {
    if (busy) return;
    busy = true;
    cg.set({ movable: { color: undefined } });
    // The child has moved on, so the last message (say, "Check!") is finished with.
    el.message.replaceChildren();
    // Undo or Redo while the Promotion Picker is up: the pawn's move is dropped.
    el.overlay.hidden = true;
    try {
      await render(await command());
    } finally {
      busy = false;
    }
  }

  async function render(events: SessionEvent[]): Promise<void> {
    for (const event of events) {
      // The child may leave mid-reply (the Opponent pauses before moving).
      if (stopped) return;
      switch (event.type) {
        case 'board-changed':
          lastBoardEvent = event;
          cg.set({
            fen: event.fen,
            turnColor: event.turn,
            lastMove: event.lastMove as Key[] | undefined,
            check: event.check,
            movable: {
              color: event.childToMove ? childColour : undefined,
              dests: new Map(Object.entries(event.dests)) as Map<Key, Key[]>,
            },
          });
          undoButton.disabled = !event.canUndo;
          redoButton.disabled = !event.canRedo;
          break;
        case 'opponent-moved':
          await wait(OPPONENT_DELAY_MS);
          break;
        case 'promotion-needed':
          showPromotionPicker(event.from, event.to);
          break;
        case 'sound':
          audio.sound.play(event.sound);
          break;
        case 'say':
          lastSaid = event.text;
          audio.speaker.say(event.text);
          el.message.replaceChildren(spokenMessage(event.text, audio.speaker));
          break;
        case 'game-over':
          showResult();
          break;
        case 'move-rejected':
          break;
      }
    }
  }

  /** Tapping a piece completes the move. Shown on every promotion; nothing is ever chosen for the child. */
  function showPromotionPicker(from: string, to: string): void {
    showCard('What should your pawn become?', (body) => {
      const choices = promotionChoices(
        childColour,
        (promotion) => {
          el.overlay.hidden = true;
          // Runs after the current sendMove has released `busy`.
          setTimeout(() => void sendMove({ from, to, promotion }));
        },
        () => {
          el.overlay.hidden = true;
          // The pawn was only dragged on screen; put the board back as the Session last showed it.
          if (lastBoardEvent) void render([lastBoardEvent]);
        },
      );
      body.append(...choices);
    });
  }

  /** The Session has already said how the game ended (just before this event); the card shows those words. */
  function showResult(): void {
    showCard(spokenMessage(lastSaid, audio.speaker), (body) => {
      const again = document.createElement('button');
      again.className = 'big-button';
      again.textContent = 'Play again';
      again.addEventListener('click', () => {
        playAgain();
      });
      body.append(again);
    });
  }

  function showCard(title: string | HTMLElement, fill: (body: HTMLElement) => void): void {
    const box = document.createElement('div');
    box.className = 'card';
    const heading = document.createElement('h2');
    heading.append(title);
    box.append(heading);
    fill(box);
    el.overlay.replaceChildren(box);
    el.overlay.hidden = false;
  }

  void session.start().then(render);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      el.overlay.hidden = true;
      el.message.replaceChildren();
      el.controls.hidden = true;
      el.controls.replaceChildren();
      cg.destroy();
    },
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A big round picture button beside the board, with its word underneath. */
function controlButton(picture: string, label: string, onTap: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'control-button';
  button.setAttribute('aria-label', label);
  const icon = document.createElement('span');
  icon.className = 'control-icon';
  icon.textContent = picture;
  const words = document.createElement('span');
  words.textContent = label;
  button.append(icon, words);
  button.addEventListener('click', onTap);
  return button;
}
