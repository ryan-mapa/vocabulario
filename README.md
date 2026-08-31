# Vocabulario 🇪🇸

A Spanish vocabulary game. 630 words across 14 categories and 3 stages of
depth, multiple choice, with Leitner-box spaced repetition so the words you
miss come back sooner than the ones you know. Deeper stages are earned.

**▶ Play it: https://ryan-mapa.github.io/vocabulario/**

## Run it locally

No build step — it's ES modules straight from the filesystem:

```sh
npm run serve      # python3 -m http.server 8000
open http://localhost:8000
```

Answer with the mouse or with <kbd>1</kbd>–<kbd>4</kbd>; <kbd>Enter</kbd> skips
ahead. Rounds are 10 questions.

## How it plays

- **Decks** — Food, Animals, The Home, Verbs, Travel, The Body, Days &
  Weather, Adjectives, Family & People, Numbers & Money, Work & School,
  City & Places, Clothing, Feelings & Mind — or all 630 words at once. Nouns
  carry their article so you learn the gender with the word.
- **Stages** — each deck runs Basics → Everyday → Fluent, 15 words apiece.
  Only Basics is open at first; a stage unlocks when the one before it reaches
  60% mastery, so depth is earned rather than dumped on you. The dots beside a
  deck name (`●●○`) show how far it is open, and the bar under each stage
  button is that stage's mastery. Under **All words**, a stage counts as open
  once any single deck has opened it, and draws only from the decks that have
  — a locked deck never leaks its harder words into a combined round.
- **Direction** — Español → English (recognition) or English → Español (recall,
  the harder one).
- **Scoring** — 10 points a word, plus 2 per consecutive correct answer up to a
  +10 cap. A miss zeroes the streak.
- **Spaced repetition** — every word sits in one of 5 boxes. Get it right and it
  climbs a box and won't be asked again for a while (1 → 3 → 7 → 14 → 30
  questions). Get it wrong and it drops straight back to box 0. Box 5 is
  "mastered", and the mastery stat is how far the whole deck has climbed.
- **Progress** persists in `localStorage`, keyed by the Spanish word — so
  learning *la manzana* in Food also counts under All words. Unlock state is
  *derived* from that same card map rather than stored, so there is no second
  source of truth to keep in sync, and someone who already knows a deck finds
  its deeper stages open on arrival.

## Layout

```
index.html      markup
style.css       styles
main.js         DOM wiring — the only file that touches the document
source/
  vocab.js      the word decks, three stages each
  srs.js        Leitner boxes, scheduling, mastery
  stages.js     which stages are unlocked, and the pool each one draws from
  quiz.js       builds a multiple-choice question
  game.js       round state, scoring, streaks
  storage.js    localStorage persistence
  random.js     seedable PRNG + shuffle
test/           vitest suite over the logic modules
```

Everything under `source/` is DOM-free and pure, which is what makes it
testable — `main.js` is the only thing that knows a browser exists.

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
