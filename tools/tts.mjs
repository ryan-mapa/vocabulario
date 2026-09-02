// Generates the pronunciation clips.
//
//   node tools/tts.mjs --voices          list the Latin American voices on offer
//   node tools/tts.mjs --manifest        rebuild audio/words.json from what is on disk
//   node tools/tts.mjs --sample          eight words, every candidate voice
//   node tools/tts.mjs --limit 15        the first 15 words only, for testing
//   node tools/tts.mjs                   every word, the four chosen voices
//
// Credentials come from `.tts.env` beside this repo's root, which is
// gitignored — the same arrangement as `.dev.vars`. Nothing is read from the
// command line, so a key cannot end up in shell history.
//
//   AZURE_KEY=...
//   AZURE_REGION=eastus
//   # or
//   AWS_ACCESS_KEY_ID=...
//   AWS_SECRET_ACCESS_KEY=...
//   AWS_REGION=us-east-1
//
// Output is mp3 straight from the provider. No transcode step, because that
// would mean depending on ffmpeg to convert audio nobody would hear a
// difference in — every browser has played mp3 for twenty years.

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from 'node:fs';
import { createHmac, createHash } from 'node:crypto';
import { DECKS } from '../source/vocab.js';
import { audioSlug } from '../source/audio.js';

const ROOT = new URL('..', import.meta.url);
const OUT = new URL('audio/', ROOT);

/** The four that ship, in cycle order. Edit after auditioning. */
const VOICES = [
  { id: 'es-MX-DaliaNeural', label: 'Mexico, female' },
  { id: 'es-MX-JorgeNeural', label: 'Mexico, male' },
  { id: 'es-CO-SalomeNeural', label: 'Colombia, female' },
  { id: 'es-AR-TomasNeural', label: 'Argentina, male' }
];

/**
 * Auditioned by --sample: a wider field than the four that ship, so the choice
 * is made by ear rather than by which names came to mind first. Azure's newer
 * HD voices are in here alongside the standard neural ones.
 */
const CANDIDATES = [
  { id: 'es-MX-DaliaNeural', label: 'Mexico F · Dalia' },
  { id: 'es-MX-Valeria:MAI-Voice-2', label: 'Mexico F · Valeria HD' },
  { id: 'es-CO-SalomeNeural', label: 'Colombia F · Salome' },
  { id: 'es-AR-ElenaNeural', label: 'Argentina F · Elena' },
  { id: 'es-MX-JorgeNeural', label: 'Mexico M · Jorge' },
  { id: 'es-MX-Tristan:DragonHDLatestNeural', label: 'Mexico M · Tristan HD' },
  { id: 'es-CO-GonzaloNeural', label: 'Colombia M · Gonzalo' },
  { id: 'es-AR-TomasNeural', label: 'Argentina M · Tomas' }
];

/** Words that stress the sounds most likely to expose a bad voice. */
const SAMPLE = [
  'la manzana', 'el murciélago', 'la vergüenza', 'el año',
  'el ferrocarril', 'el pingüino', 'la mujer', 'el aguacate'
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Azure's free F0 tier allows roughly twenty requests a minute, and the whole
 * corpus is 2,640 of them. Firing them as fast as the network allows earns a
 * wall of 429s, so requests are paced and a throttled one waits and tries
 * again rather than being lost.
 *
 * At this pace a full run takes a couple of hours. That is fine unattended —
 * and the run is resumable, so it can be stopped and restarted. On a paid S0
 * tier the limit effectively disappears and the whole job costs under a dollar.
 */
const PACE_MS = Number(process.env.TTS_PACE_MS ?? 3200);
const MAX_TRIES = 6;

async function withRetry(fn, label) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Throttling is the expected failure, but a dropped connection is just as
      // temporary and used to kill a whole voice — the first full run lost 388
      // words to one `fetch failed`. Only a refusal that says something about
      // the request itself is worth giving up on.
      const permanent = /\b(400|401|403|404)\b/.test(error.message);
      if (permanent || attempt >= MAX_TRIES) throw error;

      const wait = Math.min(60_000, 2 ** attempt * 1000);
      process.stdout.write(`\r  ${label} retrying in ${wait / 1000}s (${error.message.slice(0, 40)})   `);
      await sleep(wait);
    }
  }
}

function env() {
  const file = new URL('.tts.env', ROOT);
  const vars = { ...process.env };
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
      if (match) vars[match[1]] = match[2];
    }
  }
  return vars;
}

/**
 * Every distinct Spanish string, headwords and regional variants alike —
 * ordered by stage, Basics first.
 *
 * The order is the whole point when a run may be cut short. Most learners never
 * reach Fluent, so an interrupted run should have spent its time on the words
 * people actually see. Pass `--stage N` to do one stage and stop.
 */
