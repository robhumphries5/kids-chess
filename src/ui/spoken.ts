import type { Speaker } from './speech';

/** A message that was spoken, shown with a 🔊 button to hear it again. */
export function spokenMessage(text: string, speaker: Speaker): HTMLElement {
  const line = document.createElement('span');
  line.className = 'spoken';
  const words = document.createElement('span');
  words.textContent = text;
  const replay = document.createElement('button');
  replay.className = 'replay-button';
  replay.textContent = '🔊';
  replay.setAttribute('aria-label', 'Hear it again');
  replay.addEventListener('click', () => speaker.say(text));
  line.append(words, replay);
  return line;
}
