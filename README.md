# Vocabulario 🇪🇸

A Spanish vocabulary game. 1,800 words across 20 categories and 3 stages of
depth, multiple choice, with Leitner-box spaced repetition so the words you
miss come back sooner than the ones you know. Deeper stages are earned. Every
word is spoken by four voices and shown in an example sentence.

**▶ Play it: https://vocabulario.ryan-mapa.dev**

## Run it locally

No build step — it's ES modules straight from the filesystem:

```sh
npm run serve      # the game alone, on :8000
npm run dev        # the game plus the API and a local database, on :8787
```

Use `serve` for anything that doesn't touch accounts; it's faster to start and
needs nothing configured. Use `dev` when you're working on sync.

Answer with the mouse or with <kbd>1</kbd>–<kbd>4</kbd>. When the round is
waiting on you, tap anywhere or press <kbd>Enter</kbd> — or <kbd>1</kbd>–<kbd>4</kbd>
again, since your hand is already there. Rounds are 20 questions, about two
minutes.

## How it plays

- **Decks** — Food, Animals, The Home, Verbs, Travel, The Body, Days &
  Weather, Adjectives, Family & People, Numbers & Money, Work & School,
  City & Places, Clothing, Feelings & Mind, Questions & Connectors, Where
  Things Are, Daily Routine, Health & the Doctor, Technology & Online,
  Nature & Outdoors — or all 1,800 words at once. Nouns carry their article
  so you learn the gender with the word.
- **Stages** — each deck runs Basics → Everyday → Fluent, 30 words apiece.
  Only Basics is open at first; a stage unlocks when the one before it reaches
  60% mastery, so depth is earned rather than dumped on you. The stars beside a
  deck name (`★★☆`) show how far it is open, and the bar under each stage
  button is that stage's mastery. Choosing a deck selects every stage it has
  opened — the deeper ones are the reason to come back to a deck, and being
  handed Basics alone reads as progress lost. They are toggles, so any
  combination can be studied together; the last one on cannot be turned off,
  because a round with no words is not a state worth reaching. Under
  **All words**, a stage counts as open once any single deck has opened it, and
  draws only from the decks that have — a locked deck never leaks its harder
  words into a combined round.
- **Pronunciation** — words with a Spanish prompt carry a speaker button, and
  tapping again cycles four Latin American voices, so hearing a word four times
  means four different mouths rather than one recording repeated. The dots down
  its right side show which voice you are on, read top to bottom, and every word
  starts again at the first — otherwise which voice you got depended on how many
  times you had tapped earlier words. Recall questions have no button at all:
  the Spanish is the answer there, and speaking it would give it away. The
  7,320 clips are generated ahead of time by `tools/tts.mjs` and served as
  static files; `audio/words.json` lists the words that have all four, so a word
  whose synthesis failed loses its button rather than every word losing one.
- **Example sentences** — every word has one, hidden behind a **Show example**
  button under the prompt so the sentence is something you reach for when a word
  is ambiguous, not something you read instead of recalling it. Which half you
  get follows the same rule as the speaker: before you answer, only the sentence
  in the *prompt's* language, since the other one contains the answer. Answer,
  and both appear — *¿Nos trae la cuenta, por favor?* over *Could we get the
  bill, please?* — which is where the pair earns its keep, because it is the
  sentence that separates a restaurant *cuenta* from a bank one. With one open
  the round waits for you rather than moving on by itself, even when you were
  right: the translation only arrives at the moment you answer, and showing it
  for 700ms would take it away from exactly the person who asked to see it.
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
- **The scoreboard** explains itself: point at any tile — or tap it on a phone,
  or tab to it — and a line underneath says what that number means. **Mastered**
  counts the words in the current deck and stage that have reached the top box;
  **mastery** is how far that same set has climbed on average, counting partial
  progress. So mastery moves on every correct answer, and mastered only moves
  when a word finishes.
- **The daily goal** is five completed rounds — a hundred questions, five and a
  half minutes. Only finished rounds count.
