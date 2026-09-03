# Autonomous resume — written 20:46, to run at ~00:51

## Goal
Finish the 20 original decks. Then, only if budget clearly allows, start the
five new categories. Deploy at every checkpoint so nothing is stranded.

## What is left

| deck | now | target |
|---|---|---|
| emociones | 30/30/30 | 50/50/50 |
| rutina | 30/30/30 | 50/50/50 |
| tiempo | 30/30/30 | 40/50/50 |
| numeros | 30/30/30 | 40/50/50 |
| preguntas | 30/30/30 | 40/40/50 |
| lugar | 40/30/30 | 40/50/50 |

`node tools/status.mjs` is the source of truth — trust it over this table.

## The loop, per deck

```sh
node tools/brief.mjs <deck> > staging/<deck>.brief.md   # JUST IN TIME, never in advance
#   agent writes staging/<deck>.json
node tools/check-batch.mjs staging/<deck>.json --write
node tools/merge-batch.mjs staging/<deck>.clean.json
npx vitest run && git add -A && git commit
```

Briefs must be generated immediately before each agent runs. They embed the
exclusion list, which grows with every merge; a brief made in advance sends
agents after words that are already taken.

## Rules learned the hard way

- **Sonnet only.** Haiku passes every mechanical rule and still gets the tier
  wrong — it filled a Fluent stage with fabric jargon twice, and a Basics stage
  with `la incertidumbre` and `la agitación`. The validator cannot catch taste.
- **Never merge without running the suite.** It caught two things the validator
  let through: an audio-slug collision, and a game test that had silently
  depended on deck size.
- **Take short returns.** If a stage comes back under target, trim to the
  nearest 10 and move on. A repair round costs more than the words are worth —
  City & Places cost 140k and still came back short; it is 40/40/40 now and that
  is the honest size.
- **Closed sets are genuinely small.** tiempo Basics is seven days plus twelve
  months; numeros is 0–20; preguntas is function words. Expect 40s, not 50s, and
  accept them.
- **Deploy at each checkpoint.** Spend ran out twice today mid-batch. A deck
  merged and deployed cannot be lost.

## Audio
The daemon handles it — it rechecks every ten minutes and voices whatever has
merged. It runs until ~23:41, so RESTART IT on resume:

```sh
pgrep -f audio-daemon >/dev/null || nohup bash tools/audio-daemon.sh > /dev/null 2>&1 &
```

Audio costs no model usage. Never let it gate a deploy: `audio/words.json` lists
only words with all four voices, so an unvoiced word simply has no speaker
button.

## Budget
Briefs are now 3.5–5.4k tokens instead of 10.2k, and agents are told not to
verify against the list. Expect runs nearer 40–60k than the 90–140k seen today.
If a run still costs >80k, stop and report rather than pressing on.
