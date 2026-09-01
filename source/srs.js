// Leitner-style scheduling on a real clock. Each word sits in a box; higher
// boxes come back less often. A wrong answer knocks the word all the way back
// to box 0.
//
// Intervals are durations, not question counts. Counting questions looked
// right but never worked across sittings: the counter restarted at zero every
// round, so a word scheduled 30 questions out was never actually reached and
// spacing only functioned inside a single round.
//
// The first two intervals are short enough that a new or missed word comes
// back within the same sitting — the "learning steps" — and the rest are the
// real spacing.

export const BOX_COUNT = 5;

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** How long a word in each box waits before it is due again. */
const INTERVALS = [MINUTE, 10 * MINUTE, DAY, 4 * DAY, 14 * DAY];

/**
 * How far past due a card may count as, in multiples of its own interval.
 * Capped because a word untouched for a year is not a thousand times more
 * urgent than one untouched for a day, and without a cap a single long
 * absence would pin the same handful of words to the top of every round.
 */
const MAX_LATENESS = 4;

export function newCard() {
  return { box: 0, dueAt: 0, seen: 0, correct: 0, lastSeenAt: 0 };
}

export function intervalFor(box) {
  return INTERVALS[Math.min(box, INTERVALS.length - 1)];
}

/**
 * Advance a card after an answer.
 * @param {object} card  current card state
 * @param {boolean} wasCorrect
 * @param {number} now  epoch milliseconds the answer happened at
 */
export function review(card, wasCorrect, now) {
  const box = wasCorrect ? Math.min(card.box + 1, BOX_COUNT - 1) : 0;
  return {
    box,
    dueAt: now + intervalFor(box),
    seen: card.seen + 1,
    correct: card.correct + (wasCorrect ? 1 : 0),
    lastSeenAt: now
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
 * Rebuild a card from its whole history, starting from `seed`.
 *
 * This is the function that makes multi-device sync conflict-free, so two
 * properties matter more than anything else here:
 *
 * - It is **deterministic regardless of arrival order**. Reviews are sorted
 *   before folding, so a review that reaches one device late still lands in
 *   the same place. The tiebreak on `id` is not decoration: two devices can
 *   answer in the same millisecond, and without it they would fold the same
 *   history into different cards.
 * - It is **pure**. The server and the browser run this exact code, so neither
 *   can drift from the other about what a history means.
 *
 * `seed` is the starting card — a fresh one normally, or a snapshot imported
 * from a browser that was keeping progress before it had an account.
 */
export function foldReviews(reviews, seed = newCard()) {
  const ordered = [...reviews].sort(
    (a, b) => a.reviewedAt - b.reviewedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  return ordered.reduce((card, entry) => review(card, Boolean(entry.correct), entry.reviewedAt), seed);
}

export function isDue(card, now) {
  return card.dueAt <= now;
}

/**
 * Lateness relative to the card's own interval, so a box-0 word an hour late
 * and a box-4 word a month late compare on the same scale. Negative for a card
 * that is not due yet, and never below -1, since a card is scheduled exactly
 * one interval ahead.
 */
function lateness(card, now) {
  return Math.min((now - card.dueAt) / intervalFor(card.box), MAX_LATENESS);
}

/**
 * Pick the next word to ask. Only due words are in play; when nothing is due
 * the whole list is, so someone keen to keep going is never turned away — they
 * just get the words closest to coming up. `avoid` keeps the same word from
 * appearing twice in a row.
 */
export function selectNext(words, cards, now, { avoid = null, random = Math.random } = {}) {
  const candidates = words.filter((word) => word.es !== avoid);
  const eligible = candidates.length > 0 ? candidates : words;
  if (eligible.length === 0) return null;

  const cardFor = (word) => cards[word.es] ?? newCard();
  const due = eligible.filter((word) => isDue(cardFor(word), now));
  const pool = due.length > 0 ? due : eligible;

  let best = [];
  let bestScore = -Infinity;
  for (const word of pool) {
    const card = cardFor(word);
    // Most overdue first, then the lower boxes; the jitter breaks up rigid
    // cycling through words that would otherwise always tie.
    const score = lateness(card, now) * 2 - card.box + random() * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = [word];
    } else if (score === bestScore) {
      best.push(word);
    }
  }
  return best[Math.floor(random() * best.length)];
}
