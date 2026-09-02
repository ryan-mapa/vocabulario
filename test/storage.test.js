import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  load,
  save,
  withCards,
  withDays,
  reset,
  exportProgress,
  parseProgress,
  queueReview,
  queueRound,
  readRoundOutbox,
  clearQueuedRounds,
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
    expect(load()).toEqual({ cards: {}, days: {}, syncedAt: 0 });
  });

  it('round-trips cards and days', () => {
    const cards = { 'el gato': { ...newCard(), box: 2, dueAt: 9, seen: 3, correct: 2 } };
    save(withDays(withCards(load(), cards), { '2026-09-01': 5 }));
    const loaded = load();
    expect(loaded.cards).toEqual(cards);
    expect(loaded.days).toEqual({ '2026-09-01': 5 });
  });

  it('ignores day entries that are not days, or not counts', () => {
    save(withDays(load(), { '2026-09-01': 5, 'yesterday': 3, '2026-09-02': 'lots' }));
    expect(load().days).toEqual({ '2026-09-01': 5 });
  });

  it('keeps only the most recent two years of days', () => {
    const many = {};
    for (let i = 0; i < 800; i++) {
      const d = new Date(Date.UTC(2024, 0, 1) + i * 86400000).toISOString().slice(0, 10);
      many[d] = 5;
    }
    save(withDays(load(), many));
    const kept = Object.keys(load().days).sort();
    expect(kept).toHaveLength(730);
    expect(kept[kept.length - 1]).toBe(Object.keys(many).sort().pop());
  });

  it('recovers from a corrupt payload', () => {
    localStorage.setItem(V2, '{not json');
    expect(load()).toEqual({ cards: {}, days: {}, syncedAt: 0 });
  });

  it('fills in a half-written payload', () => {
    localStorage.setItem(V2, JSON.stringify({ cards: { hoy: {} } }));
    expect(load().days).toEqual({});
    expect(load().cards).toEqual({ hoy: newCard() });
  });

  it('clears everything on reset', () => {
    save(withDays(load(), { '2026-09-01': 5 }));
    expect(reset().days).toEqual({});
    expect(load().days).toEqual({});
  });

  it('still plays when storage is unavailable', () => {
    delete globalThis.localStorage;
    expect(load()).toEqual({ cards: {}, days: {}, syncedAt: 0 });
    expect(() => save({ cards: {}, days: {} })).not.toThrow();
    expect(() => reset()).not.toThrow();
  });

  it('survives a storage that throws on write', () => {
    globalThis.localStorage = fakeStorage({
      setItem: () => {
        throw new Error('QuotaExceededError');
      }
    });
    expect(() => save({ cards: {}, days: {} })).not.toThrow();
  });
});

describe('upgrading from v1', () => {
  const v1 = {
    cards: { 'el gato': { box: 3, due: 14, seen: 9, correct: 7 } },
    best: { score: 130, streak: 11 }
  };

  it('carries box and counts across, and brings the word due now', () => {
    localStorage.setItem(V1, JSON.stringify(v1));
    const loaded = load();

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
    localStorage.setItem(V2, JSON.stringify({ version: 2, cards: {}, days: { '2026-09-01': 5 } }));
    expect(load().days).toEqual({ '2026-09-01': 5 });
    expect(load().cards).toEqual({});
  });

  // The old best score has no home in the new scoreboard. Reading a v1 payload
  // must not fail on it, and must not resurrect it.
  it('drops the retired best score without complaint', () => {
    localStorage.setItem(V1, JSON.stringify(v1));
    expect(load().best).toBeUndefined();
    expect(load().cards['el gato'].box).toBe(3);
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
    days: { '2026-08-31': 5, '2026-09-01': 6 }
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
    expect(parseProgress(old).days).toEqual(progress.days);
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

describe('the round queue', () => {
  const round = (id) => ({ id, localDay: '2026-09-01', asked: 20, correct: 17 });

  it('is separate from the answer queue', () => {
    queueReview({ id: 'a', wordEs: 'el gato', correct: 1, reviewedAt: 1 });
    queueRound(round('r1'));
    expect(readOutbox().map((e) => e.id)).toEqual(['a']);
    expect(readRoundOutbox().map((e) => e.id)).toEqual(['r1']);
  });

  it('clears only confirmed rounds', () => {
    queueRound(round('r1'));
    queueRound(round('r2'));
    clearQueuedRounds(['r1']);
    expect(readRoundOutbox().map((e) => e.id)).toEqual(['r2']);
  });

  it('is emptied by a reset', () => {
    queueRound(round('r1'));
    reset();
    expect(readRoundOutbox()).toEqual([]);
  });
});
