import { ALL_DECK_ID } from './vocab.js';
import { newCard, review, masteryOf, isMastered, selectNext, BOX_COUNT } from './srs.js';
import { buildQuestion, isCorrect } from './quiz.js';
import { selectionPool, isStageUnlocked } from './stages.js';

export const ROUND_LENGTH = 20;

/** Both directions in one round, evenly split. */
export const MIXED = 'mixed';

// How likely a word is to be asked the harder way, from barely known to
// mastered. Never 0 or 1: a new word gets the occasional recall so the round
// stays mixed from the start, and a mastered one still gets recognised
// sometimes so it does not become a different exercise entirely.
const RECALL_FLOOR = 0.2;
const RECALL_CEIL = 0.8;

/**
 * Recognition (Spanish → English) is the easier direction; recall
 * (English → Spanish) is the one that actually proves you know a word. So the
 * odds of being asked to recall rise with how well the word is known — a word
 * you have just met is mostly shown to you, a word you have mastered is mostly
 * demanded of you.
 */
function recallChance(card) {
  return RECALL_FLOOR + (RECALL_CEIL - RECALL_FLOOR) * (card.box / (BOX_COUNT - 1));
}

/**
 * Headless game state: rounds of multiple-choice questions over one deck, with
 * per-word progress that survives across rounds.
 */
export function createGame({
  deckId = ALL_DECK_ID,
  stages = [0],
  direction = MIXED,
  cards = {},
  roundLength = ROUND_LENGTH,
  random = Math.random,
  now = Date.now
} = {}) {
  const chosen = [...new Set(stages)].sort();
  const locked = chosen.filter((stage) => !isStageUnlocked(deckId, stage, cards));
  if (locked.length) {
    throw new Error(`stage ${locked[0]} of deck "${deckId}" is locked`);
  }
  const words = selectionPool(deckId, chosen, cards);
  if (words.length === 0) {
    throw new Error(`no words for deck "${deckId}" stages ${chosen.join(',') || '(none)'}`);
  }

  const state = {
    deckId,
    stages: chosen,
    direction,
    words,
    cards: { ...cards },
    roundLength,
    plan: [],
    remaining: {},
    asked: 0,
    correct: 0,
    startedAt: 0,
    question: null,
    lastAnswer: null
  };

  function cardFor(word) {
    return state.cards[word.es] ?? newCard();
  }

  /**
   * Which way to ask this particular word.
   *
   * A mixed round is still exactly half and half — the two directions hold a
   * budget of slots and each question spends one. The weighting decides which
   * budget a word *prefers*; the budget decides what is actually left. So the
   * balance of the round is guaranteed while the harder direction still lands
   * on the words that have earned it.
   */
  function directionFor(word) {
    if (state.direction !== MIXED) return state.direction;

    const left = state.remaining;
    const total = left['en-es'] + left['es-en'];
    // Half the decision is what the word deserves, half is what the round still
    // owes. Steering toward the budget rather than only enforcing it at the end
    // is what keeps the last few questions from all being the same direction
    // once one side runs dry.
    const pressure = total > 0 ? left['en-es'] / total : 0.5;
    const chance = 0.5 * recallChance(cardFor(word)) + 0.5 * pressure;

    const wanted = random() < chance ? 'en-es' : 'es-en';
    const other = wanted === 'en-es' ? 'es-en' : 'en-es';
    const picked = left[wanted] > 0 || left[other] <= 0 ? wanted : other;

    left[picked] -= 1;
    return picked;
  }

  function nextQuestion() {
    if (state.asked >= state.roundLength) {
      state.question = null;
      return null;
    }
    const word = selectNext(state.words, state.cards, now(), {
      avoid: state.question?.word.es ?? null,
      random
    });
    const direction = directionFor(word);
    state.plan.push(direction);
    state.question = buildQuestion(word, state.words, direction, random);
    state.lastAnswer = null;
    return state.question;
  }

  function answer(choice) {
    if (!state.question) throw new Error('no question in play');
    if (state.lastAnswer) return state.lastAnswer; // ignore double-taps

    const question = state.question;
    const correct = isCorrect(question, choice);
    const at = now();

    state.cards[question.word.es] = review(cardFor(question.word), correct, at);
    state.asked += 1;
    state.correct += correct ? 1 : 0;

    state.lastAnswer = { choice, correct, question, at };
    return state.lastAnswer;
  }

  function startRound() {
    // An odd round length gives the extra question to recall, the harder one.
    const recall = Math.ceil(state.roundLength / 2);
    state.remaining = { 'en-es': recall, 'es-en': state.roundLength - recall };
    state.plan = [];
    state.asked = 0;
    state.correct = 0;
    state.startedAt = now();
    state.question = null;
    state.lastAnswer = null;
    return nextQuestion();
  }

  /**
   * Take in progress that arrived from somewhere else mid-round.
   *
   * A round works from its own copy of the cards, taken when it started. Without
   * this, a sync landing mid-round would update the saved progress while the
   * round carried on from the older copy — and the next answer would write that
   * stale copy straight back over everything the sync brought in.
   *
   * Incoming cards win: they are the fold over every device's history. An
   * answer of this round's that has not reached the server yet is folded in on
   * the next sync, so a card that regresses here corrects itself.
   */
  function adoptCards(incoming) {
    state.cards = { ...state.cards, ...incoming };
  }

  return {
    state,
    adoptCards,
    nextQuestion,
    answer,
    startRound,
    isRoundOver: () => state.asked >= state.roundLength,
    accuracy: () => (state.asked === 0 ? 0 : state.correct / state.asked),
    mastery: () => masteryOf(state.words.map(cardFor)),
    masteredCount: () => state.words.filter((word) => isMastered(cardFor(word))).length
  };
}
