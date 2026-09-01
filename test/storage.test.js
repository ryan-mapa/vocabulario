import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  load,
  save,
  withCards,
  withBests,
  reset,
  exportProgress,
  parseProgress,
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
    expect(load()).toEqual({ cards: {}, best: { score: 0, streak: 0 } });
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
    expect(load()).toEqual({ cards: {}, best: { score: 0, streak: 0 } });
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
    expect(load()).toEqual({ cards: {}, best: { score: 0, streak: 0 } });
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
    expect(parseProgress(exportProgress(progress))).toEqual(progress);
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
