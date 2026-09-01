import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  load,
  save,
  withCards,
  withBests,
  reset,
  exportProgress,
  parseProgress,
  queueReview,
  readOutbox,
  clearQueued,
  newReviewId,
  VERSION
} from '../source/storage.js';
import { newCard } from '../source/srs.js';

const V1 = 'vocabulario:v1';
const V2 = 'vocabulario:v2';

/** Minimal localStorage stand-in — the module only needs these three methods. */
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

describe('storage', () => {
  it('starts empty', () => {
    expect(load()).toEqual({ cards: {}, best: { score: 0, streak: 0 }, syncedAt: 0 });
  });

  it('round-trips cards and bests', () => {
    const cards = { 'el gato': { ...newCard(), box: 2, dueAt: 9, seen: 3, correct: 2 } };
    save(withBests(withCards(load(), cards), { score: 120, streak: 7 }));
    const loaded = load();
    expect(loaded.cards).toEqual(cards);
    expect(loaded.best).toEqual({ score: 120, streak: 7 });
  });

  it('only ever raises a best', () => {
    const data = withBests(load(), { score: 120, streak: 7 });
    expect(withBests(data, { score: 30, streak: 2 }).best).toEqual({ score: 120, streak: 7 });
  });

  it('recovers from a corrupt payload', () => {
    localStorage.setItem(V2, '{not json');
    expect(load()).toEqual({ cards: {}, best: { score: 0, streak: 0 }, syncedAt: 0 });
  });

  it('fills in a half-written payload', () => {
    localStorage.setItem(V2, JSON.stringify({ cards: { hoy: {} } }));
    expect(load().best).toEqual({ score: 0, streak: 0 });
    expect(load().cards).toEqual({ hoy: newCard() });
  });

  it('clears everything on reset', () => {
    save(withBests(load(), { score: 500, streak: 9 }));
    expect(reset().best.score).toBe(0);
    expect(load().best.score).toBe(0);
  });

  it('still plays when storage is unavailable', () => {
    delete globalThis.localStorage;
    expect(load()).toEqual({ cards: {}, best: { score: 0, streak: 0 }, syncedAt: 0 });
    expect(() => save({ cards: {}, best: { score: 1, streak: 1 } })).not.toThrow();
    expect(() => reset()).not.toThrow();
  });

  it('survives a storage that throws on write', () => {
    globalThis.localStorage = fakeStorage({
      setItem: () => {
        throw new Error('QuotaExceededError');
      }
    });
    expect(() => save({ cards: {}, best: { score: 1, streak: 1 } })).not.toThrow();
  });
});

describe('upgrading from v1', () => {
  const v1 = {
    cards: { 'el gato': { box: 3, due: 14, seen: 9, correct: 7 } },
    best: { score: 130, streak: 11 }
  };

  it('carries box, counts and bests across, and brings the word due now', () => {
    localStorage.setItem(V1, JSON.stringify(v1));
    const loaded = load();

    expect(loaded.best).toEqual({ score: 130, streak: 11 });
    // `due: 14` counted questions against a counter that restarted each round,
    // so there is no date to recover from it — the word simply comes up again.
    expect(loaded.cards['el gato']).toEqual({
      box: 3,
      dueAt: 0,
      seen: 9,
      correct: 7,
      lastSeenAt: 0
    });
  });

  it('leaves the v1 payload untouched, so an upgrade has something to fall back on', () => {
    localStorage.setItem(V1, JSON.stringify(v1));
    save(load());

    expect(JSON.parse(localStorage.getItem(V1))).toEqual(v1);
    expect(JSON.parse(localStorage.getItem(V2)).version).toBe(VERSION);
  });

  it('prefers v2 once it exists', () => {
    localStorage.setItem(V1, JSON.stringify(v1));
    localStorage.setItem(V2, JSON.stringify({ version: 2, cards: {}, best: { score: 5, streak: 1 } }));
    expect(load().best.score).toBe(5);
  });

  it('clears the old key too, so nothing resurrects after a reset', () => {
    localStorage.setItem(V1, JSON.stringify(v1));
    reset();
    expect(load().cards).toEqual({});
  });
});

describe('moving progress between origins', () => {
  const progress = {
    cards: { 'la manzana': { ...newCard(), box: 4, seen: 6, correct: 6 } },
    best: { score: 220, streak: 14 }
  };

  it('round-trips through an export', () => {
    expect(parseProgress(exportProgress(progress))).toEqual({ ...progress, syncedAt: 0 });
  });

  // The cursor is about one browser's conversation with the server. Carrying it
  // to a different browser would tell that one it had already pulled history it
  // has never seen.
  it('does not carry the sync cursor to another browser', () => {
    const synced = { ...progress, syncedAt: 1_700_000_000_000 };
    expect(JSON.parse(exportProgress(synced)).syncedAt).toBeUndefined();
    expect(parseProgress(exportProgress(synced)).syncedAt).toBe(0);
  });

  it('reads an export made before the current version', () => {
    const old = JSON.stringify({ ...JSON.parse(exportProgress(progress)), version: 1 });
    expect(parseProgress(old).best).toEqual(progress.best);
  });

  it('explains itself rather than throwing something opaque', () => {
    expect(() => parseProgress('nonsense')).toThrow(/valid progress data/);
    expect(() => parseProgress('{"cards":{}}')).toThrow(/did not come from Vocabulario/);
    expect(() => parseProgress(JSON.stringify({ format: 'vocabulario/progress', version: 99 })))
      .toThrow(/newer version/);
  });
});

describe('the outbox', () => {
  const entry = (id, wordEs = 'el gato') => ({ id, wordEs, correct: 1, reviewedAt: 1 });

  it('keeps answers in the order they happened', () => {
    queueReview(entry('a'));
    queueReview(entry('b'));
    expect(readOutbox().map((e) => e.id)).toEqual(['a', 'b']);
  });

  // A dropped response must cost a retry, never the answers themselves.
  it('clears only what the server confirmed', () => {
    queueReview(entry('a'));
    queueReview(entry('b'));
    queueReview(entry('c'));
    clearQueued(['a', 'c']);
    expect(readOutbox().map((e) => e.id)).toEqual(['b']);
  });

  it('keeps answers added while a sync was in flight', () => {
    queueReview(entry('a'));
    const sending = readOutbox().map((e) => e.id);
    queueReview(entry('late'));
    clearQueued(sending);
    expect(readOutbox().map((e) => e.id)).toEqual(['late']);
  });

  it('is emptied by a reset, along with everything else', () => {
    queueReview(entry('a'));
    reset();
    expect(readOutbox()).toEqual([]);
  });

  it('survives storage being unavailable', () => {
    delete globalThis.localStorage;
    expect(readOutbox()).toEqual([]);
    expect(() => queueReview(entry('a'))).not.toThrow();
    expect(() => clearQueued(['a'])).not.toThrow();
  });

  it('mints ids that do not collide', () => {
    const ids = new Set(Array.from({ length: 500 }, newReviewId));
    expect(ids.size).toBe(500);
  });
});
