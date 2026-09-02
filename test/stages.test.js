import { describe, it, expect } from 'vitest';
import { DECKS, ALL_DECK_ID, STAGE_COUNT, stageWords } from '../source/vocab.js';
import { BOX_COUNT } from '../source/srs.js';
import {
  UNLOCK_THRESHOLD,
  isStageUnlocked,
  unlockedDepth,
  stagePool,
  stageProgress,
  deckProgress,
  nextUnlock,
  selectionPool
} from '../source/stages.js';

const TOP_BOX = BOX_COUNT - 1;

/** Cards putting the first `count` words of a deck stage in `box`. */
function cardsAt(deckId, stage, count, box = TOP_BOX) {
  const cards = {};
  for (const word of stageWords(deckId, stage).slice(0, count)) {
    cards[word.es] = { box, due: 0, seen: 1, correct: 1 };
  }
  return cards;
}

describe('stage unlocking', () => {
  it('opens the first stage of every deck with no progress at all', () => {
    for (const deck of DECKS) {
      expect(isStageUnlocked(deck.id, 0, {}), deck.id).toBe(true);
      expect(isStageUnlocked(deck.id, 1, {}), deck.id).toBe(false);
    }
    expect(unlockedDepth('comida', {})).toBe(0);
  });

  it('keeps a later stage shut until the one before it hits the threshold', () => {
    const total = stageWords('comida', 0).length;
    const justUnder = Math.floor(UNLOCK_THRESHOLD * total) - 1;

    expect(isStageUnlocked('comida', 1, cardsAt('comida', 0, justUnder))).toBe(false);
    expect(isStageUnlocked('comida', 1, cardsAt('comida', 0, total))).toBe(true);
  });

  it('unlocks one stage at a time, not the whole deck at once', () => {
    const mastered = cardsAt('comida', 0, stageWords('comida', 0).length);
    expect(unlockedDepth('comida', mastered)).toBe(1);
    expect(isStageUnlocked('comida', 2, mastered)).toBe(false);
  });

  it('reaches full depth once each stage in turn is mastered', () => {
    const cards = {
      ...cardsAt('comida', 0, stageWords('comida', 0).length),
      ...cardsAt('comida', 1, stageWords('comida', 1).length)
    };
    expect(unlockedDepth('comida', cards)).toBe(STAGE_COUNT - 1);
    expect(nextUnlock('comida', cards)).toBeNull();
  });

  it('never reports a stage beyond the last one as unlocked', () => {
    const everything = DECKS.reduce((acc, deck) => {
      for (const [stage] of deck.stages.entries()) {
        Object.assign(acc, cardsAt(deck.id, stage, deck.stages[stage].length));
      }
      return acc;
    }, {});
    expect(isStageUnlocked('comida', STAGE_COUNT, everything)).toBe(false);
  });

  it('progress in one deck does not unlock another', () => {
    const cards = cardsAt('comida', 0, stageWords('comida', 0).length);
    expect(isStageUnlocked('comida', 1, cards)).toBe(true);
    expect(isStageUnlocked('animales', 1, cards)).toBe(false);
  });
});

describe('the combined "all words" deck', () => {
  it('opens a stage as soon as any single deck has it open', () => {
    const cards = cardsAt('comida', 0, stageWords('comida', 0).length);
    expect(isStageUnlocked(ALL_DECK_ID, 1, cards)).toBe(true);
  });

  it('draws only from decks that have the stage open', () => {
    const cards = cardsAt('comida', 0, stageWords('comida', 0).length);
    const pool = stagePool(ALL_DECK_ID, 1, cards);
    expect(pool).toEqual(stageWords('comida', 1));
    // a deck still locked at stage 1 must not leak its words in
    for (const word of stageWords('animales', 1)) {
      expect(pool).not.toContainEqual(word);
    }
  });

  it('pools every deck at stage 0', () => {
    expect(stagePool(ALL_DECK_ID, 0, {})).toEqual(stageWords(ALL_DECK_ID, 0));
  });
});

describe('progress reporting', () => {
  it('reports mastery and mastered count per stage', () => {
    const words = stageWords('comida', 0);
    const cards = cardsAt('comida', 0, words.length);
    const first = stageProgress('comida', 0, cards);

    expect(first.total).toBe(words.length);
    expect(first.mastered).toBe(words.length);
    expect(first.mastery).toBe(1);
    expect(first.unlocked).toBe(true);
  });

  it('describes the gap to the next unlock, and closes it as mastery rises', () => {
    const empty = nextUnlock('comida', {});
    expect(empty.stage).toBe(1);
    expect(empty.remaining).toBeCloseTo(UNLOCK_THRESHOLD);

    const partial = nextUnlock('comida', cardsAt('comida', 0, 5));
    expect(partial.remaining).toBeLessThan(empty.remaining);
  });

  it('covers every stage in a deck report', () => {
    const report = deckProgress('comida', {});
    expect(report).toHaveLength(STAGE_COUNT);
    expect(report.map((s) => s.unlocked)).toEqual([true, false, false]);
  });
});

// Studying Basics and Everyday together, rather than one or the other.
describe('a selection of several stages', () => {
  const open = (deckId) => cardsAt(deckId, 0, stageWords(deckId, 0).length);

  it('is just that stage when only one is chosen', () => {
    const pool = selectionPool('comida', [0], {});
    expect(pool.map((w) => w.es)).toEqual(stageWords('comida', 0).map((w) => w.es));
  });

  it('joins the stages asked for', () => {
    const cards = open('comida');
    const pool = selectionPool('comida', [0, 1], cards);
    expect(pool).toHaveLength(stageWords('comida', 0).length + stageWords('comida', 1).length);
  });

  it('tags each word with the stage it belongs to, not the selection', () => {
    const pool = selectionPool('comida', [0, 1], open('comida'));
    const first = stageWords('comida', 0).map((w) => w.es);
    for (const word of pool) {
      expect(word.stage).toBe(first.includes(word.es) ? 0 : 1);
    }
  });

  it('silently drops a stage that is still locked', () => {
    // Nothing learned yet, so Everyday is shut — asking for it changes nothing.
    const pool = selectionPool('comida', [0, 1], {});
    expect(pool.map((w) => w.es)).toEqual(stageWords('comida', 0).map((w) => w.es));
  });

  it('never offers the same word twice', () => {
    const cards = DECKS.reduce((acc, deck) => Object.assign(acc, open(deck.id)), {});
    const pool = selectionPool(ALL_DECK_ID, [0, 1], cards);
    expect(new Set(pool.map((w) => w.es)).size).toBe(pool.length);
  });

  it('is empty when nothing is selected', () => {
    expect(selectionPool('comida', [], {})).toEqual([]);
  });

  it('does not care what order the stages are given in', () => {
    const cards = open('comida');
    const forwards = selectionPool('comida', [0, 1], cards).map((w) => w.es);
    const backwards = selectionPool('comida', [1, 0], cards).map((w) => w.es);
    expect(backwards).toEqual(forwards);
  });
});
