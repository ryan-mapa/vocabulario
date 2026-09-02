import { describe, it, expect } from 'vitest';
import { audioSlug, clipUrl, nextVoice, canPlay, hasClip, VOICE_COUNT } from '../source/audio.js';

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
// speaking it would simply tell them.
describe('when the Spanish may be spoken', () => {
  it('allows it when the prompt is already Spanish', () => {
    expect(canPlay('es-en')).toBe(true);
  });

  it('never in the recall direction, answered or not', () => {
    expect(canPlay('en-es')).toBe(false);
  });

  it('says no to a direction it does not know', () => {
    expect(canPlay('mixed')).toBe(false);
    expect(canPlay(undefined)).toBe(false);
  });
});

// Recordings arrive a few thousand files at a time. One that fails to generate
// should cost that word its button, not cost every word its button.
describe('hasClip', () => {
  const spoken = new Set(['la-manzana', 'el-murcielago']);

  it('says yes only for words that were recorded', () => {
    expect(hasClip(spoken, 'la manzana')).toBe(true);
    expect(hasClip(spoken, 'el murciélago')).toBe(true);
    expect(hasClip(spoken, 'el ferrocarril')).toBe(false);
  });

  it('says no to everything when there is no audio at all', () => {
    expect(hasClip(new Set(), 'la manzana')).toBe(false);
  });

  it('matches on the filename, so accents do not decide it', () => {
    expect(hasClip(new Set(['el-ano']), 'el año')).toBe(true);
  });
});
