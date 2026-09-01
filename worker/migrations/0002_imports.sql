-- The starting card for a word, for someone who had progress in a browser
-- before they had an account.
--
-- This is deliberately not written into `reviews`. The browser never recorded
-- how that progress was earned — only where it ended up — and inventing a
-- plausible review history to match would be a lie that every statistic built
-- on the log would then repeat. A seed is honest about being a snapshot.
--
-- The fold reads it as its starting card and applies real reviews on top, so
-- `cards` stays fully derivable: imports + reviews in, card out.
CREATE TABLE IF NOT EXISTS imports (
    user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    word_es      TEXT NOT NULL,
    box          INTEGER NOT NULL,
    due_at       INTEGER NOT NULL,
    seen         INTEGER NOT NULL,
    correct      INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    imported_at  INTEGER NOT NULL,
    PRIMARY KEY (user_id, word_es)
);
