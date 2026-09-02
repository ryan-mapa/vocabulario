import { describe, it, expect } from 'vitest';
import {
  DAILY_GOAL,
  GRACE_DAYS,
  GUARD,
  guardEvent,
  manualGuardOn,
  addDays,
  localDay,
  daysBetween,
  streakFrom,
  recordRound,
  goalProgress
} from '../source/goals.js';

/** Counts map from a list of [day, rounds] pairs. */
const counts = (...pairs) => Object.fromEntries(pairs);
const hit = (day) => [day, DAILY_GOAL];
const short = (day) => [day, DAILY_GOAL - 1];

describe('local days', () => {
  // The bug this exists to prevent: toISOString() is UTC, so an evening in the
  // Americas files under tomorrow and silently breaks the streak.
  it('uses the local calendar date, not UTC', () => {
    const lateEvening = new Date(2026, 8, 1, 23, 30); // 1 Sept, local
    expect(localDay(lateEvening)).toBe('2026-09-01');
    const earlyMorning = new Date(2026, 8, 2, 0, 30);
    expect(localDay(earlyMorning)).toBe('2026-09-02');
  });

  it('pads months and days', () => {
    expect(localDay(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('counts whole days between dates, across months and years', () => {
    expect(daysBetween('2026-09-01', '2026-09-01')).toBe(0);
    expect(daysBetween('2026-09-01', '2026-09-02')).toBe(1);
    expect(daysBetween('2026-08-30', '2026-09-02')).toBe(3);
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2); // leap year
  });
});

describe('today', () => {
  it('reports progress toward the goal', () => {
    expect(goalProgress(counts(['2026-09-01', 0]), '2026-09-01')).toBe(0);
    expect(goalProgress(counts(['2026-09-01', 2]), '2026-09-01')).toBe(0.4);
    expect(goalProgress(counts(hit('2026-09-01')), '2026-09-01')).toBe(1);
  });

  it('does not run past 100% on an unusually keen day', () => {
    expect(goalProgress(counts(['2026-09-01', 40]), '2026-09-01')).toBe(1);
  });

  it('counts a completed round against today', () => {
    expect(recordRound({}, '2026-09-01')).toEqual({ '2026-09-01': 1 });
    expect(recordRound({ '2026-09-01': 4 }, '2026-09-01')['2026-09-01']).toBe(5);
  });

  it('says whether the goal is met', () => {
    expect(streakFrom(counts(short('2026-09-01')), '2026-09-01').hitToday).toBe(false);
    expect(streakFrom(counts(hit('2026-09-01')), '2026-09-01').hitToday).toBe(true);
  });
});

describe('the streak', () => {
  it('is zero with nothing played', () => {
    expect(streakFrom({}, '2026-09-01')).toMatchObject({ current: 0, longest: 0 });
  });

  it('does not count a day that fell short of the goal', () => {
    expect(streakFrom(counts(short('2026-09-01')), '2026-09-01').current).toBe(0);
  });

  it('counts consecutive days that met it', () => {
    const played = counts(hit('2026-08-30'), hit('2026-08-31'), hit('2026-09-01'));
    expect(streakFrom(played, '2026-09-01').current).toBe(3);
  });

  it('holds while today is still unfinished', () => {
    // Yesterday counted; today has not been played yet. The streak should read
    // as intact rather than vanishing and reappearing on the fifth round.
    const played = counts(hit('2026-08-31'), hit('2026-09-01'));
    const state = streakFrom(played, '2026-09-02');
    expect(state.current).toBe(2);
    expect(state.hitToday).toBe(false);
  });
});

describe(`the ${GRACE_DAYS}-day grace`, () => {
  const base = [hit('2026-09-01'), hit('2026-09-02'), hit('2026-09-03')];

  it('survives exactly three missed days', () => {
    // 3rd, then 7th: the 4th, 5th and 6th were missed.
    const played = counts(...base, hit('2026-09-07'));
    expect(streakFrom(played, '2026-09-07').current).toBe(4);
  });

  it('breaks on the fourth, unless a guard was turned on', () => {
    const played = counts(...base, hit('2026-09-08'));
    expect(streakFrom(played, '2026-09-08').current).toBe(1);

    const guarded = [guardEvent(GUARD.GUARDED, '2026-09-04', 'g')];
    expect(streakFrom(played, '2026-09-08', guarded).current).toBe(4);
  });

  it('keeps showing the streak during the grace window', () => {
    const played = counts(...base);
    expect(streakFrom(played, '2026-09-05').current).toBe(3); // two days missed so far
    expect(streakFrom(played, '2026-09-06').current).toBe(3); // three, still savable
  });

  it('drops it once the window has passed, with no guard on', () => {
    const state = streakFrom(counts(...base), '2026-09-09');
    expect(state.current).toBe(0);
    expect(state.guard).toBe(GUARD.ACTIVE);
  });

  it('reports how much grace is left, and refills it on a completed day', () => {
    const played = counts(...base);
    expect(streakFrom(played, '2026-09-03').graceDaysLeft).toBe(GRACE_DAYS);
    expect(streakFrom(played, '2026-09-04').graceDaysLeft).toBe(GRACE_DAYS - 1);
    expect(streakFrom(played, '2026-09-06').graceDaysLeft).toBe(0);
  });
});

describe('the longest streak', () => {
  it('remembers a run that has since been broken', () => {
    const played = counts(
      hit('2026-08-01'), hit('2026-08-02'), hit('2026-08-03'), hit('2026-08-04'),
      hit('2026-09-01')  // a month away, and nothing was guarding it
    );
    const state = streakFrom(played, '2026-09-01');
    expect(state.current).toBe(1);
    expect(state.longest).toBe(4);
  });

  it('is never smaller than the current one', () => {
    const played = counts(hit('2026-08-31'), hit('2026-09-01'));
    const state = streakFrom(played, '2026-09-01');
    expect(state.longest).toBeGreaterThanOrEqual(state.current);
  });

  it('reads days in order however the map was built', () => {
    const jumbled = counts(hit('2026-09-03'), hit('2026-09-01'), hit('2026-09-02'));
    expect(streakFrom(jumbled, '2026-09-03').current).toBe(3);
  });
});

// Nothing engages the guard on its own. A streak that survives an absence is
// one somebody decided to protect, which is what keeps the number meaning
// something.
describe('the streak guard', () => {
  const run = [hit('2026-09-01'), hit('2026-09-02'), hit('2026-09-03')];

  it('is off unless it was turned on', () => {
    expect(streakFrom(counts(...run), '2026-09-03').guard).toBe(GUARD.ACTIVE);
    expect(streakFrom(counts(...run), '2026-09-30').guard).toBe(GUARD.ACTIVE);
  });

  it('does not save a streak nobody protected', () => {
    expect(streakFrom(counts(...run), '2026-09-30').current).toBe(0);
  });

  it('holds however long the absence runs, once it is on', () => {
    const on = [guardEvent(GUARD.GUARDED, '2026-09-04', 'g')];
    expect(streakFrom(counts(...run), '2027-06-01', on).current).toBe(3);
  });

  it('stops holding from the day it is turned off', () => {
    const away = [guardEvent(GUARD.GUARDED, '2026-09-04', 'a'), guardEvent(GUARD.ACTIVE, '2026-09-06', 'b')];
    // Guarded across the gap, so the run is intact when they return.
    expect(streakFrom(counts(...run, hit('2026-09-06')), '2026-09-06', away).current).toBe(4);
  });
});

describe('pausing by hand', () => {
  const run = [hit('2026-09-01'), hit('2026-09-02')];
  const paused = (day) => guardEvent(GUARD.GUARDED, day, 'a');
  const resumed = (day) => guardEvent(GUARD.ACTIVE, day, 'b');

  it('reports the state someone chose', () => {
    expect(manualGuardOn([], '2026-09-05')).toBe(GUARD.ACTIVE);
    expect(manualGuardOn([paused('2026-09-03')], '2026-09-05')).toBe(GUARD.GUARDED);
    expect(manualGuardOn([paused('2026-09-03'), resumed('2026-09-04')], '2026-09-05')).toBe(GUARD.ACTIVE);
  });

  it('ignores an event that has not taken effect yet', () => {
    expect(manualGuardOn([paused('2026-09-10')], '2026-09-05')).toBe(GUARD.ACTIVE);
  });

  it('carries a streak through a holiday', () => {
    const away = [paused('2026-09-03'), resumed('2026-09-25')];
    const state = streakFrom(counts(...run), '2026-09-24', away);
    expect(state.current).toBe(2);
    expect(state.guard).toBe(GUARD.GUARDED);
  });

  // Once it is off, the streak is on its own again — a later lapse breaks it.
  it('protects nothing after it is turned off', () => {
    const away = [paused('2026-09-03'), resumed('2026-09-25')];
    const after = counts(...run, hit('2026-09-25'));
    expect(streakFrom(after, '2026-09-25', away).current).toBe(3);
    expect(streakFrom(after, '2026-10-05', away).current).toBe(0);
  });

  it('orders events by day, then by id, so two devices agree', () => {
    const sameDay = [guardEvent(GUARD.ACTIVE, '2026-09-03', 'z'), guardEvent(GUARD.GUARDED, '2026-09-03', 'a')];
    expect(manualGuardOn(sameDay, '2026-09-05')).toBe(manualGuardOn([...sameDay].reverse(), '2026-09-05'));
  });

  it('shifts days across month and year ends', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01');
  });
});

// The bug this prevents: pausing and then resuming an hour later folded to
// whichever id happened to sort first, because both events share a day.
describe('two guard changes on one day', () => {
  const at = (state, at, id) => ({ id, day: '2026-09-04', at, state, source: 'manual' });

  it('takes the later one, whatever the ids are', () => {
    const events = [at(GUARD.GUARDED, 1000, 'zzz'), at(GUARD.ACTIVE, 2000, 'aaa')];
    expect(manualGuardOn(events, '2026-09-04')).toBe(GUARD.ACTIVE);
    expect(manualGuardOn([...events].reverse(), '2026-09-04')).toBe(GUARD.ACTIVE);
  });

  it('and the other way round', () => {
    const events = [at(GUARD.ACTIVE, 1000, 'aaa'), at(GUARD.GUARDED, 2000, 'zzz')];
    expect(manualGuardOn(events, '2026-09-04')).toBe(GUARD.GUARDED);
    expect(manualGuardOn([...events].reverse(), '2026-09-04')).toBe(GUARD.GUARDED);
  });

  it('falls back to the id only when the moment is identical, so devices agree', () => {
    const tied = [at(GUARD.GUARDED, 1000, 'b'), at(GUARD.ACTIVE, 1000, 'a')];
    expect(manualGuardOn(tied, '2026-09-04')).toBe(manualGuardOn([...tied].reverse(), '2026-09-04'));
  });

  it('treats an event with no moment as the oldest, not the newest', () => {
    const mixed = [{ id: 'old', day: '2026-09-04', state: GUARD.GUARDED }, at(GUARD.ACTIVE, 5, 'new')];
    expect(manualGuardOn(mixed, '2026-09-04')).toBe(GUARD.ACTIVE);
  });
});
