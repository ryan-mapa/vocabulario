// Progress sync. One request pushes what this device has done and pulls what
// every other device has, because doing both at once is what makes the merge
// safe: the reviews just uploaded are already in the log when the fold runs,
// so the cards coming back can never be behind what was sent.
//
// Nothing here resolves a conflict, because nothing here can produce one.
// `reviews` is an append-only set keyed by a client-generated id, so a retried
// upload is ignored rather than double-counted, and `cards` is a deterministic
// fold over that set. Two devices that have seen the same reviews compute the
// same card, whatever order the reviews arrived in.

import { foldReviews, newCard } from '../../source/srs.js';

export const SRS_VERSION = 2;

const MAX_REVIEWS = 500;
const MAX_IMPORTS = 1200;
const MAX_WORD_LENGTH = 80;
const MAX_ID_LENGTH = 64;

// SQLite allows 999 bound parameters; stay well under it and leave room for
// the user id and any other bindings sharing the statement.
const CHUNK = 80;

// A client clock running ahead would schedule a word beyond the point anyone
// would see it again. Small skew is normal and harmless, so only obvious
// nonsense is pulled back.
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const chunk = (items, size = CHUNK) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const finite = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);

const text = (value, max) =>
  typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;

/** Throws with a message worth returning to the client. */
function readReview(raw, now) {
  const id = text(raw?.id, MAX_ID_LENGTH);
  const wordEs = text(raw?.wordEs, MAX_WORD_LENGTH);
  if (!id || !wordEs) throw new Error('every review needs an id and a word');
  if (!Number.isFinite(raw.reviewedAt)) throw new Error(`review ${id} has no timestamp`);

  return {
    id,
    wordEs,
    deckId: text(raw.deckId, 40),
    stage: Number.isInteger(raw.stage) ? raw.stage : null,
    direction: text(raw.direction, 10),
    correct: raw.correct ? 1 : 0,
    latencyMs: Number.isFinite(raw.latencyMs) ? Math.max(0, Math.round(raw.latencyMs)) : null,
    reviewedAt: Math.min(Math.round(raw.reviewedAt), now + FUTURE_TOLERANCE_MS)
  };
}

function readImport(raw) {
  const wordEs = text(raw?.wordEs, MAX_WORD_LENGTH);
  if (!wordEs) throw new Error('every imported word needs a word');
  return {
    wordEs,
    box: Math.max(0, Math.round(finite(raw.box))),
    dueAt: Math.max(0, Math.round(finite(raw.dueAt))),
    seen: Math.max(0, Math.round(finite(raw.seen))),
    correct: Math.max(0, Math.round(finite(raw.correct))),
    lastSeenAt: Math.max(0, Math.round(finite(raw.lastSeenAt)))
  };
}

/** Rows keyed by word, for the words named. */
async function reviewsByWord(db, userId, words) {
  const byWord = new Map(words.map((word) => [word, []]));

  for (const group of chunk(words)) {
    const holes = group.map(() => '?').join(',');
    const { results } = await db
      .prepare(
        `SELECT word_es, id, correct, reviewed_at FROM reviews
         WHERE user_id = ? AND word_es IN (${holes})`
      )
      .bind(userId, ...group)
      .all();

    for (const row of results) {
      byWord.get(row.word_es).push({
        id: row.id,
        correct: row.correct,
        reviewedAt: row.reviewed_at
      });
    }
  }
  return byWord;
}

/**
 * The starting card for a word: a snapshot imported from a browser that had
 * progress before it had an account, or a fresh card. Imports are a seed and
 * not history — the browser never recorded how that progress was earned, and
 * inventing reviews to match would be a lie the statistics would repeat.
 */
async function seedsByWord(db, userId, words) {
  const seeds = new Map();

  for (const group of chunk(words)) {
    const holes = group.map(() => '?').join(',');
    const { results } = await db
      .prepare(
        `SELECT word_es, box, due_at, seen, correct, last_seen_at FROM imports
         WHERE user_id = ? AND word_es IN (${holes})`
      )
      .bind(userId, ...group)
      .all();

    for (const row of results) {
      seeds.set(row.word_es, {
        box: row.box,
        dueAt: row.due_at,
        seen: row.seen,
        correct: row.correct,
        lastSeenAt: row.last_seen_at
      });
    }
  }
  return seeds;
}

