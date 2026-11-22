import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import { createSession, type Colour, type GameOver, type SessionEvent } from '../core/session';
import type { MoveChoice, PromotionPiece } from '../opponents/opponent';
import { createSnail } from '../opponents/snail';

/** Pause before showing the Opponent's reply, so the child sees their own move land. */
const OPPONENT_DELAY_MS = 600;

interface Elements {
  board: HTMLElement;
  status: HTMLElement;
  overlay: HTMLElement;
}

/** Thin UI: renders Session events and forwards the child's moves. No chess rules here. */
export function startGame(el: Elements, childColour: Colour = 'white'): void {
  const opponent = createSnail();
  const session = createSession({ kind: 'opponent-game', opponent, childColour });
  let busy = false;

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
        case 'game-over':
          showResult(event);
          break;
        case 'move-rejected':
          break;
      }
    }
  }

  // A plain stand-in: the full Promotion Picker with big pictures is its own ticket (#3).
  function showPromotionPicker(from: string, to: string): void {
    const symbols: Record<PromotionPiece, string> =
      childColour === 'white'
        ? { q: '♕', r: '♖', b: '♗', n: '♘' }
        : { q: '♛', r: '♜', b: '♝', n: '♞' };
    const names: Record<PromotionPiece, string> = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' };
    showCard('What should your pawn become?', (body) => {
      const choices = document.createElement('div');
      choices.className = 'promotion-choices';
      for (const piece of ['q', 'r', 'b', 'n'] as const) {
        const button = document.createElement('button');
        button.textContent = symbols[piece];
        button.setAttribute('aria-label', names[piece]);
        button.addEventListener('click', () => {
          el.overlay.hidden = true;
          // Runs after the current sendMove has released `busy`.
          setTimeout(() => void sendMove({ from, to, promotion: piece }));
        });
        choices.append(button);
      }
      body.append(choices);
    });
  }

  function showResult(event: GameOver): void {
    const message =
      event.result === 'won'
        ? 'You won! Well done!'
        : event.result === 'lost'
          ? `${opponent.name} won this time! Good game!`
          : 'It’s a draw! Good game!';
    el.status.textContent = message;
    showCard(message, (body) => {
      const again = document.createElement('button');
      again.className = 'big-button';
      again.textContent = 'Play again';
      again.addEventListener('click', () => {
        el.overlay.hidden = true;
        cg.destroy();
        startGame(el, childColour);
      });
      body.append(again);
    });
  }

  function showCard(title: string, fill: (body: HTMLElement) => void): void {
    const box = document.createElement('div');
    box.className = 'card';
    const heading = document.createElement('h2');
    heading.textContent = title;
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
