import { describe, it, expect } from 'vitest';
import { DECKS, getDeck, wordsFor, wordId } from '../source/vocab.js';

const everyWord = DECKS.flatMap((deck) => deck.words);

describe('decks', () => {
  it('exposes every word under "todos"', () => {
    expect(wordsFor('todos')).toHaveLength(everyWord.length);
    expect(wordsFor('animales')).toHaveLength(15);
    expect(wordsFor('nope')).toEqual([]);
    expect(getDeck('nope')).toBeNull();
  });

  it('gives each deck an id, a name and enough words for four choices', () => {
    const ids = new Set();
    for (const deck of DECKS) {
      expect(deck.name).toBeTruthy();
      expect(ids.has(deck.id)).toBe(false);
      ids.add(deck.id);
      expect(deck.words.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('keeps Spanish word ids unique so progress never collides', () => {
    const ids = everyWord.map(wordId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has both sides filled in and trimmed', () => {
    for (const word of everyWord) {
      expect(word.es.trim()).toBe(word.es);
      expect(word.en.trim()).toBe(word.en);
      expect(word.es.length).toBeGreaterThan(1);
      expect(word.en.length).toBeGreaterThan(1);
    }
  });
});
