import { ALL_DECK_ID } from './vocab.js';
import { newCard, review, masteryOf, isMastered, selectNext } from './srs.js';
import { buildQuestion, isCorrect } from './quiz.js';
import { stagePool, isStageUnlocked } from './stages.js';

export const ROUND_LENGTH = 10;

const BASE_POINTS = 10;
const MAX_STREAK_BONUS = 5;

/**
 * Headless game state: rounds of multiple-choice questions over one deck,
 * with per-word progress that survives across rounds.
 */
export function createGame({
  deckId = ALL_DECK_ID,
  stage = 0,
  direction = 'es-en',
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
    asked: 0,
    correct: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
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
    state.question = buildQuestion(word, state.words, state.direction, random);
    state.lastAnswer = null;
    return state.question;
  }

  function answer(choice) {
    if (!state.question) throw new Error('no question in play');
    if (state.lastAnswer) return state.lastAnswer; // ignore double-taps

    const question = state.question;
    const correct = isCorrect(question, choice);
    const points = correct ? BASE_POINTS + 2 * Math.min(state.streak, MAX_STREAK_BONUS) : 0;

    const at = now();
    state.cards[question.word.es] = review(cardFor(question.word), correct, at);
    state.asked += 1;
    state.score += points;
    state.correct += correct ? 1 : 0;
    state.streak = correct ? state.streak + 1 : 0;
    state.bestStreak = Math.max(state.bestStreak, state.streak);

    state.lastAnswer = { choice, correct, points, question, at };
    return state.lastAnswer;
  }

  function startRound() {
    state.asked = 0;
    state.correct = 0;
    state.score = 0;
    state.streak = 0;
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
