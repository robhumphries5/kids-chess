import { describe, expect, it } from 'vitest';
import { createSound } from './sound';

/** A stand-in for Web Audio that records each note started: "<wave> <start Hz>". */
function fakeAudio() {
  const notes: string[] = [];
  let created = 0;
  const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect: (next: unknown) => next });
  const make = () => {
    created++;
    return {
      currentTime: 0,
      state: 'running',
      destination: {},
      resume: async () => {},
      createGain: () => ({ ...node(), gain: param() }),
      createOscillator: () => {
        const osc = {
          ...node(),
          type: 'sine',
          frequency: {
            ...param(),
            setValueAtTime: (hz: number) => notes.push(`${osc.type} ${hz}`),
          },
          start() {},
          stop() {},
        };
        return osc;
      },
    };
  };
  return { make: make as never, notes, created: () => created };
}

describe('Sound', () => {
  it('move, capture, check and win each sound different', () => {
    const audio = fakeAudio();
    const sound = createSound(audio.make);
    const heard = (['move', 'capture', 'check', 'win'] as const).map((cue) => {
      audio.notes.length = 0;
      sound.play(cue);
      return audio.notes.join(',');
    });
    expect(heard.every((notes) => notes.length > 0)).toBe(true);
    expect(new Set(heard).size).toBe(4);
  });

  it('mute silences every sound, and unmuting brings them back', () => {
    const audio = fakeAudio();
    const sound = createSound(audio.make);
    sound.setMuted(true);
    expect(sound.muted).toBe(true);
    for (const cue of ['move', 'capture', 'check', 'win'] as const) sound.play(cue);
    expect(audio.notes).toEqual([]);
    sound.setMuted(false);
    sound.play('move');
    expect(audio.notes.length).toBeGreaterThan(0);
  });

  it('is silent, not broken, when Web Audio is missing', () => {
    const sound = createSound(() => {
      throw new ReferenceError('AudioContext is not defined');
    });
    expect(() => sound.play('win')).not.toThrow();
  });

  it('makes only one audio context', () => {
    const audio = fakeAudio();
    const sound = createSound(audio.make);
    sound.play('move');
    sound.play('capture');
    expect(audio.created()).toBe(1);
  });
});
