import type { Opponent } from '../opponents/opponent';

/** Quicker answers than this show no "thinking", so instant Opponents don't make it flash. */
const THINKING_DELAY_MS = 300;

export interface ThinkingDisplay {
  start(): void;
  stop(): void;
}

/** The same Opponent, but `display` shows that it is thinking while it takes a while to pick a move. */
export function showThinking(opponent: Opponent, display: ThinkingDisplay): Opponent {
  return {
    ...opponent,
    async pickMove(fen) {
      let shown = false;
      const timer = setTimeout(() => {
        shown = true;
        display.start();
      }, THINKING_DELAY_MS);
      try {
        return await opponent.pickMove(fen);
      } finally {
        clearTimeout(timer);
        if (shown) display.stop();
      }
    },
  };
}

/** Shows "{name} is thinking…" in the game's message area, and clears it again if still showing. */
export function thinkingInMessage(message: HTMLElement, name: string): ThinkingDisplay {
  const note = document.createElement('p');
  note.className = 'thinking';
  note.setAttribute('role', 'status');
  note.append(`${name} is thinking`);
  const dots = document.createElement('span');
  dots.className = 'thinking-dots';
  dots.setAttribute('aria-hidden', 'true');
  dots.textContent = '…';
  note.append(dots);
  return {
    start: () => message.replaceChildren(note),
    stop: () => note.remove(),
  };
}
