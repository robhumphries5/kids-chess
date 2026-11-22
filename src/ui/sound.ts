// Sound effects made in code with Web Audio: no audio files. Adapted from word-bots.
import type { SoundCue } from '../core/session';

export type SoundName = SoundCue['sound'];

export interface Sound {
  play(name: SoundName): void;
  setMuted(muted: boolean): void;
  readonly muted: boolean;
}

type AudioContextClass = typeof AudioContext;

function browserAudioContext(): AudioContext {
  const Ctor =
    globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: AudioContextClass }).webkitAudioContext;
  if (!Ctor) throw new Error('No Web Audio');
  return new Ctor();
}

/** `makeContext` defaults to the browser's AudioContext; if it throws, every sound is silent. */
export function createSound(makeContext: () => AudioContext = browserAudioContext): Sound {
  let ctx: AudioContext | null = null;
  let unavailable = false;
  let muted = false;

  /** The shared context, made on first use (browsers only allow audio after a tap). */
  function audio(): AudioContext | null {
    if (muted || unavailable) return null;
    try {
      ctx ??= makeContext();
      if (ctx.state === 'suspended') void ctx.resume();
      return ctx;
    } catch {
      unavailable = true;
      return null;
    }
  }

  function tone(type: OscillatorType, from: number, to: number, start: number, dur: number, vol = 0.2): void {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + start;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  const effects: Record<SoundName, () => void> = {
    // A soft wooden "tok".
    move: () => tone('triangle', 520, 300, 0, 0.09, 0.25),
    // A chomp: a quick down-sweep with a buzzy edge.
    capture: () => {
      tone('square', 700, 140, 0, 0.16, 0.1);
      tone('triangle', 220, 90, 0.03, 0.18, 0.3);
    },
    // Two bright "ding-ding" notes.
    check: () => {
      tone('sine', 988, 988, 0, 0.12, 0.2);
      tone('sine', 1319, 1319, 0.14, 0.2, 0.2);
    },
    // A rising fanfare.
    win: () => {
      [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, i * 0.14, i === 3 ? 0.5 : 0.13, 0.1));
    },
  };

  return {
    play: (name) => effects[name](),
    setMuted(m) {
      muted = m;
    },
    get muted() {
      return muted;
    },
  };
}
