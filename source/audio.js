// Where a word's pronunciation lives, and which voice says it next.
//
// Deliberately pure — no Audio object is built here. main.js does the playing,
// so this stays testable and `source/` stays DOM-free.

/** Voices per word. Tapping again cycles, so repeats are never the same voice. */
export const VOICE_COUNT = 4;

const DIR = 'audio';
const FORMAT = 'mp3';

/**
 * Filename stem for a word.
 *
 * Accents are stripped because a name that survives every filesystem, URL
 * encoder and CDN in between is worth more than fidelity we already hold in the
 * word itself. Two consequences worth knowing, both guarded by vocab.test.js:
 *
 * - Stripping accents can collide where the accent is the whole difference.
 *   `el año` and `el ano` are different words, and both become `el-ano`.
 * - The stem derives from `es`, so renaming a shipped word silently breaks its
 *   audio exactly as it orphans its progress.
 */
export function audioSlug(es) {
  return es
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/** Where the list of words that have a full set of recordings lives. */
export const MANIFEST_URL = `${DIR}/words.json`;

/** Path to one voice's recording of a word, relative to the app. */
export function clipUrl(es, voice) {
  return `${DIR}/${voice + 1}/${audioSlug(es)}.${FORMAT}`;
}

/**
 * The voice to play next. Cycles, so tapping twice never gives the same reading
 * twice — one tap is a reminder, four is listening practice.
 */
export function nextVoice(previous, count = VOICE_COUNT) {
  if (count <= 1) return 0;
  return previous === null || previous === undefined ? 0 : (previous + 1) % count;
}

/**
 * Whether this question may be spoken at all.
 *
 * Only when the prompt is already Spanish. In the recall direction the Spanish
 * *is* the answer, so speaking it would simply give it away — and offering it
 * afterwards instead put a button under the feedback line that nobody wanted
 * there. Half of every mixed round is recall, so this is the common case, not
 * an edge one.
 */
export function canPlay(direction) {
  return direction === 'es-en';
}

/**
 * Whether this particular word can be heard.
 *
 * Recordings arrive a few thousand files at a time, and one that fails to
 * generate should cost that word its button rather than cost every word its
 * button. `spoken` is the manifest's set of slugs; empty means no audio at all,
 * which is the normal state of the single-file build and of any copy served
 * before the clips were made.
 */
export function hasClip(spoken, es) {
  return spoken.size > 0 && spoken.has(audioSlug(es));
}
