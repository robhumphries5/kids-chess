import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';
import './board-theme.css';
import './style.css';
import { startGame } from './ui/game-screen';
import { createSound } from './ui/sound';
import { createSpeaker } from './ui/speech';

/** Versioned so a later Settings format can replace it cleanly. */
const MUTED_KEY = 'kids-chess:sound-muted:v1';

const sound = createSound();
sound.setMuted(readMuted());

const muteButton = document.getElementById('mute')!;
function showMute(): void {
  muteButton.textContent = sound.muted ? '🔕' : '🔔';
  muteButton.setAttribute('aria-label', sound.muted ? 'Sounds off' : 'Sounds on');
  muteButton.setAttribute('aria-pressed', String(sound.muted));
}
muteButton.addEventListener('click', () => {
  sound.setMuted(!sound.muted);
  try {
    localStorage.setItem(MUTED_KEY, String(sound.muted));
  } catch {
    // Storage blocked: the switch still works for this visit.
  }
  showMute();
});
showMute();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === 'true';
  } catch {
    return false;
  }
}

startGame(
  {
    board: document.getElementById('board')!,
    status: document.getElementById('status')!,
    message: document.getElementById('message')!,
    overlay: document.getElementById('overlay')!,
  },
  { speaker: createSpeaker(), sound },
);
