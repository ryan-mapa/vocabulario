// Stage gating. A deck's three stages unlock in order: you open the next one by
// getting the current one to UNLOCK_THRESHOLD mastery.
//
// Unlock state is *derived* from the existing card map, never stored. That keeps
// the saved shape unchanged, and it means a learner who already knows a deck
// walks in with the deeper stages already open.

import { DECKS, ALL_DECK_ID, STAGE_COUNT, getDeck, stageWords } from './vocab.js';
import { newCard, masteryOf, isMastered } from './srs.js';

/** Mastery of a stage needed to open the next one. */
export const UNLOCK_THRESHOLD = 0.6;

function cardsFor(words, cards) {
  return words.map((word) => cards[word.es] ?? newCard());
}

/** Mastery (0..1) of one stage of one real deck. */
function stageMastery(deckId, stage, cards) {
  return masteryOf(cardsFor(stageWords(deckId, stage), cards));
}

/**
 * Is `stage` (zero-based) open on this deck?
 *
 * For a real deck: stage 0 always, and each later stage once the one before it
 * reaches UNLOCK_THRESHOLD. For the combined "All words" deck: open as soon as
 * any single deck has that stage open, so depth in one category is enough.
 */
export function isStageUnlocked(deckId, stage, cards) {
  if (stage <= 0) return true;
  if (stage >= STAGE_COUNT) return false;
  if (deckId === ALL_DECK_ID) {
    return DECKS.some((deck) => isStageUnlocked(deck.id, stage, cards));
  }
  if (!getDeck(deckId)) return false;
  return stageMastery(deckId, stage - 1, cards) >= UNLOCK_THRESHOLD;
}

/** Highest unlocked stage index, i.e. how deep this deck is open. */
export function unlockedDepth(deckId, cards) {
  let depth = 0;
  while (depth + 1 < STAGE_COUNT && isStageUnlocked(deckId, depth + 1, cards)) depth += 1;
  return depth;
}

/**
 * The words a round should draw from. Same as the stage's words for a real deck;
 * for "All words" it is the union across decks that have this stage open, so a
 * locked deck never leaks its deeper words into a combined round.
 */
export function stagePool(deckId, stage, cards) {
  if (deckId !== ALL_DECK_ID) return stageWords(deckId, stage);
  return DECKS.filter((deck) => isStageUnlocked(deck.id, stage, cards)).flatMap(
    (deck) => deck.stages[stage] ?? []
  );
}

/** Per-stage progress for one deck, for the stage picker and the deck report. */
export function stageProgress(deckId, stage, cards) {
  const words = stagePool(deckId, stage, cards);
  const stageCards = cardsFor(words, cards);
  return {
    stage,
    total: words.length,
    unlocked: isStageUnlocked(deckId, stage, cards),
    mastery: masteryOf(stageCards),
    mastered: stageCards.filter(isMastered).length
  };
}

export function deckProgress(deckId, cards) {
  return Array.from({ length: STAGE_COUNT }, (_, stage) =>
    stageProgress(deckId, stage, cards)
  );
}

/**
 * What stands between the learner and the next stage, or null when the deck is
 * fully open. `remaining` is the mastery gap still to close.
 */
export function nextUnlock(deckId, cards) {
  const depth = unlockedDepth(deckId, cards);
  if (depth + 1 >= STAGE_COUNT) return null;
  const mastery = stageProgress(deckId, depth, cards).mastery;
  return {
    stage: depth + 1,
    from: depth,
    mastery,
    threshold: UNLOCK_THRESHOLD,
    remaining: Math.max(0, UNLOCK_THRESHOLD - mastery)
  };
}
