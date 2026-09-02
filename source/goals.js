// The daily goal and the day streak.
//
// A day here is always the *learner's* local day, never UTC. Someone playing at
// nine in the evening in California is having a Tuesday; a server recording UTC
// would file it under Wednesday and break their streak while they were doing
// everything right. So days are stamped client-side as 'YYYY-MM-DD' local, and
// everything downstream — including the server — treats that string as opaque.
//
// That also makes travel harmless. Cross a date line and you might get a short
// day or a long one, but you cannot lose a streak to arithmetic.

/** Completed rounds needed to call a day done. */
export const DAILY_GOAL = 5;

/**
 * Missed days a streak survives. Three is deliberately generous: losing a
 * streak is the single most reliable way to make someone stop coming back, and
 * a streak that punishes a busy week is not motivating anyone.
 */
export const GRACE_DAYS = 3;

/**
 * With three missed days forgiven, two days that both hit the goal can be up to
 * four apart and still belong to the same streak.
 */
const MAX_GAP = GRACE_DAYS + 1;

/**
 * Streak guard: a hold the learner puts on their own streak, for a holiday or
 * any other stretch they know they will miss.
 *
 * Only ever engaged by hand. Nothing turns it on for you, so a streak that
 * survives is one somebody decided to protect — which is the only way the
 * number keeps meaning anything.
 *
 * A string rather than a flag, because "paused" is unlikely to be the last
 * state this ever needs — the fold below reads whatever state an event names.
 */
export const GUARD = { ACTIVE: 'active', GUARDED: 'guarded' };

/**
 * Guard events oldest first.
 *
 * `day` decides which gaps a guard covers, but two changes on the same day
 * need `at` to say which came last — pausing and then resuming an hour later
 * must not fold to "paused". Id is the final tiebreak so two devices holding
 * the same events always agree, never because it means anything.
 */
function orderedEvents(events) {
  return [...events]
    .filter((event) => event && typeof event.day === 'string' && event.state)
    .sort(
      (a, b) =>
        (a.day < b.day ? -1 : a.day > b.day ? 1 : 0) ||
        (a.at ?? 0) - (b.at ?? 0) ||
        (String(a.id) < String(b.id) ? -1 : 1)
    );
}

/** The manually chosen state as of a day — the last event on or before it. */
export function manualGuardOn(events, day) {
  let state = GUARD.ACTIVE;
  for (const event of orderedEvents(events)) {
    if (event.day > day) break;
    state = event.state;
  }
  return state;
}

/** Was the guard manually on at any point across a run of days? */
function manuallyGuardedBetween(events, fromDay, toDay) {
  if (manualGuardOn(events, fromDay) === GUARD.GUARDED) return true;
  return orderedEvents(events).some(
    (event) => event.day > fromDay && event.day <= toDay && event.state === GUARD.GUARDED
  );
}

const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' in local time. Not toISOString — that is UTC, which is the bug. */
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole days from one 'YYYY-MM-DD' to another. Parsed as UTC noon so that a
 *  daylight-saving shift in between cannot round the difference to 0 or 2. */
export function daysBetween(from, to) {
  const at = (day) => {
    const [y, m, d] = day.split('-').map(Number);
    return Date.UTC(y, m - 1, d, 12);
  };
  return Math.round((at(to) - at(from)) / 86_400_000);
}

/** Days that met the goal, oldest first. */
function qualifyingDays(counts) {
  return Object.entries(counts)
    .filter(([, rounds]) => rounds >= DAILY_GOAL)
    .map(([day]) => day)
    .sort();
}

/**
 * Streak state from a map of `{ 'YYYY-MM-DD': roundsCompleted }`.
 *
 * `current` is the run ending at the most recent qualifying day, and stays
 * alive while today is still within reach of it — so a streak shows as intact
 * during the grace window rather than vanishing and reappearing when the day
 * is finally completed.
 */
export function streakFrom(counts, today = localDay(), events = []) {
  const days = qualifyingDays(counts);
  const roundsToday = counts[today] ?? 0;
  const manual = manualGuardOn(events, today);

  const state = {
    roundsToday,
    goal: DAILY_GOAL,
    hitToday: roundsToday >= DAILY_GOAL,
    current: 0,
    longest: 0,
    graceDaysLeft: GRACE_DAYS,
    guard: manual
  };
  if (days.length === 0) return state;

  // Walking forward, a gap either falls inside the grace window, was covered by
  // a guard somebody had turned on, or ends the run.
  let run = 0;
  let longest = 0;

  const bridges = (from, to) =>
    daysBetween(from, to) <= MAX_GAP || manuallyGuardedBetween(events, from, to);

  for (const [index, day] of days.entries()) {
    run = index > 0 && bridges(days[index - 1], day) ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const last = days[days.length - 1];
  const sinceLast = daysBetween(last, today);
  state.longest = longest;
  state.graceDaysLeft = Math.max(0, GRACE_DAYS - Math.max(0, sinceLast));

  if (sinceLast <= MAX_GAP || bridges(last, today)) state.current = run;
  return state;
}

/** `day` shifted by a whole number of days, as 'YYYY-MM-DD'. */
export function addDays(day, count) {
  const [y, m, d] = day.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + count, 12));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** A manual guard change, ready to store and sync. */
export function guardEvent(state, day = localDay(), id = null, at = Date.now()) {
  return {
    id: id ?? `g-${day}-${Math.random().toString(36).slice(2, 10)}`,
    day,
    at,
    state,
    source: 'manual'
  };
}

/** Record one completed round against a day, returning a new counts map. */
export function recordRound(counts, today = localDay()) {
  return { ...counts, [today]: (counts[today] ?? 0) + 1 };
}

/** 0..1 progress toward today's goal, for the meter. */
export function goalProgress(counts, today = localDay()) {
  return Math.min(1, (counts[today] ?? 0) / DAILY_GOAL);
}
