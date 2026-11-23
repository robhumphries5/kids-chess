import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import { resolveColour, type ColourChoice } from '../core/colour';
import { createPointsLedger } from '../core/points';
import type { ProfileStore } from '../core/profiles';
import type { SavedGame, SavedGameStore } from '../core/saved-game';
import {
  createSession,
  type BlunderWarning,
  type BoardChanged,
  type Colour,
  type GameHelp,
  type GameResult,
  type SessionEvent,
} from '../core/session';
import { createStars } from '../core/stars';
import type { MoveChoice } from '../opponents/opponent';
import type { OpponentCharacter } from '../opponents/roster';
import { createMenuChoice } from './menu';
import { DRAW_SVG, OPPONENT_PICTURES, PICK_SOMEONE_ELSE_SVG, PLAY_SVG } from './pictures';
import { promotionChoices } from './promotion-picker';
import type { Sound } from './sound';
import type { Speaker } from './speech';
import { spokenMessage } from './spoken';
import { showStarJar } from './star-jar';
import { showThinking, thinkingInMessage } from './thinking';

/** Pause before showing the Opponent's reply, so the child sees their own move land. */
const OPPONENT_DELAY_MS = 600;

interface Elements {
  board: HTMLElement;
  /** Where the latest spoken message is shown, with its 🔊 replay. */
  message: HTMLElement;
  overlay: HTMLElement;
  /** Where the Undo and Redo buttons go. Shown only during a game. */
  controls: HTMLElement;
  /** The one Go Button: confirms Rematch or Pick someone else when the game is over. */
  go: HTMLButtonElement;
  /** The Profile's Points jar, topped up when the game ends. */
  starJar: HTMLElement;
}

