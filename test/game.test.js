import { describe, it, expect } from 'vitest';
import { createGame } from '../source/game.js';
import { mulberry32 } from '../source/random.js';

const newGame = (overrides = {}) =>
  createGame({ deckId: 'animales', roundLength: 5, random: mulberry32(11), ...overrides });

const answerAll = (game, correct) => {
  while (!game.isRoundOver()) {
    const question = game.state.question;
    const choice = correct
      ? question.answer
      : question.choices.find((option) => option !== question.answer);
    game.answer(choice);
    game.nextQuestion();
  }
};

describe('createGame', () => {
  it('rejects an unknown deck', () => {
    expect(() => createGame({ deckId: 'klingon' })).toThrow(/no words/);
  });

  it('deals a question when the round starts', () => {
    const game = newGame();
    expect(game.state.question).toBeNull();
    game.startRound();
    expect(game.state.question.choices).toHaveLength(4);
  });
});

describe('scoring', () => {
  it('pays a growing streak bonus, capped at five', () => {
    const game = newGame({ roundLength: 10 });
    game.startRound();
    const points = [];
    while (!game.isRoundOver()) {
      points.push(game.answer(game.state.question.answer).points);
      game.nextQuestion();
    }
    expect(points.slice(0, 6)).toEqual([10, 12, 14, 16, 18, 20]);
    expect(points.slice(6)).toEqual([20, 20, 20, 20]);
  });

  it('scores nothing and resets the streak on a miss, keeping the best', () => {
    const game = newGame();
    game.startRound();
    game.answer(game.state.question.answer);
    game.nextQuestion();
    game.answer(game.state.question.answer);
    game.nextQuestion();
    expect(game.state.streak).toBe(2);

    const wrong = game.state.question.choices.find((c) => c !== game.state.question.answer);
    const result = game.answer(wrong);
    expect(result.points).toBe(0);
    expect(game.state.streak).toBe(0);
    expect(game.state.bestStreak).toBe(2);
  });

  it('ignores a second answer to the same question', () => {
    const game = newGame();
    game.startRound();
    const first = game.answer(game.state.question.answer);
    const second = game.answer(game.state.question.choices[0]);
    expect(second).toBe(first);
    expect(game.state.asked).toBe(1);
  });

  it('throws when answering with no question in play', () => {
    expect(() => newGame().answer('dog')).toThrow(/no question/);
  });
});

describe('rounds', () => {
  it('runs exactly roundLength questions, then stops dealing', () => {
    const game = newGame();
    game.startRound();
    answerAll(game, true);
    expect(game.state.asked).toBe(5);
    expect(game.accuracy()).toBe(1);
    expect(game.nextQuestion()).toBeNull();
  });

  it('reports accuracy over the round', () => {
    const game = newGame();
    game.startRound();
    answerAll(game, false);
    expect(game.accuracy()).toBe(0);
    expect(game.state.score).toBe(0);
  });

  it('carries card progress into the next round but resets the score', () => {
    const game = newGame();
    game.startRound();
    answerAll(game, true);
    const learned = { ...game.state.cards };
    expect(Object.keys(learned).length).toBeGreaterThan(0);

    game.startRound();
    expect(game.state.score).toBe(0);
    expect(game.state.asked).toBe(0);
    expect(game.state.cards).toEqual(learned);
  });

  it('resumes from saved cards and counts mastered words', () => {
    const cards = { 'el perro': { box: 4, due: 0, seen: 9, correct: 9 } };
    const game = newGame({ cards });
    expect(game.masteredCount()).toBe(1);
    expect(game.mastery()).toBeCloseTo(4 / (15 * 4));
  });

  it('never asks the same word twice in a row', () => {
    const game = createGame({ deckId: 'todos', roundLength: 40, random: mulberry32(5) });
    game.startRound();
    let previous = null;
    while (!game.isRoundOver()) {
      expect(game.state.question.word.es).not.toBe(previous);
      previous = game.state.question.word.es;
      game.answer(game.state.question.answer);
      game.nextQuestion();
    }
  });
});

// A round works from its own copy of the cards, taken when it started. Progress
// arriving mid-round has to reach that copy, or the next answer writes the
// stale one back over it — which silently destroys whatever just synced in.
describe('progress arriving mid-round', () => {
  it('takes in cards the round has never seen', () => {
    const game = newGame();
    game.startRound();
    game.adoptCards({ 'una palabra de otro aparato': { box: 4, dueAt: 0, seen: 9, correct: 9, lastSeenAt: 1 } });
    expect(game.state.cards['una palabra de otro aparato'].box).toBe(4);
  });

  it('lets the incoming card win over the copy the round started with', () => {
    const word = 'el gato';
    const game = createGame({
      deckId: 'animales',
      cards: { [word]: { box: 0, dueAt: 0, seen: 1, correct: 0, lastSeenAt: 0 } },
      random: mulberry32(3)
    });
    game.adoptCards({ [word]: { box: 3, dueAt: 99, seen: 8, correct: 7, lastSeenAt: 99 } });
    expect(game.state.cards[word]).toEqual({ box: 3, dueAt: 99, seen: 8, correct: 7, lastSeenAt: 99 });
  });

  it('keeps answers the round has already given for other words', () => {
    const game = newGame();
    game.startRound();
    const answered = game.state.question.word.es;
    game.answer(game.state.question.answer);
    const afterAnswer = game.state.cards[answered];

    game.adoptCards({ 'otra palabra': { box: 1, dueAt: 0, seen: 1, correct: 1, lastSeenAt: 0 } });
    expect(game.state.cards[answered]).toEqual(afterAnswer);
  });
});
