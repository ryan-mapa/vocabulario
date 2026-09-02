import { describe, it, expect } from 'vitest';
import { audioSlug } from '../source/audio.js';
import {
  DECKS,
  STAGE_COUNT,
  ALL_DECK_ID,
  getDeck,
  stageWords,
  deckWords,
  wordId
} from '../source/vocab.js';

const everyWord = DECKS.flatMap((deck) => deck.stages.flat());

describe('decks', () => {
  it('gives every deck the full set of stages, each big enough for four choices', () => {
    for (const deck of DECKS) {
      expect(deck.id, 'deck id').toBeTruthy();
      expect(deck.name, `${deck.id} name`).toBeTruthy();
      expect(deck.stages, `${deck.id} stages`).toHaveLength(STAGE_COUNT);
      for (const [index, words] of deck.stages.entries()) {
        expect(words.length, `${deck.id} stage ${index}`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('exposes stage and whole-deck slices, and the combined deck', () => {
    const deck = DECKS[0];
    expect(stageWords(deck.id, 0)).toEqual(deck.stages[0]);
    expect(deckWords(deck.id)).toHaveLength(deck.stages.flat().length);
    expect(deckWords(ALL_DECK_ID)).toHaveLength(everyWord.length);
    // Decks are not all the same size: a topic gets as many words as it
    // deserves, and a closed set like the days of the week has fewer.
    const everyFirstStage = DECKS.reduce((n, d) => n + d.stages[0].length, 0);
    expect(stageWords(ALL_DECK_ID, 0)).toHaveLength(everyFirstStage);
    expect(deckWords('nope')).toEqual([]);
    expect(stageWords('nope', 0)).toEqual([]);
    expect(getDeck('nope')).toBeNull();
  });

  it('keeps Spanish words unique so progress never collides', () => {
    const seen = new Map();
    const clashes = [];
    for (const deck of DECKS) {
      for (const [stage, words] of deck.stages.entries()) {
        for (const word of words) {
          const where = `${deck.id}:S${stage + 1}`;
          if (seen.has(word.es)) clashes.push(`${word.es} (${seen.get(word.es)} + ${where})`);
          else seen.set(word.es, where);
        }
      }
    }
    expect(clashes).toEqual([]);
  });

  // A repeated English string would let one prompt have two right answers in the
  // English -> Spanish direction, and the second one would be scored wrong.
  it('keeps English answers unique so no question has two correct choices', () => {
    const seen = new Map();
    const clashes = [];
    for (const deck of DECKS) {
      for (const [stage, words] of deck.stages.entries()) {
        for (const word of words) {
          const where = `${deck.id}:S${stage + 1}`;
          if (seen.has(word.en)) clashes.push(`${word.en} (${seen.get(word.en)} + ${where})`);
          else seen.set(word.en, where);
        }
      }
    }
    expect(clashes).toEqual([]);
  });

  // Pronunciation files are named after the word with its accents stripped, so
  // two *different* words that differ only by an accent would fight over one
  // filename — 'el año' and 'el ano' are not the same word. Silent if
  // unchecked: one would simply play the other's recording.
  //
  // The same string appearing twice is fine and does happen: 'la llave' is a
  // headword meaning key and a regional variant of 'el grifo' meaning faucet.
  // Two meanings, one pronunciation, one recording.
  it('never lets two different words claim the same audio file', () => {
    const byStem = new Map();
    for (const word of [...everyWord, ...everyWord.flatMap((w) => w.alt ?? [])]) {
      const stem = audioSlug(word.es);
      if (!byStem.has(stem)) byStem.set(stem, new Set());
      byStem.get(stem).add(word.es);
    }
    const clashes = [...byStem]
      .filter(([, spellings]) => spellings.size > 1)
      .map(([stem, spellings]) => `${stem}: ${[...spellings].join(' + ')}`);
    expect(clashes).toEqual([]);
  });

  // A word listed as somewhere else's way of saying something should not also be
  // taught as its own card: the vocabulary is Latin American, so adding
  // `el aparcamiento` beside `el estacionamiento` quietly teaches the Spain
  // form as a separate word. `la llave` is the exception and is allowed by
  // name — it is a genuine second meaning, a key as well as a faucet.
  it('does not teach a regional variant as a word of its own', () => {
    const heads = new Set(everyWord.map((w) => w.es));
    const doubled = everyWord
      .flatMap((w) => (w.alt ?? []).map((a) => a.es))
      .filter((variant) => heads.has(variant) && variant !== 'la llave');
    expect(doubled).toEqual([]);
  });

  it('gives every regional variant a word and a region, and never repeats itself', () => {
    for (const word of everyWord) {
      if (!word.alt) continue;
      expect(word.alt.length, word.es).toBeGreaterThan(0);
      for (const variant of word.alt) {
        expect(variant.es?.trim(), `${word.es} variant`).toBeTruthy();
        expect(variant.region?.trim(), `${word.es} region`).toBeTruthy();
        // listing the headword as its own variant would read as nonsense
        expect(variant.es, `${word.es} lists itself`).not.toBe(word.es);
      }
      // no duplicate variants within one word
      const forms = word.alt.map((v) => v.es);
      expect(new Set(forms).size, `${word.es} repeats a variant`).toBe(forms.length);
    }
  });

  it('has both sides filled in and trimmed', () => {
    for (const word of everyWord) {
      expect(word.es.trim(), word.es).toBe(word.es);
      expect(word.en.trim(), word.en).toBe(word.en);
      expect(word.es.length).toBeGreaterThan(0);
      expect(word.en.length).toBeGreaterThan(0);
      expect(wordId(word)).toBe(word.es);
    }
  });
});
