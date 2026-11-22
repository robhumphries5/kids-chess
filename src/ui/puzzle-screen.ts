import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import { createPointsLedger } from '../core/points';
import type { ProfileStore } from '../core/profiles';
import { createPuzzleSession, type PuzzleSessionEvent } from '../core/puzzle-session';
import { generateFreePiecePuzzle } from '../core/puzzles/free-piece';
import type { BoardChanged, Colour } from '../core/session';
import type { MoveChoice } from '../opponents/opponent';
import type { Game, GameAudio } from './game-screen';
import { promotionChoices } from './promotion-picker';
import { showStarJar } from './star-jar';
import { spokenMessage } from './spoken';

/** Pause after a solve, so the cheer is heard and the capture seen before the next puzzle. */
const NEXT_PUZZLE_DELAY_MS = 1800;

interface Elements {
  board: HTMLElement;
  message: HTMLElement;
  overlay: HTMLElement;
  starJar: HTMLElement;
}

/** Thin UI: an endless stream of puzzles for one Profile. Renders Session events and forwards moves. */
export function startPuzzles(el: Elements, audio: GameAudio, store: ProfileStore, profileId: string): Game {
  const points = createPointsLedger(store, profileId);
  const session = createPuzzleSession({ nextPuzzle: () => generateFreePiecePuzzle(Math.random), points });
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
          firstPuzzle = false;
          colour = event.childColour;
          el.message.replaceChildren();
          cg.set({ orientation: colour });
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
