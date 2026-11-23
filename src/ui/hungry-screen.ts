import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import type { HungryPiece, Square } from '../core/hungry-pieces';
import { createHungrySession, type HungryBoard, type HungrySessionEvent } from '../core/hungry-session';
import { createPointsLedger } from '../core/points';
import type { ProfileStore } from '../core/profiles';
import type { Game, GameAudio } from './game-screen';
import { APPLE_SHAPES } from './pictures';
import { spokenMessage } from './spoken';
import { showStarJar } from './star-jar';

/** Pause after the last apple, so the cheer is heard before the next level appears. */
const NEXT_LEVEL_DELAY_MS = 2600;

/** The apple drawn a little smaller than its square, centred. */
const APPLE_ON_SQUARE = `<g transform="translate(6 6) scale(0.88)">${APPLE_SHAPES}</g>`;

/** FEN piece letters, for a board with just the hungry piece on it. */
const FEN_LETTER: Record<HungryPiece, string> = { knight: 'N', rook: 'R', bishop: 'B', queen: 'Q', king: 'K' };

interface Elements {
  board: HTMLElement;
  message: HTMLElement;
  starJar: HTMLElement;
}

/** Thin UI: Hungry Pieces, level after level, for one Profile. Renders Session events and forwards moves. */
export function startHungryPieces(
  el: Elements,
  audio: GameAudio,
  store: ProfileStore,
  profileId: string,
  piece: HungryPiece,
): Game {
  const points = createPointsLedger(store, profileId);
  const session = createHungrySession({ piece, points });
  let busy = false;
  let stopped = false;
  let firstLevel = true;
  el.message.replaceChildren();
  showStarJar(el.starJar, points.total());

  const cg: Api = Chessground(el.board, {
    orientation: 'white',
    movable: { free: false, showDests: true, color: undefined },
    premovable: { enabled: false },
    draggable: { enabled: true, showGhost: true },
    animation: { enabled: true, duration: 250 },
    events: { move: (_from, to) => void sendMove(to) },
  });

  async function sendMove(to: string): Promise<void> {
    if (busy) return;
    busy = true;
    cg.set({ movable: { color: undefined } });
    el.message.replaceChildren();
    try {
      await render(session.move(to));
    } finally {
      busy = false;
    }
  }

  async function render(events: HungrySessionEvent[]): Promise<void> {
    for (const event of events) {
      if (stopped) return;
      switch (event.type) {
        case 'level-started':
          if (!firstLevel) await wait(NEXT_LEVEL_DELAY_MS);
          if (stopped) return;
          firstLevel = false;
          el.message.replaceChildren();
          break;
        case 'hungry-board':
          showBoard(event);
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
        case 'apple-eaten':
        case 'level-finished':
        case 'move-rejected':
          break;
      }
    }
  }

  function showBoard(board: HungryBoard): void {
    const apples: DrawShape[] = board.apples.map((square) => ({
      orig: square as Key,
      customSvg: { html: APPLE_ON_SQUARE },
    }));
    cg.set({
      fen: onlyPiece(board.piece, board.square),
      turnColor: 'white',
      lastMove: board.lastMove as Key[] | undefined,
      movable: {
        color: board.apples.length > 0 ? 'white' : undefined,
        dests: new Map([[board.square as Key, board.dests as Key[]]]),
      },
      drawable: { autoShapes: apples },
    });
  }

  void render(session.start());

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      el.message.replaceChildren();
      cg.destroy();
    },
  };
}

/** A board FEN (placement only) with just `piece` on `square`. */
function onlyPiece(piece: HungryPiece, square: Square): string {
  const file = 'abcdefgh'.indexOf(square[0]);
  const rank = Number(square[1]);
  const rows: string[] = [];
  for (let r = 8; r >= 1; r--) {
    if (r !== rank) rows.push('8');
    else rows.push(`${file || ''}${FEN_LETTER[piece]}${7 - file || ''}`);
  }
  return rows.join('/');
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
