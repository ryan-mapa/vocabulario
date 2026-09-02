-- A round belongs to the learner's *local* day, not to a UTC one.
--
-- Someone playing at nine in the evening in California is having a Tuesday; a
-- streak computed from `ended_at` in UTC would file it under Wednesday and
-- break their streak while they were doing everything right. The client stamps
-- its own 'YYYY-MM-DD' and the server treats that string as opaque, which also
-- makes travelling across time zones harmless.
ALTER TABLE rounds ADD COLUMN local_day TEXT;

-- The daily counts behind the streak.
CREATE INDEX IF NOT EXISTS idx_rounds_day ON rounds (user_id, local_day);

-- `score` and `best_streak` are left in place but no longer written. Points and
-- the in-round streak were retired in favour of the daily goal; dropping the
-- columns would rewrite the table for nothing.
