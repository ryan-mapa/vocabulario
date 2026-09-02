#!/bin/sh
# How far the pronunciation run has got. Counts against the vocabulary as it
# actually is, rather than a number baked in when it was smaller.
cd "$(dirname "$0")/.." || exit 1
want=$(node --input-type=module -e "
import {DECKS} from './source/vocab.js';
const w = DECKS.flatMap(d => d.stages.flat());
const all = new Set([...w.map(x => x.es), ...w.flatMap(x => (x.alt ?? []).map(a => a.es))]);
process.stdout.write(String(all.size * 4));
")
have=$(find audio -name '*.mp3' 2>/dev/null | wc -l | tr -d ' ')
printf '%s of %s clips  (%s%%)  %s\n' "$have" "$want" "$((have * 100 / want))" "$(du -sh audio 2>/dev/null | cut -f1)"
if [ "$have" -lt "$want" ]; then
  mins=$(( (want - have) * 32 / 600 ))
  printf 'about %s minutes left, so around %s\n' "$mins" "$(date -v +${mins}M '+%H:%M')"
fi
