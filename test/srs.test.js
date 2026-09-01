import { describe, it, expect } from 'vitest';
import {
  newCard,
  foldReviews,
  review,
  isMastered,
  isDue,
  masteryOf,
  selectNext,
  BOX_COUNT,
  intervalFor
} from '../source/srs.js';

const fixedRandom = () => 0;
const NOW = 1_700_000_000_000; // a fixed instant, so nothing depends on the wall clock

describe('review', () => {
  it('promotes one box on a correct answer and schedules it further out', () => {
    const card = review(newCard(), true, NOW);
    expect(card.box).toBe(1);
    expect(card.dueAt).toBe(NOW + intervalFor(1));
    expect(card.lastSeenAt).toBe(NOW);
    expect(card.correct).toBe(1);
  });

  it('drops a well-known word back to box 0 when missed', () => {
    let card = newCard();
    for (let i = 0; i < 4; i++) card = review(card, true, NOW + i);
    expect(card.box).toBe(BOX_COUNT - 1);

    const missed = review(card, false, NOW + 10);
    expect(missed.box).toBe(0);
    expect(missed.dueAt).toBe(NOW + 10 + intervalFor(0));
    expect(missed.seen).toBe(5);
    expect(missed.correct).toBe(4);
  });

  it('caps at the top box', () => {
    let card = newCard();
    for (let i = 0; i < 20; i++) card = review(card, true, NOW + i);
    expect(card.box).toBe(BOX_COUNT - 1);
    expect(isMastered(card)).toBe(true);
  });

  // The whole point of the timestamps: each box waits longer than the last.
  it('spaces each box further out than the one below it', () => {
    const gaps = Array.from({ length: BOX_COUNT }, (_, box) => intervalFor(box));
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b));
    expect(new Set(gaps).size).toBe(BOX_COUNT);
  });
});

describe('masteryOf', () => {
  it('is 0 for fresh cards and 1 once everything is topped out', () => {
    expect(masteryOf([newCard(), newCard()])).toBe(0);
    const top = { ...newCard(), box: BOX_COUNT - 1 };
    expect(masteryOf([top, top])).toBe(1);
    expect(masteryOf([])).toBe(0);
  });
});

describe('selectNext', () => {
  const words = [{ es: 'uno', en: 'one' }, { es: 'dos', en: 'two' }, { es: 'tres', en: 'three' }];
  const at = (box, dueAt) => ({ ...newCard(), box, dueAt });

  it('prefers the word that is furthest past due', () => {
    const cards = {
      uno: at(3, NOW),
      dos: at(3, NOW),
      tres: at(3, NOW - 10 * intervalFor(3))
    };
    expect(selectNext(words, cards, NOW, { random: fixedRandom }).es).toBe('tres');
  });

  it('breaks ties toward the less-known word', () => {
    const cards = { uno: at(4, 0), dos: at(1, 0), tres: at(4, 0) };
    expect(selectNext(words, cards, NOW, { random: fixedRandom }).es).toBe('dos');
  });

  it('leaves a word alone until it comes due', () => {
    const cards = {
      uno: at(1, NOW + intervalFor(1)), // answered a moment ago, not due
      dos: at(4, NOW - 1),
      tres: at(4, NOW + intervalFor(4))
    };
    expect(isDue(cards.uno, NOW)).toBe(false);
    // dos is the only due word, so it wins despite sitting in the top box
    expect(selectNext(words, cards, NOW, { random: fixedRandom }).es).toBe('dos');
  });

  it('still deals a word when nothing is due, rather than turning the player away', () => {
    const cards = {
      uno: at(2, NOW + 5 * intervalFor(2)),
      dos: at(2, NOW + intervalFor(2)), // the soonest to come up
      tres: at(2, NOW + 9 * intervalFor(2))
    };
    expect(selectNext(words, cards, NOW, { random: fixedRandom }).es).toBe('dos');
  });

  it('never repeats the word it was told to avoid', () => {
    const cards = { uno: at(0, NOW - 10 * intervalFor(0)) };
    const picked = selectNext(words, cards, NOW, { avoid: 'uno', random: fixedRandom });
    expect(picked.es).not.toBe('uno');
  });

  it('falls back to the avoided word when it is the only one left', () => {
    expect(selectNext([words[0]], {}, NOW, { avoid: 'uno', random: fixedRandom }).es).toBe('uno');
  });

  it('returns null for an empty word list', () => {
    expect(selectNext([], {}, NOW, { random: fixedRandom })).toBeNull();
  });
});

// The fold is what makes two devices agree. Everything here is really one
// property stated from different angles: the same set of reviews must produce
// the same card, no matter how or when they arrived.
describe('foldReviews', () => {
  const at = (id, correct, reviewedAt) => ({ id, correct, reviewedAt });

  it('replays a history into the card it implies', () => {
    const card = foldReviews([
      at('a', 1, NOW),
      at('b', 1, NOW + 1000),
      at('c', 0, NOW + 2000)
    ]);
    expect(card).toEqual({
      box: 0, // the miss knocks it back regardless of the two before it
      dueAt: NOW + 2000 + intervalFor(0),
      seen: 3,
      correct: 2,
      lastSeenAt: NOW + 2000
    });
  });

  it('gives the same card whatever order the reviews arrive in', () => {
    const history = [at('a', 1, NOW), at('b', 0, NOW + 500), at('c', 1, NOW + 900)];
    const orders = [
      history,
      [...history].reverse(),
      [history[1], history[2], history[0]],
      [history[2], history[0], history[1]]
    ];
    const folded = orders.map((order) => JSON.stringify(foldReviews(order)));
    expect(new Set(folded).size).toBe(1);
  });

  // Two devices can answer inside the same millisecond. Without the id
  // tiebreak they would sort those two differently and disagree forever.
  it('breaks a tied timestamp the same way every time', () => {
    const tied = [at('zzz', 0, NOW), at('aaa', 1, NOW)];
    expect(foldReviews(tied)).toEqual(foldReviews([...tied].reverse()));
    // 'aaa' sorts first, so the miss is what the card ends on
    expect(foldReviews(tied).box).toBe(0);
  });

  it('starts from an imported snapshot when there is one', () => {
    const seed = { ...newCard(), box: 3, seen: 12, correct: 9 };
    const card = foldReviews([at('a', 1, NOW)], seed);
    expect(card.box).toBe(4);
    expect(card.seen).toBe(13);
    expect(card.correct).toBe(10);
  });

  it('is just the seed when no reviews have happened yet', () => {
    const seed = { ...newCard(), box: 2, seen: 5, correct: 4 };
    expect(foldReviews([], seed)).toEqual(seed);
    expect(foldReviews([])).toEqual(newCard());
  });

  it('does not mutate what it is given', () => {
    const history = [at('b', 1, NOW + 1), at('a', 1, NOW)];
    const copy = JSON.parse(JSON.stringify(history));
    foldReviews(history);
    expect(history).toEqual(copy);
  });
});
