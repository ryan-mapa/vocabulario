import { shuffle } from './random.js';

export const DIRECTIONS = {
  'es-en': { promptSide: 'es', answerSide: 'en', label: 'Español → English' },
  'en-es': { promptSide: 'en', answerSide: 'es', label: 'English → Español' }
};

export const CHOICE_COUNT = 4;

/**
 * Build a multiple-choice question for `word`, drawing distractors from `pool`.
 * Distractors are deduped by answer text so no two buttons ever read alike.
 */
export function buildQuestion(word, pool, direction, random = Math.random) {
  const { promptSide, answerSide } = DIRECTIONS[direction] ?? DIRECTIONS['es-en'];
  const answer = word[answerSide];

  const seen = new Set([answer]);
  const distractors = [];
  for (const candidate of shuffle(pool, random)) {
    if (distractors.length >= CHOICE_COUNT - 1) break;
    const text = candidate[answerSide];
    if (seen.has(text)) continue;
    seen.add(text);
    distractors.push(text);
  }

  return {
    word,
    direction,
    prompt: word[promptSide],
    answer,
    choices: shuffle([answer, ...distractors], random)
  };
}

export function isCorrect(question, choice) {
  return choice === question.answer;
}
