// Speak: read aloud with the device's own voice, preferring British English. Adapted from word-bots.

/** Slightly slow, for young listeners. */
const RATE = 0.9;

export interface Speaker {
  /** Say `text`, cutting off anything still being spoken. Silent when the browser has no voice. */
  say(text: string): void;
}

/** Defaults to the browser's speechSynthesis; both are absent in some browsers (and in tests). */
export function createSpeaker(
  synth: SpeechSynthesis | undefined = globalThis.speechSynthesis,
  Utterance: typeof SpeechSynthesisUtterance | undefined = globalThis.SpeechSynthesisUtterance,
): Speaker {
  if (!synth || !Utterance) return { say() {} };

  let voice: SpeechSynthesisVoice | null = null;
  function pickVoice(): void {
    const voices = synth!.getVoices();
    const lang = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-');
    voice =
      voices.find((v) => lang(v) === 'en-GB') ??
      voices.find((v) => lang(v).startsWith('en-GB')) ??
      voices.find((v) => lang(v).startsWith('en')) ??
      null;
  }
  pickVoice();
  // Voices often load after the page does.
  synth.addEventListener?.('voiceschanged', pickVoice);

  return {
    say(text) {
      synth.cancel();
      const u = new Utterance(text);
      u.lang = 'en-GB';
      if (voice) u.voice = voice;
      u.rate = RATE;
      synth.speak(u);
    },
  };
}

/** A Speaker that is silent while `isOn` says no: the per-Profile voice switch. */
export function voiceSwitched(speaker: Speaker, isOn: () => boolean): Speaker {
  return {
    say(text) {
      if (isOn()) speaker.say(text);
    },
  };
}
