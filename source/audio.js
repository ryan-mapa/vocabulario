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
 * Whether the Spanish may be spoken yet.
 *
 * In the recall direction the Spanish *is* the answer, so a speaker button on
 * the prompt would read it out. Same trap as the regional-variant note, which
 * is why that only appears once answered. Half of every mixed round is recall,
 * so this is the common case, not an edge one.
 */
export function canPlay(direction, answered) {
  return direction === 'es-en' || answered;
}
