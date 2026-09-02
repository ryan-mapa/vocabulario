-- A round can now draw from more than one stage at once — Basics and Everyday
-- together, rather than one or the other. `stage` alone cannot say that.
--
-- The old column stays and holds the lowest stage of the selection, so anything
-- reading it keeps working; `stages` carries the truth as a sorted list, '0,1'.
--
-- Note that `reviews.stage` needed no change and in fact became more accurate:
-- it now records the stage the *word* belongs to rather than what was selected
-- when it was answered, which is the thing worth knowing.
ALTER TABLE rounds ADD COLUMN stages TEXT;
