#!/bin/sh
# How far the pronunciation run has got.
cd "$(dirname "$0")/.." || exit 1
have=$(find audio -name '*.mp3' 2>/dev/null | wc -l | tr -d ' ')
want=$((660 * 4))
printf '%s of %s clips  (%s%%)  %s\n' "$have" "$want" "$((have * 100 / want))" "$(du -sh audio 2>/dev/null | cut -f1)"
[ "$have" -lt "$want" ] && printf 'about %s minutes left at the free tier pace\n' "$(( (want - have) * 32 / 600 ))"
