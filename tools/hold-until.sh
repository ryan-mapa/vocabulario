#!/bin/bash
# Keeps this session's context warm until a wall-clock time, then exits so the
# harness notifies Claude and work can resume.
#
#   bash tools/hold-until.sh 19:35
#
# Every fifteen minutes it appends one line to /tmp/hold.status with the audio
# daemon's progress, so the wait is visible without asking anything of the model.

cd "$(dirname "$0")/.." || exit 1
TARGET="${1:-19:35}"
STATUS=/tmp/hold.status
until_ts=$(date -j -f "%Y-%m-%d %H:%M" "$(date +%Y-%m-%d) $TARGET" +%s 2>/dev/null)
[ -z "$until_ts" ] && { echo "bad time: $TARGET"; exit 1; }
# A target earlier than now means tomorrow. Without this, asking at 20:47 to hold
# until 00:51 parses as today's 00:51, which is already past, and the script
# exits immediately having held for nothing.
[ "$until_ts" -le "$(date +%s)" ] && until_ts=$(( until_ts + 86400 ))

unvoiced() {
  node --input-type=module -e "
import {DECKS} from './source/vocab.js';
import {audioSlug} from './source/audio.js';
import {existsSync} from 'node:fs';
const w = DECKS.flatMap(d=>d.stages.flat());
process.stdout.write(String(w.filter(x=>![1,2,3,4].every(v=>existsSync(\`audio/\${v}/\${audioSlug(x.es)}.mp3\`))).length));
" 2>/dev/null
}

echo "$(date +%H:%M) holding until $TARGET — $(unvoiced) words unvoiced" > "$STATUS"
while [ "$(date +%s)" -lt "$until_ts" ]; do
  left=$(( (until_ts - $(date +%s)) / 60 ))
  echo "$(date +%H:%M) ${left}m to go — $(unvoiced) unvoiced, daemon $(pgrep -f audio-daemon >/dev/null && echo up || echo DOWN), caffeinate $(pgrep -f caffeinate >/dev/null && echo up || echo DOWN)" >> "$STATUS"
  sleep 900
done
echo "$(date +%H:%M) TIME REACHED — $(unvoiced) words unvoiced" >> "$STATUS"
