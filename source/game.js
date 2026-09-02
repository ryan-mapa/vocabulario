import { ALL_DECK_ID } from './vocab.js';
import { newCard, review, masteryOf, isMastered, selectNext } from './srs.js';
import { buildQuestion, isCorrect } from './quiz.js';
import { stagePool, isStageUnlocked } from './stages.js';
import { shuffle } from './random.js';

export const ROUND_LENGTH = 20;

/** Both directions in one round, evenly split. */
export const MIXED = 'mixed';

/**
 * Which way each question runs.
 *
 * On `mixed`, half the round is recognition and half is recall, interleaved
 * rather than run as two blocks — mixed practice retains better than blocked,
 * and a round that changes character halfway through reads as two games stuck
 * together. An odd round length gives the extra question to recall, the harder
 * of the two.
 */
function directionPlan(direction, length, random) {
  if (direction !== MIXED) return Array.from({ length }, () => direction);
  const recall = Math.ceil(length / 2);
  return shuffle(
    [...Array.from({ length: recall }, () => 'en-es'),
     ...Array.from({ length: length - recall }, () => 'es-en')],
    random
  );
}

/**
 * Headless game state: rounds of multiple-choice questions over one deck, with
 * per-word progress that survives across rounds.
 */
export function createGame({
  deckId = ALL_DECK_ID,
  stage = 0,
  direction = MIXED,
  cards = {},
  roundLength = ROUND_LENGTH,
  random = Math.random,
  now = Date.now
} = {}) {
  if (!isStageUnlocked(deckId, stage, cards)) {
    throw new Error(`stage ${stage} of deck "${deckId}" is locked`);
  }
  const words = stagePool(deckId, stage, cards);
  if (words.length === 0) throw new Error(`no words for deck "${deckId}" stage ${stage}`);

  const state = {
    deckId,
    stage,
    direction,
    words,
    cards: { ...cards },
    roundLength,
    plan: [],
    asked: 0,
    correct: 0,
    startedAt: 0,
    question: null,
    lastAnswer: null
  };

  function cardFor(word) {
    return state.cards[word.es] ?? newCard();
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
    state.question = buildQuestion(word, state.words, state.plan[state.asked], random);
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
    state.plan = directionPlan(state.direction, state.roundLength, random);
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
