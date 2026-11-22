import { stickerUnlockedLine, type StickerBook, type StickerUnlocked } from '../core/stickers';
import type { GameAudio } from './game-screen';
import { LOCKED_STICKER_SVG, stickerSvg } from './sticker-art';
import type { Speaker } from './speech';
import { spokenMessage } from './spoken';

const LOCKED_LINE = 'Keep collecting stars to get this one!';

function openLine(count: number): string {
  if (count === 0) return 'Your Sticker Book! Collect stars to get your first sticker.';
  return `Your Sticker Book! You have ${count} ${count === 1 ? 'sticker' : 'stickers'}.`;
}

/**
 * The Sticker Book: every sticker in unlock order. Unlocked ones show their picture and say their name
 * when tapped; locked ones are soft dashed spots still to come.
 */
export function showStickerBook(el: HTMLElement, book: StickerBook, speaker: Speaker): void {
  const pages = book.pages();
  const count = pages.filter((p) => p.unlocked).length;
  const message = document.createElement('p');
  message.className = 'message sticker-book-message';
  message.setAttribute('aria-live', 'polite');
  const say = (text: string) => {
    speaker.say(text);
    message.replaceChildren(spokenMessage(text, speaker));
  };

  const grid = document.createElement('div');
  grid.className = 'sticker-grid';
  for (const { sticker, unlocked } of pages) {
    const spot = document.createElement('button');
    spot.type = 'button';
    spot.className = unlocked ? 'sticker' : 'sticker locked';
    spot.setAttribute('aria-label', unlocked ? sticker.name : 'Still to come');
    spot.innerHTML = unlocked ? stickerSvg(sticker.id) : LOCKED_STICKER_SVG; // Our own constant art.
    spot.addEventListener('click', () => {
      say(unlocked ? sticker.name : LOCKED_LINE);
      if (!unlocked) return;
      spot.classList.remove('wiggle');
      void spot.offsetWidth; // Restarts the wiggle.
      spot.classList.add('wiggle');
    });
    grid.append(spot);
  }
  el.replaceChildren(grid, message);
  say(openLine(count));
}

/**
 * A celebration card for newly unlocked stickers, with a cheer and a spoken line. Tapping the big
 * button closes it and calls `onDone`. Does nothing (and calls `onDone` at once) when there are none.
 */
export function celebrateStickers(
  overlay: HTMLElement,
  unlocked: readonly StickerUnlocked[],
  audio: GameAudio,
  onDone: () => void = () => {},
): void {
  if (unlocked.length === 0) return onDone();
  const stickers = unlocked.map((u) => u.sticker);
  const line = stickerUnlockedLine(stickers);
  audio.sound.play('win');
  audio.speaker.say(line);

  const card = document.createElement('div');
  card.className = 'card sticker-celebration';
  const row = document.createElement('div');
  row.className = 'sticker-celebration-row';
  for (const s of stickers) {
    const picture = document.createElement('span');
    picture.className = 'sticker new';
    picture.innerHTML = stickerSvg(s.id); // Our own constant art.
    row.append(picture);
  }
  const heading = document.createElement('h2');
  heading.append(spokenMessage(line, audio.speaker));
  const yay = document.createElement('button');
  yay.type = 'button';
  yay.className = 'big-button';
  yay.textContent = 'Yay! ▶';
  yay.setAttribute('aria-label', 'Yay!');
  yay.addEventListener('click', () => {
    overlay.hidden = true;
    overlay.replaceChildren();
    onDone();
  });
  card.append(row, heading, yay);
  overlay.replaceChildren(card);
  overlay.hidden = false;
}
