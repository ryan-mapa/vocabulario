import { describe, it, expect } from 'vitest';
import { SENTENCES } from '../source/sentences.js';
import { DECKS } from '../source/vocab.js';
import { exampleFor } from '../source/examples.js';

const words = DECKS.flatMap((deck) => deck.stages.flat());
const headwords = new Set(words.map((word) => word.es));
const entries = Object.entries(SENTENCES);

/** Lowercase, accents stripped — for comparing a word against an inflected form. */
const flatten = (text) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** The headword without its article: 'la manzana' -> 'manzana'. */
const bare = (es) => es.replace(/^(el|la|los|las) /, '');

/**
 * Does the sentence use the word? Matched on a four-letter stem at a word
 * boundary, because Spanish inflects: 'el frijol' appears as 'frijoles',
 * 'la nuez' as 'nueces'. Loose enough for grammar, tight enough to catch a
 * sentence filed under the wrong word.
 */
function uses(sentence, es) {
  const word = flatten(bare(es));
  const stem = word.length <= 4 ? word.slice(0, 3) : word.slice(0, 4);
  return new RegExp(`(^|[^\\p{L}])${stem}`, 'u').test(flatten(sentence));
}

describe('the sentence data', () => {
  it('is keyed on words that actually exist', () => {
    const unknown = entries.map(([es]) => es).filter((es) => !headwords.has(es));
    expect(unknown).toEqual([]);
  });

  it('never repeats a key', () => {
    // Object literals silently keep the last of a duplicated key, so the count
    // dropping below the source lines is the only way this shows up.
    expect(new Set(entries.map(([es]) => es)).size).toBe(entries.length);
  });

  it('writes both halves of every pair', () => {
    for (const [es, pair] of entries) {
      expect(exampleFor(SENTENCES, es), es).not.toBeNull();
    }
  });

  it('actually uses the word it illustrates', () => {
    const missing = entries.filter(([es, [spanish]]) => !uses(spanish, es)).map(([es]) => es);
    expect(missing).toEqual([]);
  });

  it('keeps sentences short enough to read at a glance', () => {
    for (const [es, [spanish, english]] of entries) {
      expect(spanish.split(/\s+/).length, `${es} (es)`).toBeLessThanOrEqual(12);
      expect(english.split(/\s+/).length, `${es} (en)`).toBeLessThanOrEqual(14);
    }
  });

  it('writes real sentences, punctuation and all', () => {
    for (const [es, [spanish, english]] of entries) {
      expect(spanish, es).toMatch(/[.!?]$/);
      expect(english, es).toMatch(/[.!?]$/);
      expect(spanish.trim(), es).toBe(spanish);
      expect(english.trim(), es).toBe(english);
    }
  });

  // Spanish opens a question with an inverted mark. Missing it is the single
  // most common way written Spanish gives itself away as non-native.
  it('opens Spanish questions and exclamations with the inverted mark', () => {
    for (const [es, [spanish]] of entries) {
      if (spanish.endsWith('?')) expect(spanish, es).toMatch(/^¿|\s¿/);
      if (spanish.endsWith('!')) expect(spanish, es).toMatch(/^¡|\s¡/);
    }
  });
});

// Reusing a sentence across two words is how a copy-paste slip hides: both
// words look illustrated, but one of them is being taught with a sentence
// written to show off the other.
describe('every sentence is its own', () => {
  it('never repeats a Spanish sentence across two words', () => {
    const seen = new Map();
    for (const [es, [spanish]] of entries) {
      seen.set(spanish, [...(seen.get(spanish) ?? []), es]);
    }
    expect([...seen.values()].filter((words) => words.length > 1)).toEqual([]);
  });

  it('never repeats an English translation either', () => {
    const seen = new Map();
    for (const [es, [, english]] of entries) {
      seen.set(english, [...(seen.get(english) ?? []), es]);
    }
    expect([...seen.values()].filter((words) => words.length > 1)).toEqual([]);
  });
});

describe('coverage', () => {
  it('gives every word in every deck an example', () => {
    const missing = words.filter((word) => !SENTENCES[word.es]).map((word) => word.es);
    expect(missing).toEqual([]);
  });

  // A sentence for a word no deck contains is dead weight that no reviewer will
  // ever see in context, and usually means a headword was renamed.
  it('carries no sentence for a word that is not taught', () => {
    expect(entries.length).toBe(words.length);
  });
});
