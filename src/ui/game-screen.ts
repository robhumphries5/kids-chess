import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key, Role } from 'chessground/types';
import { createSession, type BoardChanged, type Colour, type SessionEvent } from '../core/session';
import type { MoveChoice, PromotionPiece } from '../opponents/opponent';
import { createSnail } from '../opponents/snail';
import type { Sound } from './sound';
import type { Speaker } from './speech';

/** The Promotion Picker's choices, in order. `role` is chessground's piece class, so the pictures match the board. */
const PROMOTION_CHOICES: readonly { piece: PromotionPiece; name: string; role: Role }[] = [
  { piece: 'q', name: 'Queen', role: 'queen' },
  { piece: 'r', name: 'Rook', role: 'rook' },
  { piece: 'b', name: 'Bishop', role: 'bishop' },
  { piece: 'n', name: 'Knight', role: 'knight' },
];

/** Pause before showing the Opponent's reply, so the child sees their own move land. */
const OPPONENT_DELAY_MS = 600;

interface Elements {
  board: HTMLElement;
  status: HTMLElement;
  /** Where the latest spoken message is shown, with its 🔊 replay. */
  message: HTMLElement;
  overlay: HTMLElement;
}

/** The Speak and Sound adapters, shared across games. */
export interface GameAudio {
  speaker: Speaker;
  sound: Sound;
}

/** Thin UI: renders Session events and forwards the child's moves. No chess rules here. */
export function startGame(el: Elements, audio: GameAudio, childColour: Colour = 'white'): void {
  const opponent = createSnail();
  const session = createSession({ kind: 'opponent-game', opponent, childColour });
  let busy = false;
  let lastBoardEvent: BoardChanged | undefined;
  let lastSaid = '';
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

  async function sendMove(move: MoveChoice): Promise<void> {
    if (busy) return;
    busy = true;
    cg.set({ movable: { color: undefined } });
    // The child has moved on, so the last message (say, "Check!") is finished with.
    el.message.replaceChildren();
    try {
      await render(await session.move(move));
    } finally {
      busy = false;
    }
  }

  async function render(events: SessionEvent[]): Promise<void> {
    for (const event of events) {
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
          el.status.textContent = event.childToMove ? 'Your turn!' : `${opponent.name} is thinking…`;
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
          el.message.replaceChildren(spokenMessage(event.text));
          break;
        case 'game-over':
          showResult();
          break;
        case 'move-rejected':
          break;
      }
    }
  }

  /**
   * The Promotion Picker: big pictures of the four pieces in the child's colour. Tapping one completes
   * the move. Shown on every promotion; nothing is ever chosen for the child, and no choice is special.
   */
  function showPromotionPicker(from: string, to: string): void {
    showCard('What should your pawn become?', (body) => {
      const choices = document.createElement('div');
      choices.className = 'promotion-choices cg-wrap';
      for (const { piece, name, role } of PROMOTION_CHOICES) {
        const button = document.createElement('button');
        button.className = 'promotion-choice';
        button.setAttribute('aria-label', name);
        const picture = document.createElement('piece');
        picture.className = `${role} ${childColour}`;
        const label = document.createElement('span');
        label.textContent = name;
        button.append(picture, label);
        button.addEventListener('click', () => {
          el.overlay.hidden = true;
          // Runs after the current sendMove has released `busy`.
          setTimeout(() => void sendMove({ from, to, promotion: piece }));
        });
        choices.append(button);
      }
      const back = document.createElement('button');
      back.className = 'small-button';
      back.textContent = '↩ Back';
      back.addEventListener('click', () => {
        el.overlay.hidden = true;
        // The pawn was only dragged on screen; put the board back as the Session last showed it.
        if (lastBoardEvent) void render([lastBoardEvent]);
      });
      body.append(choices, back);
    });
  }

  /** A message that was spoken, with a 🔊 button to hear it again. */
  function spokenMessage(text: string): HTMLElement {
    const line = document.createElement('span');
    line.className = 'spoken';
    const words = document.createElement('span');
    words.textContent = text;
    const replay = document.createElement('button');
    replay.className = 'replay-button';
    replay.textContent = '🔊';
    replay.setAttribute('aria-label', 'Hear it again');
    replay.addEventListener('click', () => audio.speaker.say(text));
    line.append(words, replay);
    return line;
  }

  /** The Session has already said how the game ended (just before this event); the card shows those words. */
  function showResult(): void {
    el.status.textContent = '';
    showCard(spokenMessage(lastSaid), (body) => {
      const again = document.createElement('button');
      again.className = 'big-button';
      again.textContent = 'Play again';
      again.addEventListener('click', () => {
        el.overlay.hidden = true;
        cg.destroy();
        startGame(el, audio, childColour);
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
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
