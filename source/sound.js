// The two notes an answer makes.
//
// Synthesised rather than recorded: two tones are a few numbers, where audio
// files would be assets to ship, license and cache for a sound lasting a fifth
// of a second.
//
// Deliberately not a buzzer. Getting a word wrong is the most useful thing that
// happens in a round, and a harsh noise teaches people to stop answering when
// unsure — which is exactly the behaviour that stops them learning. The wrong
// tone is lower and quieter than the right one, not nastier.
//
// Pure data and a stored preference; main.js owns the AudioContext, so this
// stays testable and `source/` stays free of browser APIs beyond storage.

/** A rising fifth, D5 to A5. Brief and bright. */
export const CORRECT = [
  { hz: 587.33, start: 0, seconds: 0.07, gain: 0.16 },
  { hz: 880.0, start: 0.06, seconds: 0.11, gain: 0.16 }
];

/** One low note, softer and longer. A shrug, not a klaxon. */
export const WRONG = [{ hz: 233.08, start: 0, seconds: 0.17, gain: 0.11 }];

export const tonesFor = (correct) => (correct ? CORRECT : WRONG);

/** How long a whole cue lasts, for anything that needs to wait it out. */
export function duration(tones) {
  return tones.reduce((end, tone) => Math.max(end, tone.start + tone.seconds), 0);
}

/**
 * Muting is per device, not per account.
 *
 * Somebody may well want sound on a laptop at home and silence on the phone
 * they use on a train, so this is deliberately kept out of the synced payload
 * — it is a property of where you are, not of who you are.
 */
const KEY = 'vocabulario:sound';

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Sound is on unless it was turned off here. */
export function isMuted() {
  try {
    return storage()?.getItem(KEY) === 'off';
  } catch {
    return false;
  }
}

export function setMuted(muted) {
  try {
    storage()?.setItem(KEY, muted ? 'off' : 'on');
  } catch {
    // Blocked storage. The choice holds for this visit and is forgotten after.
  }
  return muted;
}
