// Builds the complete, self-contained brief for one deck's expansion.
//
//   node tools/brief.mjs comida            > brief.md      an existing deck
//   node tools/brief.mjs social --stage 0  > brief.md      one stage of a new deck
//
// The point of generating these rather than writing them is that every agent
// then gets the SAME rules and the SAME exclusion list. A brief that omits a
// rule costs a repair round trip, and repair round trips are the expensive part
// — so everything the validator checks is stated here, in the words the
// validator uses.

import { readFileSync } from 'node:fs';
import { DECKS, STAGE_NAMES } from '../source/vocab.js';
import { SENTENCES } from '../source/sentences.js';

const targets = JSON.parse(readFileSync(new URL('./targets.json', import.meta.url)));

const [, , deckId, ...rest] = process.argv;
const stageArg = rest.includes('--stage') ? Number(rest[rest.indexOf('--stage') + 1]) : null;
if (!deckId) {
  console.error('usage: node tools/brief.mjs <deckId> [--stage N]');
  process.exit(1);
}

const existing = DECKS.find((d) => d.id === deckId);
const fresh = targets.new.find((d) => d.id === deckId);
if (!existing && !fresh) {
  console.error(`unknown deck: ${deckId}`);
  process.exit(1);
}

const name = existing?.name ?? fresh.name;
const emoji = existing?.emoji ?? fresh.emoji;
const want = existing ? targets.existing[deckId] : fresh.targets;
const stages = stageArg === null ? [0, 1, 2] : [stageArg];

/** Every headword and regional variant in the corpus — nothing may repeat one. */
const taken = [];
for (const deck of DECKS) {
  for (const stage of deck.stages) {
    for (const word of stage) {
      taken.push(word.es);
      for (const variant of word.alt ?? []) taken.push(variant.es);
    }
  }
}
taken.sort((a, b) => a.localeCompare(b, 'es'));

const line = (w) => `  ${w.es} = ${w.en}`;
const OVER = 1.25;   // over-generate: parallel agents cannot see each other

const out = [];
const p = (...s) => out.push(...s);

p(`# Expand the ${emoji} ${name} deck`);
p('');
p('You are writing vocabulary for a Spanish learning app. Latin American Spanish,');
p('US English glosses. Your output is validated by a script before it is accepted,');
p('and anything that fails a rule below is rejected — so read the rules first.');
p('');

if (fresh) {
  p(`This deck is NEW. Nothing exists in it yet.`);
  p('');
  p(`**Scope.** ${fresh.scope}`);
} else {
  p(`This deck EXISTS and already teaches ${existing.stages.flat().length} words.`);
  p('You are adding to it. Match the register and style of what is already there.');
}
p('');

p('## What to produce');
p('');
for (const s of stages) {
  const have = existing ? existing.stages[s].length : 0;
  const need = want[s] - have;
  p(`- **${STAGE_NAMES[s]}** — ${have} words now, target ${want[s]}, so **${need} new**.` +
    ` Give me **${Math.ceil(need * OVER)}** candidates.`);
}
p('');
p(`Produce ~25% more than the target. Several agents are writing different decks`);
p('at the same time and cannot see each other, so some of yours will collide and');
p('be dropped centrally. Over-generating means that costs nothing.');
p('');
p('**Cover the topic broadly.** Do not extend one narrow seam of it. A real');
p('submission for Clothing came back as fabric names — cambric, muslin, brocade,');
p('damask, chiffon — because the existing Fluent stage happened to contain a few');
p('fabrics. That is a textiles glossary, not clothing a learner needs. Spread');
p('across the whole topic, and prefer a word someone would actually use.');
p('');
p('If a stage genuinely cannot be filled to its target without padding — a closed');
p('set like the days of the week, or a topic that simply runs out — return fewer');
p('and say so in the `note` field. A smaller stage is much better than filler.');
p('');

p('## What the three stages mean');
p('');
p('- **Basics** — the words someone meets first. High frequency, concrete,');
p('  the ones you cannot discuss the topic at all without.');
p('- **Everyday** — what a confident conversation about the topic needs. Still');
p('  common, but not the first thing taught.');
p('- **Fluent** — precise or specialist words a native uses without thinking and');
p('  a learner reaches last. Not obscure: still words people actually say.');
p('');

