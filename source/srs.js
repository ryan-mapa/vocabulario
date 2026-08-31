// Leitner-style scheduling. Each word sits in a box; higher boxes come back
// less often. A wrong answer knocks the word all the way back to box 0.

export const BOX_COUNT = 5;

/** How many questions to wait before a word in each box is due again. */
const INTERVALS = [1, 3, 7, 14, 30];

export function newCard() {
  return { box: 0, due: 0, seen: 0, correct: 0 };
}

export function intervalFor(box) {
  return INTERVALS[Math.min(box, INTERVALS.length - 1)];
}

/**
 * Advance a card after an answer.
 * @param {object} card  current card state
 * @param {boolean} wasCorrect
 * @param {number} step  the question counter the answer happened on
 */
export function review(card, wasCorrect, step) {
  const box = wasCorrect ? Math.min(card.box + 1, BOX_COUNT - 1) : 0;
  return {
    box,
    due: step + intervalFor(box),
    seen: card.seen + 1,
    correct: card.correct + (wasCorrect ? 1 : 0)
  };
}

/** A word counts as mastered once it reaches the top box. */
export function isMastered(card) {
  return card.box >= BOX_COUNT - 1;
}

/** 0..1 across a whole deck, weighting each word by how far it has climbed. */
export function masteryOf(cards) {
  if (cards.length === 0) return 0;
  const total = cards.reduce((sum, card) => sum + card.box, 0);
  return total / (cards.length * (BOX_COUNT - 1));
}

/**
 * Pick the next word to ask: the most overdue one, breaking ties toward the
 * least-known word. `avoid` keeps the same word from appearing twice in a row.
 */
export function selectNext(words, cards, step, { avoid = null, random = Math.random } = {}) {
  const candidates = words.filter((word) => word.es !== avoid);
  const pool = candidates.length > 0 ? candidates : words;
  if (pool.length === 0) return null;

  let best = [];
  let bestScore = -Infinity;
  for (const word of pool) {
    const card = cards[word.es] ?? newCard();
    // Overdue first, then lower boxes; the jitter breaks up rigid cycling.
    const score = (step - card.due) * 10 - card.box + random() * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = [word];
    } else if (score === bestScore) {
      best.push(word);
    }
  }
  return best[Math.floor(random() * best.length)];
}
