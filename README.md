# Vocabulario 🇪🇸

A Spanish vocabulary game. 630 words across 14 categories and 3 stages of
depth, multiple choice, with Leitner-box spaced repetition so the words you
miss come back sooner than the ones you know. Deeper stages are earned.

**▶ Play it: https://vocabulario.ryan-mapa.dev**

## Run it locally

No build step — it's ES modules straight from the filesystem:

```sh
npm run serve      # the game alone, on :8000
npm run dev        # the game plus the API and a local database, on :8787
```

Use `serve` for anything that doesn't touch accounts; it's faster to start and
needs nothing configured. Use `dev` when you're working on sync.

Answer with the mouse or with <kbd>1</kbd>–<kbd>4</kbd>; <kbd>Enter</kbd> skips
ahead. Rounds are 20 questions, about two minutes.

## How it plays

- **Decks** — Food, Animals, The Home, Verbs, Travel, The Body, Days &
  Weather, Adjectives, Family & People, Numbers & Money, Work & School,
  City & Places, Clothing, Feelings & Mind — or all 630 words at once. Nouns
  carry their article so you learn the gender with the word.
- **Stages** — each deck runs Basics → Everyday → Fluent, 15 words apiece.
  Only Basics is open at first; a stage unlocks when the one before it reaches
  60% mastery, so depth is earned rather than dumped on you. The stars beside a
  deck name (`★★☆`) show how far it is open, and the bar under each stage
  button is that stage's mastery. Under **All words**, a stage counts as open
  once any single deck has opened it, and draws only from the decks that have
  — a locked deck never leaks its harder words into a combined round.
- **Direction** — a round is **Mixed** by default: ten questions of recognition
  (Español → English) and ten of recall (English → Español), interleaved rather
  than run as two blocks. Mixed practice retains better than blocked, and a
  round that changes character halfway reads as two games stuck together.
  Which words get which is weighted by how well you know them: recall is the
  direction that actually proves you know a word, so its odds climb from about
  20% for a word you have just met to 80% for one you have mastered. The round
  stays exactly half and half — the weighting decides which direction a word
  *prefers*, and a running budget decides what is still available. Either
  direction can also be drilled on its own.
- **Regional variants** — words are Latin American Spanish with US English
  glosses. Where a word changes across the Spanish-speaking world, the answer
  is followed by a note: *la fresa — also la frutilla (Southern Cone)*. It
  appears only after you answer, because in the English → Spanish direction it
  would otherwise give the answer away.
- **The daily goal** is five completed rounds — five and a half minutes. Not an
  arbitrary number: at five rounds a day, a 210-word stage goes from nothing to
  203 words mastered in a month. Only finished rounds count.
- **The streak** is consecutive days that met the goal, and it forgives three
  missed days, and says so on the scoreboard while the window is open rather
  than waiting until the streak is gone. Losing a streak is the most reliable
  way to make someone stop coming back, so a busy week costs nothing. It is *derived* from a per-day
  count of rounds rather than tracked as a number of its own — a stored counter
  drifts across devices and cannot be repaired, a derived one cannot. Days are
  the learner's own local dates, never UTC, so an evening session never lands on
  tomorrow and travel cannot break a streak by arithmetic.
- **Spaced repetition** — every word sits in one of 5 boxes. Get it right and it
  climbs a box and drops out of rotation for a while — 1 minute, 10 minutes,
  then 1, 4 and 14 days. Get it wrong and it falls straight back to box 0. The
  first two intervals are short enough to bring a shaky word back within the
  same sitting; the rest are the real spacing. Box 5 is "mastered", and the
  mastery stat is how far the whole deck has climbed. When nothing is due the
  round draws from everything rather than turning you away.
- **Progress** persists in `localStorage`, keyed by the Spanish word — so
  learning *la manzana* in Food also counts under All words. Unlock state is
  *derived* from that same card map rather than stored, so there is no second
  source of truth to keep in sync, and someone who already knows a deck finds
  its deeper stages open on arrival.
- **Move progress** hands you a code holding your whole card map. `localStorage`
  is per-origin, so without it progress would be stranded at whichever address
  you happened to play on. Paste the code anywhere else this app runs.
- **Signing in is optional**, and only ever adds. Signed out, the game is
  exactly what it was — everything lives in this browser. Signing in with Google
  makes your progress follow you between devices, and carries whatever this
  browser had already earned across on the first sync. **Account** in the header
  signs you out, or deletes everything — asked twice, the second time by typing
  the word.

## Layout

```
index.html      markup
privacy.html    what is stored, and what is not
terms.html      the short version: free, no guarantees
style.css       styles
main.js         DOM wiring — the only file that touches the document
source/
  vocab.js      the word decks, three stages each
  srs.js        Leitner boxes, scheduling, mastery
  stages.js     which stages are unlocked, and the pool each one draws from
  goals.js      the daily goal, the day streak, and the grace window
  quiz.js       builds a multiple-choice question
  game.js       round state, scoring, streaks
  storage.js    localStorage persistence, and the queue of unsent answers
  api.js        talking to the server, when there is one
  random.js     seedable PRNG + shuffle
worker/         the Cloudflare Worker that serves the app and the API
wrangler.toml   its config, at the root — the static files *are* the root
.assetsignore   what must never be uploaded as a public asset
assets/
  logo.svg      the V monogram, bare — for the header and anywhere on dark
  icon.svg      the same mark as a filled badge — favicon and app icon
  icon-*.png    raster copies; Google's OAuth branding page rejects SVG
test/           vitest suite over the logic modules
```

Everything under `source/` is DOM-free and pure, which is what makes it
testable — `main.js` is the only thing that knows a browser exists. `source/`
is also the boundary the server shares: the Worker imports `srs.js` directly, so
the browser and the server can never drift about what a review history means.

The wordmark glyph is a V drawn as a chevron with the acute accent Spanish uses
to mark stress. The accent runs parallel to the V's right arm — the same stroke
in miniature — which is what stops it reading as something stuck on afterwards.
The badge exists because strokes on a transparent ground turn to mush at 16px,
so the favicon inverts: solid field, glyph knocked out. The header copy is
inlined in `index.html` rather than linked, so it survives into the single-file
build, which ships with no assets beside it.

## Accounts and sync

The app runs from a Cloudflare Worker that serves the static files *and* the
API, so the page and the API share one origin: no CORS, and the session lives
in an HttpOnly cookie no script can read.

Progress is stored as an append-only log of answers, with each card derived by
folding its own history. That is what makes two devices merge without a
conflict — the log is a set union and the fold is deterministic — and it means
changing the scheduling algorithm later is a re-fold rather than a reset.

[`worker/README.md`](worker/README.md) covers the schema, the sync contract, and
how to deploy it.

## Tests

```sh
npm install
npm test        # or: npm run watch
```

## Adding words

Append to the relevant deck in `source/vocab.js`:

```js
{ es: 'la lluvia', en: 'rain' }
```

Keep the article on nouns, and keep `es` unique across all decks — it's the
progress key, and `vocab.test.js` will fail if it isn't.