p('## Hard rules — each one is checked mechanically');
p('');
p('1. **Nouns carry their article.** `la manzana`, not `manzana`. It is how gender');
p('   is taught. Verbs are infinitives; adjectives are masculine singular.');
p('2. **No word may repeat anything in the exclusion list below**, and none may');
p('   repeat another of yours. The Spanish string is the progress key.');
p('3. **No regional variants of words already taught.** `el aparcamiento` is the');
p('   Spain form of `el estacionamiento`, which is taught — so it is a duplicate,');
p('   not a new word. Prefer the Latin American form throughout.');
p('4. **Every word needs an example sentence and its English translation.**');
p('   The English translates YOUR Spanish sentence; the two must line up.');
p('5. **Sentence style**: 5–11 words. Natural — what a person would say, not a');
p('   dictionary illustration. The sentence must **disambiguate** the word, which');
p('   is the whole point: `la cuenta` in a restaurant is a bill, not an account.');
p('6. **The sentence must contain the word**, in a form that keeps its root.');
p('   Spanish stem-changes: a sentence with `sigue` does NOT contain `seguir`.');
p('   Write `Hay que seguir por esta calle.` instead. This one rejects the most.');
p('7. **Inverted marks.** `¿` opens every question, `¡` every exclamation.');
p('8. **No sentence may repeat another**, here or anywhere in the app.');
p('9. **Write only Spanish in the Spanish sentence.** An English word in it is');
p('   rejected outright — a real submission contained');
p('   `Flota el chifón gracefully cuando caminas.`');
p('10. **Natural word order.** Subject before verb, the way a person actually');
p('    speaks. Do NOT invert a sentence to make your set look varied:');
p('    `Suave y fina es la tela de cambray` is contorted; `La tela de cambray es');
p('    suave y fina` is what someone says. Repetitive openings are FINE and are');
p('    not checked — thirty animal words will mostly start with `El`, and that is');
p('    the topic, not a flaw. Unnatural Spanish written to avoid repetition is');
p('    much worse than repetition.');
p('11. **Do not fill a stage with `El X es Y.`** That shape asserts a property');
p('    and shows nothing about how the word is used. Some are fine; a stage');
p('    built from them is rejected.');
p('12. **No names, and no he/she where a neutral subject will do.** A sentence');
p('    should not need a person invented for it.');
p('13. **One English gloss per word — no articles, no slashes, no lists.**');
p('    `raincoat`, never `the raincoat`, `raincoat/mac`, or `raincoat, mac`.');
p('    The gloss is shown as one option in a multiple-choice question.');
p('14. **No two words may share an English gloss**, yours or the app\'s. If your');
p('    word means the same as one already taught, it is a duplicate — pick a');
p('    different word rather than a different way of writing the same gloss.');
p('15. **Do not pad with a taught word plus a modifier.** A real submission came');
p('    back with `la chaqueta vaquera`, `el traje de noche`, `la falda plisada`,');
p('    `el cinturón de cuero` — every half of every one already taught. They pass');
p('    the uniqueness rule and teach nothing. A compound is fine when it names');
p('    one idea a learner could not assemble (`la tarjeta de embarque` really is');
p('    a boarding pass); it is padding when it is just a noun with an adjective.');
p('16. **Get the article right.** `el babero`, not `la babero`. Words that are');
p('    always plural take a plural article: `las gafas de sol`, `las tijeras`.');
p('');

p('## Output format');
p('');
p('A single JSON object, nothing else — no prose, no markdown fence.');
p('');
p('```');
p('{');
p(`  "deck": "${deckId}",`);
p('  "note": "anything I should know — a stage you could not fill, and why",');
p('  "stages": {');
for (const s of stages) {
  p(`    "${s}": [`);
  p('      { "es": "la manzana", "en": "apple",');
  p('        "ex": ["Me comí una manzana antes de salir.", "I ate an apple before leaving."] }');
  p(`    ]${s === stages[stages.length - 1] ? '' : ','}`);
}
p('  }');
p('}');
p('```');
p('');

if (existing) {
  p('## What this deck already teaches');
  p('');
  p('Do not repeat any of these. They also show you the register to match.');
  p('');
  for (const s of [0, 1, 2]) {
    p(`**${STAGE_NAMES[s]}** (${existing.stages[s].length})`);
    p('```');
    existing.stages[s].forEach((w) => p(line(w)));
    p('```');
    p('');
  }
  const sample = existing.stages[0].slice(0, 3).filter((w) => SENTENCES[w.es]);
  if (sample.length) {
    p('Example sentences already written for this deck, as a style reference:');
    p('```');
    sample.forEach((w) => p(`  ${w.es}\n    ES: ${SENTENCES[w.es][0]}\n    EN: ${SENTENCES[w.es][1]}`));
    p('```');
    p('');
  }
}

p('## Exclusion list — every word the app already teaches');
p('');
p(`${taken.length} entries, including regional variants. Nothing you return may`);
p('match one of these.');
p('');
p('```');
p(taken.join(', '));
p('```');

console.log(out.join('\n'));
