import { describe, it, expect } from 'vitest';
import { exampleLines, exampleFor, hasExample, promptSide } from '../source/examples.js';

const pair = { es: '¿Nos trae la cuenta, por favor?', en: 'Could we get the bill, please?' };
const langs = (...args) => exampleLines(...args).map((line) => line.lang);

describe('reading a pair out of the data', () => {
  const sentences = { 'la cuenta': [pair.es, pair.en] };

  it('finds the pair written for a word', () => {
    expect(exampleFor(sentences, 'la cuenta')).toEqual(pair);
  });

  it('returns nothing for a word nobody wrote one for', () => {
    expect(exampleFor(sentences, 'el ferrocarril')).toBeNull();
  });

  // A half-written entry should cost that word its button, not throw during a round.
  it('refuses a malformed entry rather than showing half of one', () => {
    expect(exampleFor({ w: ['solo español'] }, 'w')).toBeNull();
    expect(exampleFor({ w: ['', 'english'] }, 'w')).toBeNull();
    expect(exampleFor({ w: 'not an array' }, 'w')).toBeNull();
    expect(exampleFor(null, 'w')).toBeNull();
  });
});

// The bug this exists to prevent: in the recall direction the Spanish *is* the
// answer, so a Spanish sentence containing it simply tells them. The mirror
// case is subtler — with a Spanish prompt, the English translation of the
// sentence hands over the English word being asked for.
describe('what may be shown before the answer', () => {
  it('shows only the English sentence when the prompt is English', () => {
    expect(langs(pair, 'en-es', false)).toEqual(['en']);
  });

  it('shows only the Spanish sentence when the prompt is Spanish', () => {
    expect(langs(pair, 'es-en', false)).toEqual(['es']);
  });

  it('never shows the answer side in either direction', () => {
    expect(langs(pair, 'en-es', false)).not.toContain('es');
    expect(langs(pair, 'es-en', false)).not.toContain('en');
  });
});

describe('what may be shown after it', () => {
  it('shows both, because there is nothing left to give away', () => {
    expect(langs(pair, 'en-es', true)).toEqual(['es', 'en']);
    expect(langs(pair, 'es-en', true)).toEqual(['es', 'en']);
  });

  it('always puts the Spanish first, whichever way round the question was', () => {
    expect(exampleLines(pair, 'en-es', true)[0].text).toBe(pair.es);
    expect(exampleLines(pair, 'es-en', true)[0].text).toBe(pair.es);
  });
});

describe('a word with no sentence', () => {
  it('offers nothing to reveal, answered or not', () => {
    expect(exampleLines(null, 'es-en', false)).toEqual([]);
    expect(exampleLines(null, 'es-en', true)).toEqual([]);
  });

  it('is reported as having no example, so no button is drawn', () => {
    expect(hasExample({ 'la cuenta': [pair.es, pair.en] }, { es: 'la cuenta' }, 'es-en')).toBe(true);
    expect(hasExample({}, { es: 'la cuenta' }, 'es-en')).toBe(false);
    expect(hasExample({}, undefined, 'es-en')).toBe(false);
  });
});

describe('prompt side', () => {
  it('follows the question, not the round setting', () => {
    expect(promptSide('en-es')).toBe('en');
    expect(promptSide('es-en')).toBe('es');
  });

  it('treats anything it does not recognise as Spanish-prompted', () => {
    expect(promptSide(undefined)).toBe('es');
  });
});
