// Progress lives in localStorage as one card map keyed by the Spanish word, so
// learning "la manzana" counts whether you met it in Food or in All words.
//
// v1 stored `due` as a question counter against a clock that restarted every
// round, so it never scheduled anything; v2 stores `dueAt` as a timestamp.
// v1 is read and migrated but never written to or removed — it costs a few KB
// and it is the only copy anyone upgrading has to fall back on.

import { newCard } from './srs.js';

export const VERSION = 2;

const KEY = 'vocabulario:v2';
const LEGACY_KEY = 'vocabulario:v1';

/** Marks a payload as ours, so a stray clipboard paste fails with a real message. */
export const TRANSFER_FORMAT = 'vocabulario/progress';

const EMPTY = { cards: {}, best: { score: 0, streak: 0 } };

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // private mode / blocked site data
  }
}

const number = (value, fallback) => (Number.isFinite(value) ? value : fallback);

/**
 * Read one card from whatever wrote it. A v1 card has `due` in questions
 * rather than `dueAt` in milliseconds; there is no date hiding in that number,
 * so a migrated card simply falls due now. Box, seen and correct — the actual
 * progress — carry over untouched.
 */
function readCard(raw) {
  const base = newCard();
  if (!raw || typeof raw !== 'object') return base;
  return {
    box: number(raw.box, base.box),
    dueAt: number(raw.dueAt, base.dueAt),
    seen: number(raw.seen, base.seen),
    correct: number(raw.correct, base.correct),
    lastSeenAt: number(raw.lastSeenAt, base.lastSeenAt)
  };
}

function readCards(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(Object.entries(raw).map(([es, card]) => [es, readCard(card)]));
}

function readPayload(parsed) {
  return {
    cards: readCards(parsed?.cards),
    best: {
      score: number(parsed?.best?.score, 0),
      streak: number(parsed?.best?.streak, 0)
    }
  };
}

function readKey(store, key) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // absent, or a corrupt payload — either way, nothing to read
  }
}

export function load() {
  const store = storage();
  if (!store) return structuredClone(EMPTY);

  const current = readKey(store, KEY);
  if (current) return readPayload(current);

  const legacy = readKey(store, LEGACY_KEY);
  if (legacy) return readPayload(legacy);

  return structuredClone(EMPTY);
}

export function save(data) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify({ version: VERSION, ...data }));
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
    store?.removeItem(LEGACY_KEY);
  } catch {
    /* nothing to clear */
  }
  return structuredClone(EMPTY);
}

/**
 * Progress as text the learner can carry somewhere else. It exists because
 * localStorage is per-origin: moving this app to another address would
 * otherwise strand everyone's progress at the old one with no way to reach it.
 */
export function exportProgress(data) {
  return JSON.stringify(
    {
      format: TRANSFER_FORMAT,
      version: VERSION,
      exportedAt: Date.now(),
      cards: data.cards,
      best: data.best
    },
    null,
    2
  );
}

/**
 * Parse an exported payload. Throws rather than returning null: every way this
 * fails is something the person pasting can act on, so the message is the
 * useful part.
 */
export function parseProgress(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That is not valid progress data — check the whole code was copied.');
  }
  if (!parsed || parsed.format !== TRANSFER_FORMAT) {
    throw new Error('That code did not come from Vocabulario.');
  }
  if (number(parsed.version, 0) > VERSION) {
    throw new Error('That code came from a newer version of Vocabulario than this one.');
  }
  return readPayload(parsed);
}
