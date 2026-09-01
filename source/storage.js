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
const OUTBOX_KEY = 'vocabulario:outbox';

/**
 * How many unsent answers to keep. Reached only by playing offline for a very
 * long time; past it the oldest go, because a bounded loss of history beats
 * filling the origin's storage quota and losing the ability to save anything.
 */
const OUTBOX_LIMIT = 2000;

/** Marks a payload as ours, so a stray clipboard paste fails with a real message. */
export const TRANSFER_FORMAT = 'vocabulario/progress';

// `syncedAt` is the server clock of the last successful sync. Persisting it is
// what keeps a reload from re-pulling every card and re-offering the whole
// import; 0 means this browser has never synced.
const EMPTY = { cards: {}, best: { score: 0, streak: 0 }, syncedAt: 0 };

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
    },
    syncedAt: number(parsed?.syncedAt, 0)
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
    store?.removeItem(OUTBOX_KEY);
  } catch {
    /* nothing to clear */
  }
  return structuredClone(EMPTY);
}

/** A review id. Client-generated, so an upload retried after a dropped
 *  response is ignored on the server rather than counted twice. */
export function newReviewId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // Older Safari, and any non-secure context. Only needs to be unique per
  // person, and the server treats it as an opaque key.
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Answers waiting to reach the server. Written on every answer, signed in or
 * not: recording history from the start means someone who signs in later
 * brings real history with them instead of only a snapshot.
 */
export function readOutbox() {
  const store = storage();
  if (!store) return [];
  const raw = readKey(store, OUTBOX_KEY);
  return Array.isArray(raw) ? raw : [];
}

function writeOutbox(entries) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(OUTBOX_KEY, JSON.stringify(entries.slice(-OUTBOX_LIMIT)));
  } catch {
    // Quota or blocked storage. Play carries on; this answer just won't sync.
  }
}

export function queueReview(entry) {
  writeOutbox([...readOutbox(), entry]);
}

/** Drop the entries the server confirmed, keeping anything added meanwhile. */
export function clearQueued(ids) {
  const done = new Set(ids);
  writeOutbox(readOutbox().filter((entry) => !done.has(entry.id)));
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
