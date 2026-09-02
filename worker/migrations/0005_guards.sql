-- Manual streak-guard changes: pausing for a holiday, and resuming after.
--
-- A log rather than a state column on `profiles`, for the same reason cards are
-- a fold over reviews. A column is something two devices can disagree about and
-- nothing can repair; a log keyed by a client-made id merges by set union and
-- folds to one answer wherever it is read.
--
-- Automatic guards are deliberately absent. One has to engage on a day the
-- learner never opened the app, so it cannot be a recorded event — it is
-- derived from the pattern of missed days instead.
--
-- `state` is text, not a flag, so a state this feature has not thought of yet
-- costs a value rather than a migration.
CREATE TABLE IF NOT EXISTS guards (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    day        TEXT NOT NULL,
    state      TEXT NOT NULL,
    source     TEXT NOT NULL DEFAULT 'manual',
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guards_user ON guards (user_id, day);