async function refold(db, userId, words, now) {
  if (words.length === 0) return;

  const [history, seeds] = await Promise.all([
    reviewsByWord(db, userId, words),
    seedsByWord(db, userId, words)
  ]);

  const upserts = words.map((word) => {
    const card = foldReviews(history.get(word) ?? [], seeds.get(word) ?? newCard());
    return db
      .prepare(
        `INSERT INTO cards
           (user_id, word_es, box, due_at, seen, correct, last_seen_at, srs_version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, word_es) DO UPDATE SET
           box = excluded.box, due_at = excluded.due_at, seen = excluded.seen,
           correct = excluded.correct, last_seen_at = excluded.last_seen_at,
           srs_version = excluded.srs_version, updated_at = excluded.updated_at`
      )
      .bind(
        userId, word, card.box, card.dueAt, card.seen, card.correct,
        card.lastSeenAt, SRS_VERSION, now
      );
  });

  for (const group of chunk(upserts, 40)) await db.batch(group);
}

/**
 * POST /sync — push this device's answers, pull everyone's cards.
 *
 * `since` is the client's last sync time; 0 asks for everything, which is what
 * a browser signing in on a new device sends.
 */
export async function sync(request, env, user) {
  let body;
  try {
    body = await request.json();
  } catch {
    return { status: 400, data: { error: 'malformed body' } };
  }

  const now = Date.now();
  const since = Math.max(0, finite(body.since));
  const rawReviews = Array.isArray(body.reviews) ? body.reviews : [];
  const rawImports = Array.isArray(body.imports) ? body.imports : [];

  if (rawReviews.length > MAX_REVIEWS) {
    return { status: 413, data: { error: `send at most ${MAX_REVIEWS} reviews at a time` } };
  }
  if (rawImports.length > MAX_IMPORTS) {
    return { status: 413, data: { error: `send at most ${MAX_IMPORTS} words at a time` } };
  }

  let reviews;
  let imports;
  try {
    reviews = rawReviews.map((raw) => readReview(raw, now));
    imports = rawImports.map(readImport);
  } catch (error) {
    return { status: 400, data: { error: error.message } };
  }

  // INSERT OR IGNORE on both: re-sending is how a client recovers from a
  // dropped response, and it has to be free of consequences.
  const writes = [
    ...reviews.map((entry) =>
      env.DB.prepare(
        `INSERT OR IGNORE INTO reviews
           (id, user_id, word_es, deck_id, stage, direction, correct,
            latency_ms, reviewed_at, received_at, source, srs_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'review', ?)`
      ).bind(
        entry.id, user.sub, entry.wordEs, entry.deckId, entry.stage, entry.direction,
        entry.correct, entry.latencyMs, entry.reviewedAt, now, SRS_VERSION
      )
    ),
    ...imports.map((entry) =>
      env.DB.prepare(
        `INSERT OR IGNORE INTO imports
           (user_id, word_es, box, due_at, seen, correct, last_seen_at, imported_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        user.sub, entry.wordEs, entry.box, entry.dueAt,
        entry.seen, entry.correct, entry.lastSeenAt, now
      )
    )
  ];
  for (const group of chunk(writes, 40)) await env.DB.batch(group);

  const touched = [...new Set([
    ...reviews.map((entry) => entry.wordEs),
    ...imports.map((entry) => entry.wordEs)
  ])];
  await refold(env.DB, user.sub, touched, now);

  if (body.best) {
    await env.DB.prepare(
      `UPDATE profiles
       SET best_score = MAX(best_score, ?), best_streak = MAX(best_streak, ?), synced_at = ?
       WHERE user_id = ?`
    ).bind(
      Math.max(0, Math.round(finite(body.best.score))),
      Math.max(0, Math.round(finite(body.best.streak))),
      now,
      user.sub
    ).run();
  }

  // Everything that changed since the client last looked. The refold above
  // stamped `updated_at = now` on the pushed words, so they come back too —
  // which is how the client learns what another device already knew.
  const { results: changed } = await env.DB.prepare(
    `SELECT word_es, box, due_at, seen, correct, last_seen_at FROM cards
     WHERE user_id = ? AND updated_at > ?`
  ).bind(user.sub, since).all();

  const cards = {};
  for (const row of changed) {
    cards[row.word_es] = {
      box: row.box,
      dueAt: row.due_at,
      seen: row.seen,
      correct: row.correct,
      lastSeenAt: row.last_seen_at
    };
  }

  const profile = await env.DB
    .prepare('SELECT best_score, best_streak FROM profiles WHERE user_id = ?')
    .bind(user.sub)
    .first();

  return {
    status: 200,
    data: {
      serverTime: now,
      accepted: reviews.map((entry) => entry.id),
      cards,
      best: { score: profile?.best_score ?? 0, streak: profile?.best_streak ?? 0 }
    }
  };
}
