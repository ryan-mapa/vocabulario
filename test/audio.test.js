import { describe, it, expect } from 'vitest';
import { audioSlug, clipUrl, nextVoice, canPlay, VOICE_COUNT } from '../source/audio.js';

describe('audioSlug', () => {
  it('strips accents and spaces into something safe for a filename', () => {
    expect(audioSlug('la manzana')).toBe('la-manzana');
    expect(audioSlug('el murciélago')).toBe('el-murcielago');
    expect(audioSlug('la vergüenza')).toBe('la-verguenza');
    expect(audioSlug('el año')).toBe('el-ano');
  });

  it('leaves no leading or trailing separator', () => {
    expect(audioSlug('¿qué?')).toBe('que');
    expect(audioSlug('  hola  ')).toBe('hola');
  });

  it('is stable — the same word always names the same file', () => {
    expect(audioSlug('el pingüino')).toBe(audioSlug('el pingüino'));
  });
});

describe('clipUrl', () => {
  it('addresses a voice and a word', () => {
    expect(clipUrl('la manzana', 0)).toBe('audio/1/la-manzana.mp3');
    expect(clipUrl('el murciélago', 3)).toBe('audio/4/el-murcielago.mp3');
  });
});

describe('nextVoice', () => {
  it('starts at the first voice', () => {
    expect(nextVoice(null)).toBe(0);
    expect(nextVoice(undefined)).toBe(0);
  });

  // The point of four voices: tapping again is a different reading, not a repeat.
  it('never gives the same voice twice in a row', () => {
    let voice = null;
    for (let i = 0; i < 20; i++) {
      const next = nextVoice(voice);
      expect(next).not.toBe(voice);
      voice = next;
    }
  });

  it('cycles through every voice before repeating one', () => {
    const seen = [];
    let voice = null;
    for (let i = 0; i < VOICE_COUNT; i++) {
      voice = nextVoice(voice);
      seen.push(voice);
    }
    expect(new Set(seen).size).toBe(VOICE_COUNT);
    expect(nextVoice(voice)).toBe(seen[0]);
  });

  it('copes with a single voice, or none', () => {
    expect(nextVoice(0, 1)).toBe(0);
    expect(nextVoice(null, 1)).toBe(0);
  });
});

// The bug this prevents: in the recall direction the Spanish is the answer, so
// speaking it before the learner has answered simply tells them.
describe('when the Spanish may be spoken', () => {
  it('allows it straight away when the prompt is already Spanish', () => {
    expect(canPlay('es-en', false)).toBe(true);
    expect(canPlay('es-en', true)).toBe(true);
  });

  it('withholds it in the recall direction until the answer is in', () => {
    expect(canPlay('en-es', false)).toBe(false);
    expect(canPlay('en-es', true)).toBe(true);
  });
});