- **The streak** is consecutive days that met the goal, and it forgives three
  missed days, and says so on the scoreboard while the window is open rather
  than waiting until the streak is gone. Losing a streak is the most reliable
  way to make someone stop coming back, so a busy week costs nothing. It is
  *derived* from a per-day count of rounds rather than tracked as a number of
  its own — a stored counter drifts across devices and cannot be repaired, a
  derived one cannot. Days are the learner's own local dates, never UTC, so an
  evening session never lands on tomorrow and travel cannot break a streak by
  arithmetic.
- **Pacing** — a correct answer moves on after a moment; a miss waits for you.
  The moment you got something wrong is the one worth sitting with, and no
  timer is a good guess at how long that takes to read. An open example sentence
  waits too, right or wrong.
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
  sentences.js  one example sentence per word, Spanish and English
  examples.js   which of those two may be shown, and when
  srs.js        Leitner boxes, scheduling, mastery
  stages.js     which stages are unlocked, and the pool each one draws from
  goals.js      the daily goal, the day streak, and the grace window
  sound.js      the two notes an answer makes, and whether they are muted
  quiz.js       builds a multiple-choice question
  game.js       round state, scoring, streaks
  storage.js    localStorage persistence, and the queue of unsent answers
  api.js        talking to the server, when there is one
  audio.js      clip URLs, voice cycling, and which words have recordings
  random.js     seedable PRNG + shuffle
worker/         the Cloudflare Worker that serves the app and the API
wrangler.toml   its config, at the root — the static files *are* the root
.assetsignore   what must never be uploaded as a public asset
audio/          7,320 pre-generated clips: 4 voices x 1,830 words
  words.json    the words that have all four, so a gap costs one button
  voices.json   which voice is which, to catch a silent swap upstream
tools/
  tts.mjs       regenerates the clips; reads credentials from .tts.env
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

### Holding the board still

Three rules keep the answer buttons from moving under the thumb, all of them
easy to undo by accident:

- **The word scales, the line box does not.** A long phrase is shrunk to one
  line by `fitPrompt()`, but `.prompt` takes its `line-height` from
  `--prompt-size`, the *unshrunk* size, so a smaller font leaves everything
  below it exactly where it was. Measure after `renderSpeakers()`, not before:
  how much room the word has depends on whether the speaker button is beside it,
  and it is absent in the recall direction.
- **Scroll last.** `bringBoardIntoView()` has to run after the feedback line,
  the regional variant and the example sentence are on the page. Measuring
  first scrolls by the right amount for the board as it stood and then lets the
  new content push the bottom back under the fold. It measures the card's own
  bottom, not the last answer button — everything an answer reveals sits below
  the buttons.
- **The footer follows the card.** It is a sibling of the question card, not a
  child, so it takes `--card-pad` plus the card's 1px border to line its two
  controls up with the answer buttons above them. Change the card's side padding
  through that variable or the two drift apart.

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
progress key, and `vocab.test.js` will fail if it isn't. Never rewrite an `es`
string that has shipped: it silently orphans everyone's progress on that word.

Then give it a sentence in `source/sentences.js`, keyed by that same string:

```js
'la lluvia': ['La lluvia no paró en toda la noche.', 'The rain did not stop all night.'],
```

`sentences.test.js` holds these to the house style — short, unique, and actually
containing the word they illustrate, which is stricter than it sounds because
Spanish stem-changes (*seguir* → *sigue* does not count, so write the sentence
with a form that keeps the root).

Recordings are separate and optional: run `node tools/tts.mjs` to generate the
four voices, or leave it, and the word simply has no speaker button.

## A caveat worth stating plainly

The vocabulary and all 1,800 example sentences were written without a native
speaker's review. The sentences are the riskier half — a wrong word is one wrong
word, but a wrong sentence teaches grammar, register and word order along with
it, and the scheduler will drill it exactly as faithfully as a right one. The
tests here check structure, not idiom. Treat `source/sentences.js` as the first
file to hand a native speaker.
