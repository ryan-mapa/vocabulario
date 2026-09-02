# If something goes wrong

The expansion is designed so that nothing in flight can cost more than one
deck's worth of work. Four things make that true.

**Staging is durable.** Agent output lands in `staging/<deck>.json` and stays
there. It is gitignored, and also in `.assetsignore` — wrangler uploads from
disk rather than from git, so gitignoring it alone would still publish it. If a
merge goes wrong, or a session dies, the writing is not lost: re-run the check
and the merge.

**One commit per merged deck.** Rolling back a bad deck is `git revert` of a
single commit, and nothing else moves.

**Merges refuse to run twice.** `merge-batch.mjs` compares the batch against the
corpus first and exits if the words are already there. Re-running a merge you
are unsure about is safe — it will tell you it is already done rather than
silently doubling the deck.

**Every merge snapshots first.** The two files it edits are copied to
`staging/.backup/` with a timestamp before anything is written.

## Where am I?

```sh
node tools/status.mjs
```

Derived from the corpus, not from a ledger — word counts cannot drift, because
they are the work. It reports every deck as `not started`, `written — needs
check-batch`, `validated — ready to merge`, or `done`.

## The loop, per deck

```sh
node tools/brief.mjs <deck> > staging/<deck>.brief.md   # hand to the agent
#   ... agent writes staging/<deck>.json ...
node tools/check-batch.mjs staging/<deck>.json --write  # validates, trims, cleans
node tools/merge-batch.mjs staging/<deck>.clean.json    # snapshots, then merges
npx vitest run                                          # the real gate
git add -A && git commit                                # one deck per commit
```

If `check-batch` rejects entries it prints a repair note listing only the
failures. Paste that back — never the brief again.

If `vitest` fails after a merge, the merge is at fault, not the suite:

```sh
git checkout source/vocab.js source/sentences.js   # or restore from staging/.backup
```

The batch file survives, so nothing is lost but the merge.
