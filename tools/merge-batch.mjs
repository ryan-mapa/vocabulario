// Merges a validated batch into source/vocab.js and source/sentences.js.
//
//   node tools/merge-batch.mjs staging/comida.clean.json --dry
//   node tools/merge-batch.mjs staging/comida.clean.json
//
// Surgical insertion rather than regenerating the files: vocab.js carries
// comments that explain why particular words are the way they are — the shipped
// keys that must never be renamed, the regional variants — and a round trip
// through JSON would throw all of that away.
//
// Brackets are walked rather than matched with a regex, because a stage array
// contains nested [ ] in every `alt:` list and a regex cannot see the nesting.

import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';

const [, , file, ...flags] = process.argv;
const dry = flags.includes('--dry');
if (!file) { console.error('usage: node tools/merge-batch.mjs <batch.clean.json> [--dry]'); process.exit(1); }

const batch = JSON.parse(readFileSync(file, 'utf8'));
const targets = JSON.parse(readFileSync(new URL('./targets.json', import.meta.url)));
const VOCAB = 'source/vocab.js';
const SENTS = 'source/sentences.js';

const q = (s) => (s.includes("'") ? JSON.stringify(s) : `'${s}'`);
const wordLine = (w) => `        { es: ${q(w.es)}, en: ${q(w.en)} }`;

/** The index just past the matching close of the bracket that opens at `from`. */
function matchBracket(src, from) {
  const open = src[from], close = open === '[' ? ']' : '}';
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"') {           // skip string literals
      const quote = c;
      i++;
      while (i < src.length && src[i] !== quote) { if (src[i] === '\\') i++; i++; }
      continue;
    }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return i; }
  }
  throw new Error('unbalanced brackets');
}

/** The [start, end] of stage N's array inside a deck. */
function stageRange(src, deckId, stage) {
  const idAt = src.indexOf(`id: '${deckId}'`);
  if (idAt === -1) throw new Error(`deck ${deckId} not found in vocab.js`);
  const stagesAt = src.indexOf('stages: [', idAt);
  let cursor = src.indexOf('[', stagesAt);
  const stagesEnd = matchBracket(src, cursor);
  cursor++;
  for (let n = 0; ; n++) {
    while (cursor < stagesEnd && src[cursor] !== '[') cursor++;
    if (cursor >= stagesEnd) throw new Error(`stage ${stage} not found in ${deckId}`);
    const end = matchBracket(src, cursor);
    if (n === stage) return [cursor, end];
    cursor = end + 1;
  }
}

// Idempotency. A batch merged twice would silently double its words, and the
// second copy would be invisible until a duplicate test caught it much later.
// Cheaper to refuse: re-running a merge is exactly what happens when a session
// dies and you are not sure how far it got.
const { DECKS: CURRENT } = await import('../source/vocab.js?t=' + Date.now());
const already = new Set(CURRENT.flatMap((d) => d.stages.flat()).map((w) => w.es));
const clashes = [0, 1, 2]
  .flatMap((s) => batch.stages[s] ?? [])
  .filter((w) => already.has(w.es))
  .map((w) => w.es);
if (clashes.length) {
  console.error(`refusing to merge ${batch.deck}: ${clashes.length} of these words are already in the corpus.`);
  console.error(`This batch looks already merged. First few: ${clashes.slice(0, 5).join(', ')}`);
  console.error('If you really mean to, remove them from the batch file first.');
  process.exit(2);
}

let vocab = readFileSync(VOCAB, 'utf8');
let added = 0;
const isNew = Boolean(targets.new.find((d) => d.id === batch.deck)) && !vocab.includes(`id: '${batch.deck}'`);

if (isNew) {
  const meta = targets.new.find((d) => d.id === batch.deck);
  const stages = [0, 1, 2].map((s) => {
    const rows = (batch.stages[s] ?? []).map(wordLine).join(',\n');
    added += (batch.stages[s] ?? []).length;
    return `      [\n${rows}\n      ]`;
  }).join(',\n');
  const block = `  {\n    id: '${meta.id}',\n    name: '${meta.name}',\n    emoji: '${meta.emoji}',\n    stages: [\n${stages}\n    ]\n  }`;
  const close = vocab.lastIndexOf('\n];');
  if (close === -1) throw new Error('could not find the end of DECKS');
  vocab = vocab.slice(0, close) + ',\n' + block + vocab.slice(close);
} else {
  // Later stages first: inserting into stage 0 would shift the offsets of 1 and 2.
  for (const stage of [2, 1, 0]) {
    const entries = batch.stages[stage] ?? [];
    if (!entries.length) continue;
    const [, end] = stageRange(vocab, batch.deck, stage);
    const rows = entries.map(wordLine).join(',\n');
    vocab = vocab.slice(0, end).replace(/\s*$/, '') + ',\n' + rows + '\n      ' + vocab.slice(end);
    added += entries.length;
  }
}

let sentences = readFileSync(SENTS, 'utf8');
const pairs = [0, 1, 2].flatMap((s) => (batch.stages[s] ?? []).map((w) => ({ ...w, stage: s })));
const STAGE_NAMES = ['Basics', 'Everyday', 'Fluent'];
const blocks = [0, 1, 2].map((s) => {
  const rows = pairs.filter((p) => p.stage === s);
  if (!rows.length) return null;
  return `  // --- ${batch.deck} / ${STAGE_NAMES[s]} ---\n` +
    rows.map((w) => `  ${q(w.es)}: [${q(w.ex[0])}, ${q(w.ex[1])}]`).join(',\n');
}).filter(Boolean).join(',\n\n');

const tail = '\n};\n';
if (!sentences.endsWith(tail)) throw new Error('unexpected ending in sentences.js');
let body = sentences.slice(0, -tail.length).replace(/\s*$/, '');
if (!body.endsWith(',')) body += ',';
sentences = body + '\n\n' + blocks + tail;

console.log(`${batch.deck}: ${isNew ? 'NEW deck' : 'appending'} — ${added} words, ${pairs.length} sentences`);
if (dry) {
  console.log('(dry run — nothing written)');
} else {
  mkdirSync('staging/.backup', { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  copyFileSync(VOCAB, `staging/.backup/vocab.${stamp}.js`);
  copyFileSync(SENTS, `staging/.backup/sentences.${stamp}.js`);
  writeFileSync(VOCAB, vocab);
  writeFileSync(SENTS, sentences);
  console.log(`wrote ${VOCAB} and ${SENTS}`);
  console.log(`backup: staging/.backup/*.${stamp}.js   (git checkout also works — commit per batch)`);
  console.log('next: npx vitest run');
}
