import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import { createPointsLedger } from '../core/points';
import type { ProfileStore } from '../core/profiles';
import { createPuzzleSession, type PuzzleSessionEvent } from '../core/puzzle-session';
import { randomThemePuzzle } from '../core/puzzles/themes';
import { createStickerBook } from '../core/stickers';
import type { BoardChanged, Colour } from '../core/session';
import type { MoveChoice } from '../opponents/opponent';
import type { Game, GameAudio } from './game-screen';
import { promotionChoices } from './promotion-picker';
import { showStarJar } from './star-jar';
import { celebrateStickers } from './sticker-book';
import { spokenMessage } from './spoken';

/** Pause after a solve, so the cheer is heard and the capture seen before the next puzzle. */
const NEXT_PUZZLE_DELAY_MS = 1800;
/** Pause after "Watch this!" so the child sees the arrow before the app plays the move. */
const WATCH_THIS_DELAY_MS = 1400;
/** Let chessground finish drawing (and the piece slide back) before wobbling it. */
const WOBBLE_DELAY_MS = 300;

interface Elements {
  board: HTMLElement;
  message: HTMLElement;
  overlay: HTMLElement;
  starJar: HTMLElement;
}

/** Thin UI: an endless stream of puzzles for one Profile. Renders Session events and forwards moves. */
export function startPuzzles(el: Elements, audio: GameAudio, store: ProfileStore, profileId: string): Game {
  const points = createPointsLedger(store, profileId);
  const stickers = createStickerBook(store, profileId);
  const session = createPuzzleSession({ nextPuzzle: () => randomThemePuzzle(Math.random), points });
  let colour: Colour = 'white';
  let busy = false;
  let stopped = false;
  let lastBoardEvent: BoardChanged | undefined;
  let firstPuzzle = true;
  el.message.replaceChildren();
  showStarJar(el.starJar, points.total());

  const cg: Api = Chessground(el.board, {
    movable: { free: false, showDests: true, color: undefined },
    premovable: { enabled: false },
    draggable: { enabled: true, showGhost: true },
    animation: { enabled: true, duration: 250 },
    events: { move: (from, to) => void sendMove({ from, to }) },
  });

  async function sendMove(move: MoveChoice): Promise<void> {
    if (busy) return;
    busy = true;
    cg.set({ movable: { color: undefined } });
    el.message.replaceChildren();
    try {
      await render(await session.move(move));
    } finally {
      busy = false;
    }
  }

  async function render(events: PuzzleSessionEvent[]): Promise<void> {
    for (const event of events) {
      // The child may leave during the pause before the next puzzle.
      if (stopped) return;
      switch (event.type) {
        case 'puzzle-started':
          if (!firstPuzzle) await wait(NEXT_PUZZLE_DELAY_MS);
          if (stopped) return;
          // Once the cheer has been heard, any sticker the Points unlocked is celebrated, and the next
          // puzzle waits until the child has seen it. (Left before now? Home celebrates it instead.)
          await new Promise<void>((done) => celebrateStickers(el.overlay, stickers.takeNew(), audio, done));
          if (stopped) return;
          firstPuzzle = false;
          colour = event.childColour;
          el.message.replaceChildren();
          cg.set({ orientation: colour, drawable: { autoShapes: [] } });
          break;
        case 'hint-step':
          if (event.step === 1) {
            cg.set({ drawable: { autoShapes: [{ orig: event.piece as Key, brush: 'green' }] } });
            const square = event.piece;
            setTimeout(() => wobble(square), WOBBLE_DELAY_MS);
          } else {
            cg.set({ drawable: { autoShapes: [{ orig: event.move.from as Key, dest: event.move.to as Key, brush: 'green' }] } });
            if (event.step === 3) await wait(WATCH_THIS_DELAY_MS);
          }
          break;
        case 'board-changed':
          lastBoardEvent = event;
          cg.set({
            fen: event.fen,
            turnColor: event.turn,
            lastMove: event.lastMove as Key[] | undefined,
            check: event.check,
            movable: {
              color: event.childToMove ? colour : undefined,
              dests: new Map(Object.entries(event.dests)) as Map<Key, Key[]>,
            },
          });
          break;
        case 'say':
          audio.speaker.say(event.text);
          el.message.replaceChildren(spokenMessage(event.text, audio.speaker));
          break;
        case 'sound':
          audio.sound.play(event.sound);
          break;
        case 'points-awarded':
          showStarJar(el.starJar, event.total);
          if (event.amount === 0) break;
          el.starJar.classList.remove('just-filled');
          void el.starJar.offsetWidth; // Restarts the little bounce.
          el.starJar.classList.add('just-filled');
          break;
        case 'promotion-needed':
          showPromotionPicker(event.from, event.to);
          break;
        case 'not-yet':
        case 'move-rejected':
        case 'puzzle-solved':
          break;
      }
    }
  }

  /** Gives the piece on `square` a little wobble, as a clue to move it. */
  function wobble(square: string): void {
    if (stopped) return;
    for (const piece of el.board.querySelectorAll<HTMLElement>('piece')) {
      if ((piece as HTMLElement & { cgKey?: string }).cgKey !== square || piece.classList.contains('ghost')) continue;
      piece.classList.remove('wobble');
      // Chessground places pieces with `transform: translate(...)`, so `rotate` would swing the piece
      // round the board's corner. Putting the origin at the piece's centre makes it shiver in place.
      const at = new DOMMatrix(getComputedStyle(piece).transform);
      piece.style.transformOrigin = `${at.m41 + piece.offsetWidth / 2}px ${at.m42 + piece.offsetHeight / 2}px`;
      void piece.offsetWidth; // Restarts the wobble.
      piece.classList.add('wobble');
      piece.addEventListener(
        'animationend',
        () => {
          piece.classList.remove('wobble');
          piece.style.transformOrigin = '';
        },
        { once: true },
      );
    }
  }

  /** Shown on every promotion; nothing is ever chosen for the child. */
  function showPromotionPicker(from: string, to: string): void {
    const card = document.createElement('div');
    card.className = 'card';
    const heading = document.createElement('h2');
    heading.textContent = 'What should your pawn become?';
    const close = () => {
      el.overlay.hidden = true;
    };
    const body = promotionChoices(
      colour,
      (promotion) => {
        close();
        // Runs after the current sendMove has released `busy`.
        setTimeout(() => void sendMove({ from, to, promotion }));
      },
      () => {
        close();
        // The pawn was only dragged on screen; put the board back as the Session last showed it.
        if (lastBoardEvent) void render([lastBoardEvent]);
      },
    );
    card.append(heading, ...body);
    el.overlay.replaceChildren(card);
    el.overlay.hidden = false;
  }

  void session.start().then(render);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      el.overlay.hidden = true;
      el.message.replaceChildren();
      cg.destroy();
    },
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
