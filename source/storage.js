// Progress lives in localStorage as one card map keyed by the Spanish word, so
// learning "la manzana" counts whether you met it in Comida or in Todos.

const KEY = 'vocabulario:v1';

const EMPTY = { cards: {}, best: { score: 0, streak: 0 } };

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // private mode / blocked site data
  }
}

export function load() {
  const store = storage();
  if (!store) return structuredClone(EMPTY);
  try {
    const raw = store.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const parsed = JSON.parse(raw);
    return {
      cards: parsed.cards ?? {},
      best: { ...EMPTY.best, ...(parsed.best ?? {}) }
    };
  } catch {
    return structuredClone(EMPTY); // corrupt payload — start clean
  }
}

export function save(data) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(data));
  } catch {
    // Out of quota or blocked — progress just won't persist.
  }
}

export function withCards(data, cards) {
  return { ...data, cards };
}

export function withBests(data, { score, streak }) {
  return {
    ...data,
    best: {
      score: Math.max(data.best.score, score),
      streak: Math.max(data.best.streak, streak)
    }
  };
}

export function reset() {
  const store = storage();
  try {
    store?.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
  return structuredClone(EMPTY);
}