export function allWords(onlyStage = null) {
  const seen = new Set();
  const out = [];
  for (const stage of [0, 1, 2]) {
    if (onlyStage !== null && stage !== onlyStage) continue;
    for (const deck of DECKS) {
      for (const word of deck.stages[stage] ?? []) {
        // Two entries can share a spelling — `la llave` is both a headword and
        // a variant of `el grifo`. One spelling, one recording.
        for (const es of [word.es, ...(word.alt ?? []).map((a) => a.es)]) {
          if (!seen.has(es)) { seen.add(es); out.push(es); }
        }
      }
    }
  }
  return out;
}

// ---- providers ----------------------------------------------------------

const azure = (vars) => ({
  name: 'azure',
  ready: Boolean(vars.AZURE_KEY && vars.AZURE_REGION),
  async speak(text, voice) {
    const locale = voice.split('-').slice(0, 2).join('-');
    const ssml =
      `<speak version='1.0' xml:lang='${locale}'><voice name='${voice}'>` +
      `${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</voice></speak>`;

    const res = await fetch(
      `https://${vars.AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': vars.AZURE_KEY,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3'
        },
        body: ssml
      }
    );
    if (!res.ok) throw new Error(`azure ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return Buffer.from(await res.arrayBuffer());
  }
});

const polly = (vars) => ({
  name: 'polly',
  ready: Boolean(vars.AWS_ACCESS_KEY_ID && vars.AWS_SECRET_ACCESS_KEY),
  async speak(text, voice) {
    const region = vars.AWS_REGION || 'us-east-1';
    const host = `polly.${region}.amazonaws.com`;
    const body = JSON.stringify({
      Engine: 'neural', OutputFormat: 'mp3', Text: text, VoiceId: voice.replace(/^.*-/, '')
    });

    // SigV4, by hand — the AWS SDK is a large dependency for one endpoint.
    const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const day = now.slice(0, 8);
    const hash = (s) => createHash('sha256').update(s).digest('hex');
    const canonical = [
      'POST', '/v1/speech', '',
      `content-type:application/json\nhost:${host}\nx-amz-date:${now}\n`,
      'content-type;host;x-amz-date', hash(body)
    ].join('\n');
    const scope = `${day}/${region}/polly/aws4_request`;
    const toSign = ['AWS4-HMAC-SHA256', now, scope, hash(canonical)].join('\n');

    let key = Buffer.from(`AWS4${vars.AWS_SECRET_ACCESS_KEY}`);
    for (const part of [day, region, 'polly', 'aws4_request']) {
      key = createHmac('sha256', key).update(part).digest();
    }
    const signature = createHmac('sha256', key).update(toSign).digest('hex');

    const res = await fetch(`https://${host}/v1/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Amz-Date': now,
        Authorization:
          `AWS4-HMAC-SHA256 Credential=${vars.AWS_ACCESS_KEY_ID}/${scope}, ` +
          `SignedHeaders=content-type;host;x-amz-date, Signature=${signature}`
      },
      body
    });
    if (!res.ok) throw new Error(`polly ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return Buffer.from(await res.arrayBuffer());
  }
});

// ---- run ----------------------------------------------------------------

/**
 * What the provider actually offers, rather than what anyone remembered. Voice
 * names change; a wrong one fails 2,640 times in a row otherwise.
 */
/**
 * The words that have a recording in *every* voice.
 *
 * The app reads this to decide which words get a speaker button, so a partly
 * generated set degrades to "some words have audio" instead of a button that
 * does nothing on the ones that do not. Without it the choice is all or
 * nothing, and a single failed clip would mean shipping neither.
 */
function writeManifest(voiceCount) {
  const complete = [];
  const first = new URL('1/', OUT);
  if (!existsSync(first)) return;

  for (const name of readdirSync(first)) {
    if (!name.endsWith('.mp3')) continue;
    let everywhere = true;
    for (let i = 2; i <= voiceCount; i++) {
      if (!existsSync(new URL(`${i}/${name}`, OUT))) { everywhere = false; break; }
    }
    if (everywhere) complete.push(name.replace(/\.mp3$/, ''));
  }

  complete.sort();
  writeFileSync(new URL('words.json', OUT), JSON.stringify(complete) + '\n');
  console.log(`\nmanifest: ${complete.length} words have all ${voiceCount} voices`);
}

async function listVoices(vars) {
  const res = await fetch(
    `https://${vars.AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
    { headers: { 'Ocp-Apim-Subscription-Key': vars.AZURE_KEY } }
  );
  if (!res.ok) throw new Error(`azure ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const spanish = (await res.json())
    .filter((v) => v.Locale.startsWith('es-') && v.Locale !== 'es-ES')
    .sort((a, b) => a.Locale.localeCompare(b.Locale) || a.Gender.localeCompare(b.Gender));

  let locale = null;
  for (const voice of spanish) {
    if (voice.Locale !== locale) {
      locale = voice.Locale;
      console.log(`\n${voice.LocaleName}  (${locale})`);
    }
    console.log(`  ${voice.ShortName.padEnd(28)} ${voice.Gender}`);
  }
  console.log(`\n${spanish.length} Latin American voices. Castilian (es-ES) omitted — it would contradict the vocabulary.`);
}

async function main() {
  const sampling = process.argv.includes('--sample');
  const vars = env();
  const provider = [azure(vars), polly(vars)].find((p) => p.ready);

  if (!provider) {
    console.error(
      'No credentials found. Create .tts.env at the repo root with either\n' +
      '  AZURE_KEY=... and AZURE_REGION=...\n' +
      '  AWS_ACCESS_KEY_ID=... and AWS_SECRET_ACCESS_KEY=...\n' +
      'It is gitignored.'
    );
    process.exit(1);
  }

  if (process.argv.includes('--voices')) return listVoices(vars);
  if (process.argv.includes('--manifest')) return writeManifest(VOICES.length);

  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

  const stageArg = process.argv.indexOf('--stage');
  const onlyStage = stageArg !== -1 ? Number(process.argv[stageArg + 1]) : null;
  const words = (sampling ? SAMPLE : allWords(onlyStage)).slice(0, limit);
  if (onlyStage !== null) console.log(`stage ${onlyStage} only — ${words.length} words in the queue`);
  const voices = sampling ? CANDIDATES : VOICES;
  console.log(`${provider.name}: ${words.length} words x ${voices.length} voices\n`);

  let made = 0;
  let skipped = 0;
  let bytes = 0;

  const failed = [];

  // Which voice produced which numbered folder. Without this, swapping a voice
  // in VOICES would leave the old recordings in place and be skipped as
  // "already present" — the change would appear to work and change nothing.
  const stampFile = new URL('voices.json', OUT);
  const previous = existsSync(stampFile)
    ? JSON.parse(readFileSync(stampFile, 'utf8'))
    : {};

  if (!sampling) {
    const stale = voices
      .map((voice, i) => [i + 1, voice.id, previous[i + 1]])
      .filter(([, id, was]) => was && was !== id);

    if (stale.length) {
      console.error('These folders hold a different voice than the one configured:');
      for (const [dir, id, was] of stale) console.error(`  audio/${dir}: has ${was}, wants ${id}`);
      console.error('\nDelete those folders and run again — otherwise the old clips are kept.');
      process.exit(1);
    }
  }

  for (const [index, voice] of voices.entries()) {
    const dir = new URL(`${sampling ? voice.id.replace(/[^\w-]/g, '_') : index + 1}/`, OUT);
    mkdirSync(dir, { recursive: true });

    for (const word of words) {
      const file = new URL(`${audioSlug(word)}.mp3`, dir);
      // Resumable: a failed run halfway through costs only what it did not
      // reach, and re-running is free rather than a second bill.
      if (existsSync(file)) {
        skipped += 1;
        bytes += statSync(file).size;
        continue;
      }
      try {
        const audio = await withRetry(() => provider.speak(word, voice.id), voice.label);
        writeFileSync(file, audio);
        made += 1;
        bytes += audio.length;
        await sleep(PACE_MS);
      } catch (error) {
        failed.push(`${voice.id} / ${word}: ${error.message.slice(0, 80)}`);
        // A voice that cannot say its very first word is not available at all,
        // so move on. Anything later is one bad word, and abandoning the other
        // six hundred over it is how a voice ends up half generated — which is
        // exactly what happened the first time this ran.
        if (made === 0 && skipped === 0) break;
      }
      process.stdout.write(`\r  ${voice.label.padEnd(24)} ${made + skipped}/${words.length * voices.length}`);
    }
  }

  if (!sampling) {
    writeFileSync(
      stampFile,
      JSON.stringify(Object.fromEntries(voices.map((v, i) => [i + 1, v.id])), null, 2) + '\n'
    );
    writeManifest(voices.length);
  }

  console.log(
    `\n\ndone — ${made} generated, ${skipped} already present, ` +
    `${(bytes / 1048576).toFixed(1)} MB total`
  );
  if (failed.length) {
    console.log(`\nunavailable:\n  ${[...new Set(failed)].join('\n  ')}`);
  }
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
