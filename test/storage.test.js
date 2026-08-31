import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { load, save, withCards, withBests, reset } from '../source/storage.js';

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
    const cards = { 'el gato': { box: 2, due: 9, seen: 3, correct: 2 } };
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
    localStorage.setItem('vocabulario:v1', '{not json');
    expect(load()).toEqual({ cards: {}, best: { score: 0, streak: 0 } });
  });

  it('fills in a half-written payload', () => {
    localStorage.setItem('vocabulario:v1', JSON.stringify({ cards: { hoy: {} } }));
    expect(load().best).toEqual({ score: 0, streak: 0 });
    expect(load().cards).toEqual({ hoy: {} });
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
