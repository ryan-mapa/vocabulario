// Where the expansion has got to.  node tools/status.mjs
//
// Derived from the corpus and the staging directory rather than from a ledger.
// A ledger is a second source of truth that drifts the moment a step is done by
// hand or a session dies mid-merge; the word counts cannot drift, because they
// ARE the work. Safe to run at any point, and the honest answer to "what did I
// already finish?" after anything goes wrong.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { DECKS, STAGE_NAMES } from '../source/vocab.js';

const targets = JSON.parse(readFileSync(new URL('./targets.json', import.meta.url)));
const staged = existsSync('staging') ? readdirSync('staging') : [];

const rows = [];
let done = 0, total = 0, wordsNow = 0, wordsTarget = 0;

for (const [id, want] of Object.entries(targets.existing)) {
  const deck = DECKS.find((d) => d.id === id);
  const have = deck.stages.map((s) => s.length);
  rows.push({ id, kind: 'existing', have, want, name: deck.name });
}
for (const meta of targets.new) {
  const deck = DECKS.find((d) => d.id === meta.id);
  rows.push({
    id: meta.id, kind: 'new', name: meta.name,
    have: deck ? deck.stages.map((s) => s.length) : [0, 0, 0],
    want: meta.targets
  });
}

const bar = (have, want) => {
  const n = Math.round(10 * Math.min(1, have / want));
  return '█'.repeat(n) + '·'.repeat(10 - n);
};

console.log('\n  deck            stage sizes      target        staged   state');
console.log('  ' + '-'.repeat(72));
for (const r of rows) {
  const complete = r.have.every((h, i) => h >= r.want[i]);
  if (complete) done++;
  total++;
  wordsNow += r.have.reduce((a, b) => a + b, 0);
  wordsTarget += r.want.reduce((a, b) => a + b, 0);
  const files = staged.filter((f) => f.startsWith(r.id + '.') || f.startsWith(r.id + '-'));
  const clean = files.filter((f) => f.endsWith('.clean.json')).length;
  const raw = files.filter((f) => f.endsWith('.json') && !f.endsWith('.clean.json')).length;
  const state = complete ? 'done'
    : clean ? 'validated — ready to merge'
    : raw ? 'written — needs check-batch'
    : 'not started';
  console.log(
    `  ${r.id.padEnd(14)} ${r.have.join('/').padEnd(14)} ${r.want.join('/').padEnd(12)} ` +
    `${String(raw + clean || '').padEnd(8)} ${state}`
  );
}
console.log('  ' + '-'.repeat(72));
console.log(`  ${done}/${total} decks at target   ${wordsNow}/${wordsTarget} words   ${bar(wordsNow, wordsTarget)}` +
            `  ${Math.round(100 * wordsNow / wordsTarget)}%`);

const backups = existsSync('staging/.backup') ? readdirSync('staging/.backup').length : 0;
if (backups) console.log(`\n  ${backups} pre-merge backups in staging/.backup`);
console.log('');
