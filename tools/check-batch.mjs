// Validates one agent's batch offline, before a single token is spent on review.
//
//   node tools/check-batch.mjs staging/comida.json
//   node tools/check-batch.mjs staging/comida.json --write   also emit .clean.json
//
// Prints two things: a report, and — when anything failed — a repair note short
// enough to paste straight back to the agent. That note is the whole economy of
// this: a rejected batch costs one small message listing the faults, never a
// second copy of the brief.

import { readFileSync, writeFileSync } from 'node:fs';
import { DECKS, STAGE_NAMES } from '../source/vocab.js';
import { SENTENCES } from '../source/sentences.js';
import { checkPair, overusedOpenings, copulaOveruse, flatten, bare } from './rules.mjs';

const targets = JSON.parse(readFileSync(new URL('./targets.json', import.meta.url)));
const [, , file, ...flags] = process.argv;
if (!file) { console.error('usage: node tools/check-batch.mjs <batch.json> [--write]'); process.exit(1); }

const batch = JSON.parse(readFileSync(file, 'utf8'));
const deckId = batch.deck;
const existing = DECKS.find((d) => d.id === deckId);
const fresh = targets.new.find((d) => d.id === deckId);
if (!existing && !fresh) { console.error(`unknown deck: ${deckId}`); process.exit(1); }
const want = existing ? targets.existing[deckId] : fresh.targets;

// Everything the corpus already holds.
const takenWords = new Map();
const takenSentences = new Map();
for (const deck of DECKS) {
  for (const stage of deck.stages) {
    for (const w of stage) {
      takenWords.set(flatten(w.es), deck.name);
      for (const v of w.alt ?? []) takenWords.set(flatten(v.es), `${deck.name} (variant of ${w.es})`);
    }
  }
}
for (const [es, [sp]] of Object.entries(SENTENCES)) takenSentences.set(flatten(sp), es);

const accepted = { 0: [], 1: [], 2: [] };
const rejected = [];
const seenWord = new Map();
const seenSentence = new Map();

for (const [stageKey, entries] of Object.entries(batch.stages ?? {})) {
  const stage = Number(stageKey);
  for (const entry of entries ?? []) {
    const { es, en, ex } = entry ?? {};
    const reject = (why) => rejected.push({ stage, es: es ?? '(no es)', why });

    if (!es || !en) { reject('missing es or en'); continue; }
    const key = flatten(es);

    if (takenWords.has(key)) { reject(`already taught in ${takenWords.get(key)}`); continue; }
    if (seenWord.has(key)) { reject(`duplicate of another entry in this batch (stage ${seenWord.get(key)})`); continue; }

    const faults = checkPair(es, ex);
    if (faults.length) { reject(faults.join('; ')); continue; }

    const sKey = flatten(ex[0]);
    if (takenSentences.has(sKey)) { reject(`sentence already used for "${takenSentences.get(sKey)}"`); continue; }
    if (seenSentence.has(sKey)) { reject(`sentence repeats the one for "${seenSentence.get(sKey)}"`); continue; }

    seenWord.set(key, stage);
    seenSentence.set(sKey, es);
    accepted[stage].push(entry);
  }
}

// Set-level checks run on what survived.
const setFaults = [];
const advisories = [];
for (const stage of [0, 1, 2]) {
  const sentences = accepted[stage].map((e) => e.ex[0]);
  if (sentences.length < 8) continue;
  for (const o of overusedOpenings(sentences)) {
    advisories.push(`${STAGE_NAMES[stage]}: ${o.count} sentences open with "${o.opening}" — worth a look, not a fault`);
  }
  const copula = copulaOveruse(sentences);
  if (copula) {
    setFaults.push(`${STAGE_NAMES[stage]}: ${copula.count}/${copula.of} use the "El X es Y" template (max ${copula.cap}) — e.g. ${copula.examples.join(' / ')}`);
  }
}

const pad = (n) => String(n).padStart(3);
console.log(`\n${deckId} — ${existing ? 'existing' : 'NEW'} deck`);
if (batch.note) console.log(`note from the agent: ${batch.note}`);
console.log('');
let short = false;
for (const stage of [0, 1, 2]) {
  const have = existing ? existing.stages[stage].length : 0;
  const need = want[stage] - have;
  if (need <= 0 && accepted[stage].length === 0) continue;
  const got = accepted[stage].length;
  const status = got >= need ? 'ok' : `SHORT by ${need - got}`;
  if (got < need) short = true;
  console.log(`  ${STAGE_NAMES[stage].padEnd(9)} have ${pad(have)}  need ${pad(need)}  accepted ${pad(got)}  ${status}`);
}
console.log(`\n  accepted ${Object.values(accepted).flat().length}   rejected ${rejected.length}`);

if (advisories.length) {
  console.log('\n  advisories (not failures):');
  advisories.forEach((a) => console.log(`    - ${a}`));
}

if (setFaults.length) {
  console.log('\n  set-level faults:');
  setFaults.forEach((f) => console.log(`    - ${f}`));
}

if (rejected.length) {
  console.log('\n--- repair note (paste to the agent) ---\n');
  console.log(`${rejected.length} of your entries were rejected. Replace each with a new word`);
  console.log('for the same stage — do not resubmit the ones that passed.\n');
  for (const r of rejected) console.log(`  [${STAGE_NAMES[r.stage]}] ${r.es} — ${r.why}`);
  if (setFaults.length) { console.log(''); setFaults.forEach((f) => console.log(`  ${f}`)); }
  console.log('');
}

if (flags.includes('--write')) {
  const out = file.replace(/\.json$/, '.clean.json');
  // Trim over-generation down to the target, keeping the agent's own ordering.
  const trimmed = {};
  for (const stage of [0, 1, 2]) {
    const have = existing ? existing.stages[stage].length : 0;
    const need = Math.max(0, want[stage] - have);
    trimmed[stage] = accepted[stage].slice(0, need);
  }
  writeFileSync(out, JSON.stringify({ deck: deckId, stages: trimmed }, null, 2));
  const kept = Object.values(trimmed).flat().length;
  console.log(`wrote ${out} — ${kept} entries (${Object.values(accepted).flat().length - kept} surplus dropped)`);
}

process.exit(rejected.length || setFaults.length || short ? 1 : 0);
