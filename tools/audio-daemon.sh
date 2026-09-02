#!/bin/bash
# Keeps generating pronunciation clips until every word has all four voices,
# then idles, checking periodically for words merged since.
#
#   nohup bash tools/audio-daemon.sh > /dev/null 2>&1 &
#
# Costs no model usage — it is Azure and a shell loop. The point is to clear the
# TTS bottleneck while nothing else is running, so that resuming the vocabulary
# work is not gated on 3.2 seconds a clip.
#
# Progress goes to audio-daemon.status, one short line per pass, so checking on
# it is cheap. Full output goes to audio-daemon.log.

cd "$(dirname "$0")/.." || exit 1
STATUS=/tmp/audio-daemon.status
LOG=/tmp/audio-daemon.log
DEADLINE=$(( $(date +%s) + 8 * 3600 ))

remaining() {
  node --input-type=module -e "
import {DECKS} from './source/vocab.js';
import {audioSlug} from './source/audio.js';
import {existsSync} from 'node:fs';
const w = DECKS.flatMap(d=>d.stages.flat());
process.stdout.write(String(w.filter(x=>![1,2,3,4].every(v=>existsSync(\`audio/\${v}/\${audioSlug(x.es)}.mp3\`))).length));
" 2>/dev/null
}

echo "$(date +%H:%M) daemon started — $(remaining) words unvoiced" > "$STATUS"

while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  before=$(remaining)
  if [ "$before" != "0" ]; then
    node tools/tts.mjs >> "$LOG" 2>&1
    node tools/tts.mjs --manifest >> "$LOG" 2>&1
    after=$(remaining)
    echo "$(date +%H:%M) pass done — $after unvoiced (was $before)" >> "$STATUS"
    # no progress twice running means something is wrong; back off rather than spin
    [ "$after" = "$before" ] && sleep 900
  else
    echo "$(date +%H:%M) all voiced — idling, will recheck for newly merged words" >> "$STATUS"
    sleep 600
  fi
done
echo "$(date +%H:%M) daemon finished its 8-hour window — $(remaining) unvoiced" >> "$STATUS"