/** Where a Profile's game in progress is saved after every move, and an earlier one to carry on. */
export interface GameSaving {
  store: SavedGameStore;
  profileId: string;
  /** Where the Profile's Points and stars are kept. */
  profiles: ProfileStore;
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
 * Start a game against the chosen Opponent. The board faces the child's side. When it ends, Rematch
 * starts a fresh one in the same place, with the same Opponent and colour choice (🎲 picks again);
 * Pick someone else leaves for the Opponent picker. The game is saved after every move, so the child
 * can quit any time and carry on later. `help` is the Profile's help (Blunder Warnings, Missed-Chance Alerts…), if any.
 */
export function startGame(
  el: Elements,
  audio: GameAudio,
  character: OpponentCharacter,
  colour: ColourChoice,
  saving: GameSaving,
  pickSomeoneElse: () => void,
  help?: GameHelp,
): Game {
  const next = { playAgain, pickSomeoneElse };
  const fresh = (resume?: SavedGame) =>
    playOne(el, audio, character, resume?.childColour ?? resolveColour(colour), next, saving, resume, help);
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
  next: { playAgain: () => void; pickSomeoneElse: () => void },
  saving: GameSaving,
  resume: SavedGame | undefined,
  help: GameHelp | undefined,
): Game {
  const opponent = showThinking(character.create(), thinkingInMessage(el.message, character.name));
  const session = createSession({
    kind: 'opponent-game',
    opponent,
    childColour,
    fen: resume?.fen,
    moves: resume?.moves,
    saveTo: { store: saving.store, profileId: saving.profileId },
    rewards: {
      points: createPointsLedger(saving.profiles, saving.profileId),
      stars: createStars(saving.profiles, saving.profileId),
      strength: character.strength,
    },
    help,
  });
  let busy = false;
  let lastBoardEvent: BoardChanged | undefined;
  let lastSaid = '';
  let stopped = false;
  /** What the game earned, shown on the result card. */
  let earned = 0;
  let newStar = false;
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
  // Shown in Redo's place only while a Blunder Warning waits: carry on with the move as played.
  const keepButton = controlButton('👍', 'Keep it', () => void send(() => session.keep()));
  keepButton.classList.add('keep-button');
  keepButton.hidden = true;
  undoButton.disabled = redoButton.disabled = true;
  el.controls.replaceChildren(undoButton, redoButton, keepButton);
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
    // Keep it or Undo answers a Blunder Warning.
    showWarning(undefined);
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
        case 'blunder-warning':
          showWarning(event);
          break;
        case 'sound':
          audio.sound.play(event.sound);
          break;
        case 'say':
          lastSaid = event.text;
          audio.speaker.say(event.text);
          el.message.replaceChildren(spokenMessage(event.text, audio.speaker));
          break;
        case 'points-awarded':
          earned = event.amount;
          showStarJar(el.starJar, event.total);
          el.starJar.classList.remove('just-filled');
          void el.starJar.offsetWidth; // Restarts the little bounce.
          el.starJar.classList.add('just-filled');
          break;
        case 'star-earned':
          newStar = event.first;
          break;
        case 'game-over':
          showResult(event.result);
          break;
        // A Missed-Chance Alert is only spoken (by the `say` that follows): nothing on the board gives it away.
        case 'missed-chance':
        case 'move-rejected':
          break;
      }
    }
  }

  /**
   * A Blunder Warning (its reason is spoken and shown by the `say` that follows): a red arrow shows
   * the danger on the board, which stays in view, and Keep it stands beside Undo. Undefined clears it.
   */
  function showWarning(warning: BlunderWarning | undefined): void {
    cg.setAutoShapes(warning ? [{ orig: warning.threat[0] as Key, dest: warning.threat[1] as Key, brush: 'red' }] : []);
    keepButton.hidden = !warning;
    redoButton.hidden = Boolean(warning);
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

  /**
   * The Session has already said how the game ended (just before this event); the card shows those
   * words, what was earned, and Rematch / Pick someone else, chosen with the Go Button. A win is a
   * celebration; losing shows the Opponent's happy dance; a draw is a friendly high five.
   */
  function showResult(result: GameResult): void {
    showCard(spokenMessage(lastSaid, audio.speaker), (body) => {
      body.classList.add('result-card', `result-${result}`);
      const opponentPicture = OPPONENT_PICTURES[character.id] ?? PLAY_SVG;
      const picture = svgPicture(result === 'drawn' ? DRAW_SVG : opponentPicture);
      picture.classList.add('result-picture', result === 'lost' ? 'happy-dance' : result === 'won' ? 'beaten' : 'friendly');
      const scene = document.createElement('div');
      scene.className = 'result-scene';
      scene.append(picture);
      if (result === 'won') scene.append(confetti());

      const prize = document.createElement('p');
      prize.className = 'result-prize';
      prize.textContent = `+${earned} Points` + (newStar ? ' ⭐ New star!' : '');

      const items = [
        { id: 'rematch', name: 'Rematch', picture: opponentPicture, onGo: next.playAgain },
        { id: 'pick-someone-else', name: 'Pick someone else', picture: PICK_SOMEONE_ELSE_SVG, onGo: next.pickSomeoneElse },
      ];
      const menu = createMenuChoice(items, audio.speaker);
      const choices = document.createElement('div');
      choices.className = 'result-choices';
      const buttons = items.map((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'menu-choice result-choice';
        button.setAttribute('aria-label', item.name);
        button.setAttribute('aria-pressed', 'false');
        button.append(svgPicture(item.picture));
        button.addEventListener('click', () => {
          menu.tap(item.id);
          for (const b of buttons) b.setAttribute('aria-pressed', String(b === button));
          el.go.classList.add('ready');
        });
        return button;
      });
      choices.append(...buttons);
      body.append(scene, prize, choices);

      // The Go Button sits in its usual place, above the card.
      el.overlay.classList.add('with-go');
      el.go.classList.add('over-card');
      el.go.hidden = false;
      el.go.onclick = () => menu.go()?.onGo();
    });
  }

  function showCard(title: string | HTMLElement, fill: (body: HTMLElement) => void): void {
    hideGo();
    const box = document.createElement('div');
    box.className = 'card';
    const heading = document.createElement('h2');
    heading.append(title);
    box.append(heading);
    fill(box);
    el.overlay.replaceChildren(box);
    el.overlay.hidden = false;
  }

  function hideGo(): void {
    el.overlay.classList.remove('with-go');
    el.go.classList.remove('over-card', 'ready');
    el.go.hidden = true;
    el.go.onclick = null;
  }

  void session.start().then(render);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      el.overlay.hidden = true;
      hideGo();
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

function svgPicture(svg: string): HTMLElement {
  const picture = document.createElement('span');
  picture.className = 'picture';
  picture.innerHTML = svg; // Our own constant art, never user text.
  return picture;
}

/** A burst of falling paper bits for a win. Decoration only. */
function confetti(): HTMLElement {
  const box = document.createElement('div');
  box.className = 'confetti';
  box.setAttribute('aria-hidden', 'true');
  const colours = ['#e3423b', '#f5a623', '#56b870', '#4a90d9', '#f08aa4'];
  for (let i = 0; i < 18; i++) {
    const bit = document.createElement('span');
    bit.style.left = `${(i * 37) % 100}%`;
    bit.style.background = colours[i % colours.length];
    bit.style.animationDelay = `${(i % 6) * 120}ms`;
    box.append(bit);
  }
  return box;
}
