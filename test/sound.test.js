import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CORRECT, WRONG, tonesFor, duration, isMuted, setMuted } from '../source/sound.js';

function fakeStorage(overrides = {}) {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    ...overrides
  };
}

beforeEach(() => {
  globalThis.localStorage = fakeStorage();
});

afterEach(() => {
  delete globalThis.localStorage;
});

describe('the tones', () => {
  it('plays a different cue for each outcome', () => {
    expect(tonesFor(true)).toBe(CORRECT);
    expect(tonesFor(false)).toBe(WRONG);
  });

  // Being wrong is the most useful thing that happens in a round. A cue that
  // punishes it teaches people to stop answering when unsure.
  it('makes the wrong cue quieter than the right one, not harsher', () => {
    const loudest = (tones) => Math.max(...tones.map((t) => t.gain));
    expect(loudest(WRONG)).toBeLessThan(loudest(CORRECT));
  });

  // The overtone is what stops a sine tone sounding electronic, and it has to
  // stay well under the fundamental or it becomes the note instead of colour.
  it('colours the correct cue with a quieter overtone', () => {
    expect(CORRECT[1].hz).toBeGreaterThan(CORRECT[0].hz);
    expect(CORRECT[1].gain).toBeLessThan(CORRECT[0].gain / 2);
  });

  it('keeps every cue short enough not to hold up the next question', () => {
    // A correct answer moves on after 700ms. A bell needs to ring to sound like
    // one, so the limit is what fits inside that gap, not the shortest possible.
    expect(duration(CORRECT)).toBeLessThan(0.5);
    expect(duration(WRONG)).toBeLessThan(0.5);
  });

  it('measures a cue from its last note ending, not its longest note', () => {
    expect(duration([{ start: 0, seconds: 0.1 }, { start: 0.5, seconds: 0.05 }])).toBeCloseTo(0.55);
  });

  it('describes every note fully enough to play', () => {
    for (const tone of [...CORRECT, ...WRONG]) {
      expect(tone.hz).toBeGreaterThan(0);
      expect(tone.seconds).toBeGreaterThan(0);
      expect(tone.gain).toBeGreaterThan(0);
      expect(tone.gain).toBeLessThan(1);
      expect(tone.start).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('muting', () => {
  it('starts on, because nothing has been turned off', () => {
    expect(isMuted()).toBe(false);
  });

  it('remembers being turned off, and back on', () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    setMuted(false);
    expect(isMuted()).toBe(false);
  });

  it('reports back what it was set to, so the caller need not re-read', () => {
    expect(setMuted(true)).toBe(true);
    expect(setMuted(false)).toBe(false);
  });

  // Sound belongs to the device, not the account — on at a desk, off on a
  // train — so it is deliberately absent from the synced payload.
  it('is kept apart from progress', () => {
    setMuted(true);
    expect(localStorage.getItem('vocabulario:sound')).toBe('off');
    expect(localStorage.getItem('vocabulario:v2')).toBeNull();
  });

  it('still plays when storage is unavailable', () => {
    delete globalThis.localStorage;
    expect(isMuted()).toBe(false);
    expect(() => setMuted(true)).not.toThrow();
  });

  it('survives a storage that throws', () => {
    globalThis.localStorage = fakeStorage({
      setItem: () => {
        throw new Error('QuotaExceededError');
      }
    });
    expect(() => setMuted(true)).not.toThrow();
  });
});
