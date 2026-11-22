import { describe, expect, it } from 'vitest';
import { createSpeaker } from './speech';

interface FakeUtterance {
  text: string;
  lang?: string;
  rate?: number;
  voice?: { lang: string; name: string } | null;
}

/** A stand-in for the browser's speechSynthesis that records what happens, in order. */
function fakeSynth(voices: { lang: string; name: string }[]) {
  const log: string[] = [];
  const spoken: FakeUtterance[] = [];
  const listeners: (() => void)[] = [];
  const synth = {
    getVoices: () => voices,
    cancel: () => log.push('cancel'),
    speak: (u: FakeUtterance) => {
      log.push(`speak ${u.text}`);
      spoken.push(u);
    },
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
  };
  const Utterance = class {
    lang?: string;
    rate?: number;
    voice?: { lang: string; name: string } | null;
    constructor(public text: string) {}
  };
  return { synth, Utterance, log, spoken, setVoices: (v: typeof voices) => ((voices = v), listeners.forEach((f) => f())) };
}

describe('Speaker', () => {
  it('speaks in British English at a slightly slow rate, preferring an en-GB voice', () => {
    const fake = fakeSynth([
      { lang: 'en-US', name: 'American' },
      { lang: 'en-GB', name: 'British' },
    ]);
    createSpeaker(fake.synth as never, fake.Utterance as never).say('Check!');
    expect(fake.spoken).toHaveLength(1);
    expect(fake.spoken[0]).toMatchObject({ text: 'Check!', lang: 'en-GB', voice: { name: 'British' } });
    expect(fake.spoken[0].rate).toBeLessThan(1);
    expect(fake.spoken[0].rate).toBeGreaterThan(0.7);
  });

  it('a new message cancels the one being spoken', () => {
    const fake = fakeSynth([{ lang: 'en-GB', name: 'British' }]);
    const speaker = createSpeaker(fake.synth as never, fake.Utterance as never);
    speaker.say('Check!');
    speaker.say('You won! Well done!');
    expect(fake.log).toEqual(['cancel', 'speak Check!', 'cancel', 'speak You won! Well done!']);
  });

  it('picks up an en-GB voice that loads late', () => {
    const fake = fakeSynth([]);
    const speaker = createSpeaker(fake.synth as never, fake.Utterance as never);
    fake.setVoices([{ lang: 'en_GB', name: 'British' }]);
    speaker.say('Check!');
    expect(fake.spoken[0].voice).toMatchObject({ name: 'British' });
  });

  it('is silent, not broken, when speechSynthesis is missing', () => {
    const speaker = createSpeaker(undefined, undefined);
    expect(() => speaker.say('Check!')).not.toThrow();
  });
});
