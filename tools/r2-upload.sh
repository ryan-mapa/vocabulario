#!/bin/bash
# Uploads the clips to R2, skipping what is already there.
#
#   bash tools/r2-upload.sh          upload everything missing
#   bash tools/r2-upload.sh --check  just report what is missing
#
# Every wrangler r2 call needs --remote. Without it wrangler writes to a LOCAL
# simulator and reports "Upload complete" for objects that never leave the
# machine, which is exactly as convincing as a real upload and completely wrong.
#
# Resumable: it records what it has sent, so an interrupted run costs nothing to
# repeat. wrangler sends one object per invocation, so this runs several in
# parallel — too many and the API rate-limits.

cd "$(dirname "$0")/.." || exit 1
BUCKET=vocabulario-audio
PARALLEL=4   # 8 drove the failure rate from 3% to 16% under rate limiting
STATUS=/tmp/r2-upload.status

# wrangler 4 has no `r2 object list`, so progress is tracked in a local ledger
# of keys confirmed uploaded. Delete it to force a full re-upload.
DONE=/tmp/r2-done.txt
touch "$DONE"
sort -u "$DONE" -o "$DONE"
cp "$DONE" /tmp/r2-have.txt
HAVE=$(wc -l < /tmp/r2-have.txt | tr -d ' ')

find audio -name '*.mp3' | sort > /tmp/r2-want.txt
WANT=$(wc -l < /tmp/r2-want.txt | tr -d ' ')
comm -23 /tmp/r2-want.txt /tmp/r2-have.txt > /tmp/r2-todo.txt
TODO=$(wc -l < /tmp/r2-todo.txt | tr -d ' ')

echo "$(date +%H:%M) bucket has $HAVE, repo has $WANT, to upload: $TODO" | tee "$STATUS"
[ "$1" = "--check" ] && exit 0
[ "$TODO" = "0" ] && { echo "nothing to do"; exit 0; }

export BUCKET
upload() {
  if npx wrangler r2 object put "$BUCKET/$1" --file "$1" --content-type audio/mpeg --remote >/dev/null 2>&1; then
    echo "$1" >> /tmp/r2-done.txt
  else
    echo "$1" >> /tmp/r2-failed.txt
  fi
}
export -f upload
rm -f /tmp/r2-failed.txt

xargs -P "$PARALLEL" -I{} bash -c 'upload "$@"' _ {} < /tmp/r2-todo.txt

FAILED=$(wc -l < /tmp/r2-failed.txt 2>/dev/null | tr -d ' ' || echo 0)
echo "$(date +%H:%M) done — ${FAILED:-0} failures (re-run to retry them)" | tee -a "$STATUS"
