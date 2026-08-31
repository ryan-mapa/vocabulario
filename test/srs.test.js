import { describe, it, expect } from 'vitest';
import { newCard, review, isMastered, masteryOf, selectNext, BOX_COUNT, intervalFor } from '../source/srs.js';

const fixedRandom = () => 0;

describe('review', () => {
  it('promotes one box on a correct answer and schedules it further out', () => {
    const card = review(newCard(), true, 0);
    expect(card.box).toBe(1);
    expect(card.due).toBe(intervalFor(1));
    expect(card.correct).toBe(1);
  });

  it('drops a well-known word back to box 0 when missed', () => {
    let card = newCard();
    for (let step = 0; step < 4; step++) card = review(card, true, step);
    expect(card.box).toBe(BOX_COUNT - 1);

    const missed = review(card, false, 10);
    expect(missed.box).toBe(0);
    expect(missed.seen).toBe(5);
    expect(missed.correct).toBe(4);
  });

  it('caps at the top box', () => {
    let card = newCard();
    for (let step = 0; step < 20; step++) card = review(card, true, step);
    expect(card.box).toBe(BOX_COUNT - 1);
    expect(isMastered(card)).toBe(true);
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

  it('prefers the most overdue word', () => {
    const cards = {
      uno: { ...newCard(), box: 3, due: 100 },
      dos: { ...newCard(), box: 3, due: 100 },
      tres: { ...newCard(), box: 3, due: 1 }
    };
    expect(selectNext(words, cards, 50, { random: fixedRandom }).es).toBe('tres');
  });

  it('breaks ties toward the less-known word', () => {
    const cards = {
      uno: { ...newCard(), box: 4, due: 0 },
      dos: { ...newCard(), box: 1, due: 0 },
      tres: { ...newCard(), box: 4, due: 0 }
    };
    expect(selectNext(words, cards, 10, { random: fixedRandom }).es).toBe('dos');
  });

  it('never repeats the word it was told to avoid', () => {
    const cards = { uno: { ...newCard(), due: -100 } };
    const picked = selectNext(words, cards, 0, { avoid: 'uno', random: fixedRandom });
    expect(picked.es).not.toBe('uno');
  });

  it('falls back to the avoided word when it is the only one left', () => {
    expect(selectNext([words[0]], {}, 0, { avoid: 'uno', random: fixedRandom }).es).toBe('uno');
  });

  it('returns null for an empty word list', () => {
    expect(selectNext([], {}, 0, { random: fixedRandom })).toBeNull();
  });
});
