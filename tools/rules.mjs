// The corpus rules, in one place.
//
// Both the vitest suite and the batch validator import these. That matters more
// than it looks: a validator laxer than the suite would wave work through that
// then fails the build, and a validator stricter than the suite would send
// agents back to fix things that were never wrong. Either costs a round trip.

/** Lowercase, accents stripped — for comparing a word against an inflected form. */
export const flatten = (text) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** The headword without its article: 'la manzana' -> 'manzana'. */
export const bare = (es) => es.replace(/^(el|la|los|las) /, '');

/**
 * Does the sentence use the word?
 *
 * Matched on a four-letter stem at a word boundary, because Spanish inflects:
 * 'el frijol' appears as 'frijoles', 'la nuez' as 'nueces'. Loose enough for
 * grammar, tight enough to catch a sentence filed under the wrong word — and it
 * is the rule that rejects the most, because a stem-changing verb written in a
 * conjugated form ('sigue' for 'seguir') no longer contains its own root.
 */
export function uses(sentence, es) {
  const word = flatten(bare(es));
  const stem = word.length <= 4 ? word.slice(0, 3) : word.slice(0, 4);
  return new RegExp(`(^|[^\\p{L}])${stem}`, 'u').test(flatten(sentence));
}

export const words = (sentence) => sentence.trim().split(/\s+/).length;

/** The first word, normalised. Two words is too specific to measure shape by:
 *  'El pan es bueno' and 'El queso es rico' are the same template and would
 *  score as different openings. */
export const opening = (sentence) =>
  flatten(sentence).replace(/^[¿¡]/, '').split(/\s+/)[0];

/** The formulaic shape a model falls into when it stops thinking:
 *  article + noun + copula, as in 'El pan es bueno.' Correct Spanish, and a
 *  whole deck of it teaches nothing about how the word is used. */
export const isCopulaTemplate = (sentence) =>
  /^(el|la|los|las) \S+ (es|son|está|están|era|eran) /.test(flatten(sentence));

// Calibrated against the 1,800 hand-written sentences, not guessed. The
// opening-word share turned out to have poor precision: Animals opens 19 of 30
// sentences with 'El' because the deck is animal nouns, which is the topic and
// not monotony. It is reported but never fails a batch — a false rejection
// costs an agent round trip, which is the expensive thing here.
// The copula template is the opposite: 2.5% of the corpus, concentrated exactly
// where sentences really are thin. That one is a hard gate.
export const LIMITS = {
  esWords: 12, enWords: 14, minWords: 3,
  sameOpeningShare: 0.55,   // advisory only
  copulaShare: 0.3          // adjective decks legitimately lean on es/está
};

/** Every structural check on one pair. Returns a list of complaints, empty if clean. */
export function checkPair(es, pair) {
  const faults = [];
  if (!Array.isArray(pair) || pair.length !== 2) return ['not a [spanish, english] pair'];
  const [spanish, english] = pair;
  if (!spanish || !english) return ['half the pair is missing'];

  if (!uses(spanish, es)) faults.push(`sentence does not contain "${bare(es)}" (stem-changed?)`);
  if (words(spanish) > LIMITS.esWords) faults.push(`Spanish is ${words(spanish)} words, max ${LIMITS.esWords}`);
  if (words(english) > LIMITS.enWords) faults.push(`English is ${words(english)} words, max ${LIMITS.enWords}`);
  if (words(spanish) < LIMITS.minWords) faults.push('Spanish is too short to be a sentence');
  if (!/[.!?]$/.test(spanish)) faults.push('Spanish has no end punctuation');
  if (!/[.!?]$/.test(english)) faults.push('English has no end punctuation');
  if (spanish.trim() !== spanish || english.trim() !== english) faults.push('leading or trailing space');
  if (spanish.endsWith('?') && !/^¿|\s¿/.test(spanish)) faults.push('question is missing its opening ¿');
  if (spanish.endsWith('!') && !/^¡|\s¡/.test(spanish)) faults.push('exclamation is missing its opening ¡');
  return faults;
}

/** Openings used too often across a set — the formulaic-output check. */
export function overusedOpenings(sentences) {
  const counts = new Map();
  for (const s of sentences) counts.set(opening(s), (counts.get(opening(s)) ?? 0) + 1);
  const cap = Math.max(4, Math.ceil(sentences.length * LIMITS.sameOpeningShare));
  return [...counts.entries()]
    .filter(([, n]) => n > cap)
    .map(([o, n]) => ({ opening: o, count: n, cap }));
}

/** Too much of a set built from the copula template. */
export function copulaOveruse(sentences) {
  const hits = sentences.filter(isCopulaTemplate);
  const cap = Math.max(3, Math.ceil(sentences.length * LIMITS.copulaShare));
  return hits.length > cap ? { count: hits.length, cap, of: sentences.length, examples: hits.slice(0, 3) } : null;
}
