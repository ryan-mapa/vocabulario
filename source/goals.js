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
export function streakFrom(counts, today = localDay()) {
  const days = qualifyingDays(counts);
  const roundsToday = counts[today] ?? 0;

  const state = {
    roundsToday,
    goal: DAILY_GOAL,
    hitToday: roundsToday >= DAILY_GOAL,
    current: 0,
    longest: 0,
    graceDaysLeft: GRACE_DAYS
  };
  if (days.length === 0) return state;

  // Walk forward, restarting whenever two qualifying days are too far apart.
  let run = 0;
  let longest = 0;
  for (const [index, day] of days.entries()) {
    run = index > 0 && daysBetween(days[index - 1], day) <= MAX_GAP ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const last = days[days.length - 1];
  const sinceLast = daysBetween(last, today);

  state.longest = longest;
  state.current = sinceLast <= MAX_GAP ? run : 0;
  // How many more days can pass before the streak is gone. Full again the
  // moment today qualifies.
  state.graceDaysLeft = Math.max(0, GRACE_DAYS - Math.max(0, sinceLast));
  return state;
}

/** Record one completed round against a day, returning a new counts map. */
export function recordRound(counts, today = localDay()) {
  return { ...counts, [today]: (counts[today] ?? 0) + 1 };
}

/** 0..1 progress toward today's goal, for the meter. */
export function goalProgress(counts, today = localDay()) {
  return Math.min(1, (counts[today] ?? 0) / DAILY_GOAL);
}
