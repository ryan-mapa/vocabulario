import { describe, it, expect } from 'vitest';
import { buildQuestion, isCorrect, CHOICE_COUNT } from '../source/quiz.js';
import { mulberry32 } from '../source/random.js';

const pool = [
  { es: 'el perro', en: 'dog' },
  { es: 'el gato', en: 'cat' },
  { es: 'la vaca', en: 'cow' },
  { es: 'el oso', en: 'bear' },
  { es: 'el zorro', en: 'fox' }
];

describe('buildQuestion', () => {
  it('asks in Spanish and answers in English for es-en', () => {
    const question = buildQuestion(pool[0], pool, 'es-en', mulberry32(7));
    expect(question.prompt).toBe('el perro');
    expect(question.answer).toBe('dog');
    expect(question.choices).toContain('dog');
  });

  it('flips both sides for en-es', () => {
    const question = buildQuestion(pool[0], pool, 'en-es', mulberry32(7));
    expect(question.prompt).toBe('dog');
    expect(question.answer).toBe('el perro');
    question.choices.forEach((choice) => expect(choice).toMatch(/^(el|la) /));
  });

  it('offers four distinct choices including the answer', () => {
    for (let seed = 0; seed < 25; seed++) {
      const question = buildQuestion(pool[seed % pool.length], pool, 'es-en', mulberry32(seed));
      expect(question.choices).toHaveLength(CHOICE_COUNT);
      expect(new Set(question.choices).size).toBe(CHOICE_COUNT);
      expect(question.choices).toContain(question.answer);
    }
  });

  it('never repeats a translation across choices, even with duplicate meanings', () => {
    const dupes = [
      { es: 'el pescado', en: 'fish' },
      { es: 'el pez', en: 'fish' },
      { es: 'el gato', en: 'cat' },
      { es: 'la vaca', en: 'cow' },
      { es: 'el oso', en: 'bear' }
    ];
    const question = buildQuestion(dupes[0], dupes, 'es-en', mulberry32(3));
    expect(question.choices.filter((choice) => choice === 'fish')).toHaveLength(1);
  });

  it('shrinks gracefully when the pool is too small for four options', () => {
    const question = buildQuestion(pool[0], pool.slice(0, 2), 'es-en', mulberry32(1));
    expect(question.choices).toHaveLength(2);
    expect(question.choices).toContain('dog');
  });
});

describe('isCorrect', () => {
  it('matches only the exact answer', () => {
    const question = buildQuestion(pool[0], pool, 'es-en', mulberry32(2));
    expect(isCorrect(question, 'dog')).toBe(true);
    expect(isCorrect(question, 'cat')).toBe(false);
  });
});
