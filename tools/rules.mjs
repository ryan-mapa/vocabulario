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

/**
 * English words that leaked into a Spanish sentence.
 *
 * The pilot produced `Flota el chifón gracefully cuando caminas.` — structurally
 * perfect and half in the wrong language. Nothing else here would have caught it.
 *
 * Two signals, both chosen to have no false positives on real Spanish rather
 * than to catch everything: an `-ly` ending, which Spanish does not form
 * adverbs with (it uses `-mente`), and a list of English function words that
 * are not also Spanish words. Deliberately not `-ing`: the corpus already
 * teaches `el trekking`.
 */
const ENGLISH_FUNCTION_WORDS = new Set([
  'the', 'and', 'is', 'are', 'was', 'were', 'with', 'from', 'that', 'this',
  'very', 'when', 'they', 'have', 'has', 'will', 'would', 'there', 'their',
  'what', 'which', 'about', 'into', 'than', 'then', 'some', 'more', 'most',
  'been', 'being', 'does', 'doesn', 'you', 'your', 'his', 'her', 'its',
  'for', 'but', 'not', 'all', 'can', 'could', 'should', 'because', 'while'
]);

export function englishLeak(sentence) {
  const tokens = flatten(sentence).replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  return tokens.filter(
    (t) => ENGLISH_FUNCTION_WORDS.has(t) || (t.length >= 5 && t.endsWith('ly'))
  );
}

/** A gloss the quiz can show as one unambiguous option. */
export function checkGloss(en) {
  const faults = [];
  if (/^(the|a|an) /i.test(en)) faults.push(`gloss starts with an article: "${en}" — the corpus writes them bare`);
  if (en.includes('/')) faults.push(`gloss offers alternatives: "${en}" — a multiple-choice option needs one meaning`);
  if (en.includes(',')) faults.push(`gloss is a list: "${en}" — pick one meaning`);
  return faults;
}

/**
 * Article that disagrees with the noun.
 *
 * The pilot returned `la babero` and `la gafas de sol`. Spanish gender is not
 * fully predictable from the ending, so this only flags the reliable cases: an
 * -o noun under `la`, an -a noun under `el`, and a plural noun under a singular
 * article. Known exceptions are listed rather than guessed at.
 */
const FEM_O = new Set(['mano', 'foto', 'moto', 'radio', 'libido', 'disco']);
const ALWAYS_PLURAL = /^(gafas|tijeras|vacaciones|afueras|celos|lentes|pantalones|jeans)$/;

// Only the reliable direction. Measured against the corpus: an -o noun under
// "la" occurs twice, and both are the textbook exceptions. An -a noun under
// "el" occurs 27 times and every one is correct — el agua, el koala, el día,
// el turista, el mapa, el sistema — so that direction is not a signal at all
// and flagging it would have cost 27 round trips to fix nothing.
export function articleFault(es) {
  const m = es.match(/^(el|la|los|las) (\S+)/);
  if (!m) return null;
  const [, article, noun] = m;
  const n = flatten(noun);
  if (article === 'la' && n.endsWith('o') && !FEM_O.has(n)) return `"${es}" — an -o noun usually takes "el"`;
  if ((article === 'el' || article === 'la') && ALWAYS_PLURAL.test(n))
    return `"${es}" — "${noun}" is always plural, so the article is "${article === 'el' ? 'los' : 'las'}"`;
  return null;
}

/**
 * Multi-word entries whose head noun is already taught.
 *
 * `la chaqueta vaquera`, `el traje de noche`, `la falda plisada` — all built
 * from words the app already has. Each passes the uniqueness rule and teaches
 * a learner nothing they could not already assemble. Some are legitimate: a
 * boarding pass really is one idea, not "tarjeta" plus "embarque". So this is a
 * share, not a per-entry rule — a couple is normal, half a stage is padding.
 */
export function compoundPadding(entries, taughtHeads) {
  // Only entries that begin with an article, so the connector locutions in
  // Questions & Connectors — 'a pesar de', 'no obstante' — are not counted.
  // Those are legitimately multi-word and would otherwise flag 28 of 30.
  const head = (es) => flatten(es).replace(/^(el|la|los|las) /, '').split(/\s+/)[0];
  const built = entries.filter(
    (e) => /^(el|la|los|las) /.test(e.es) &&
           /\s/.test(e.es.replace(/^(el|la|los|las) /, '')) &&
           taughtHeads.has(head(e.es))
  );
  const cap = Math.max(3, Math.ceil(entries.length * 0.5));
  return built.length > cap
    ? { count: built.length, cap, of: entries.length, examples: built.slice(0, 4).map((e) => e.es) }
    : null;
}
