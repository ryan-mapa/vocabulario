// One example sentence per word, and the rules for when it may be shown.
//
// The sentences live in their own module rather than inside vocab.js for two
// reasons: vocab.js is already 2,000 lines, and these are the part most in need
// of a native speaker's eye. A reviewer can read this file top to bottom without
// wading through deck structure.
//
// Keyed by the Spanish headword exactly as it appears in vocab.js — the same
// string that keys progress, so the join can never drift. A word with no entry
// simply has no button, exactly as a word with no recording has no speaker.

/**
 * Which sentences may be shown for a question.
 *
 * The rule is the same one that governs the speaker button: never show the
 * learner the thing they are being asked to produce. Before answering, only the
 * sentence in the prompt's own language is safe —
 *
 *   - Spanish prompt: the Spanish sentence gives context for a word they can
 *     already see. Its English translation would hand over the answer.
 *   - English prompt: the English sentence disambiguates which sense of the word
 *     is meant. The Spanish sentence contains the answer outright.
 *
 * Once answered there is nothing left to give away, so both appear and the pair
 * becomes what it is actually for: the word doing its job in a real sentence.
 */
export function exampleLines(example, direction, answered) {
  if (!example?.es || !example?.en) return [];
  const lines = [
    { lang: 'es', text: example.es },
    { lang: 'en', text: example.en }
  ];
  if (answered) return lines;
  return lines.filter((line) => line.lang === promptSide(direction));
}

/** The language a question shows its prompt in. */
export function promptSide(direction) {
  return direction === 'en-es' ? 'en' : 'es';
}

/** The sentence pair for a word, or null where none was written. */
export function exampleFor(sentences, es) {
  const pair = sentences?.[es];
  if (!Array.isArray(pair) || pair.length !== 2) return null;
  const [spanish, english] = pair;
  if (!spanish || !english) return null;
  return { es: spanish, en: english };
}

/** Is there anything to reveal for this question at all? */
export function hasExample(sentences, word, direction) {
  return exampleLines(exampleFor(sentences, word?.es), direction, false).length > 0;
}
