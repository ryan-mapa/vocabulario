import { DECKS, STAGE_NAMES, ALL_DECK_ID } from './source/vocab.js';
import { DIRECTIONS } from './source/quiz.js';
import { createGame } from './source/game.js';
import {
  load,
  save,
  withCards,
  withDays,
  withGuards,
  reset,
  exportProgress,
  parseProgress,
  newReviewId,
  queueReview,
  readOutbox,
  clearQueued,
  queueRound,
  readRoundOutbox,
  clearQueuedRounds
} from './source/storage.js';
import { deckProgress, unlockedDepth, commonDepth, nextUnlock } from './source/stages.js';
import { fetchMe, signOut, sync, deleteAccount } from './source/api.js';
import { clipUrl, nextVoice, canPlay, hasClip, MANIFEST_URL, VOICE_COUNT } from './source/audio.js';
import { tonesFor, isMuted, setMuted } from './source/sound.js';
import {
  DAILY_GOAL,
  GRACE_DAYS,
  GUARD,
  localDay,
  streakFrom,
  recordRound,
  goalProgress,
  guardEvent
} from './source/goals.js';

const el = (id) => document.getElementById(id);
const ui = {
  deck: el('deck'),
  direction: el('direction'),
  today: el('today'),
  todayStat: el('today-stat'),
  goalFill: el('goal-fill'),
  streak: el('streak'),
  streakStat: el('streak-stat'),
  mastered: el('mastered'),
  mastery: el('mastery'),
  roundProgress: el('round-progress'),
  stageRow: el('stage-row'),
  unlockNote: el('unlock-note'),
  unlockBanner: el('unlock-banner'),
  play: el('play'),
  hint: document.querySelector('.hint'),
  directionHint: el('direction-hint'),
  prompt: el('prompt'),
  choices: el('choices'),
  feedback: el('feedback'),
  variantNote: el('variant-note'),
  summary: el('summary'),
  summaryAccuracy: el('summary-accuracy'),
  summaryToday: el('summary-today'),
  summaryMastered: el('summary-mastered'),
  summaryLongest: el('summary-longest'),
  goalBanner: el('goal-banner'),
  again: el('again'),
  transfer: el('transfer'),
  sound: el('sound'),
  transferDialog: el('transfer-dialog'),
  transferOut: el('transfer-out'),
  transferIn: el('transfer-in'),
  transferCopy: el('transfer-copy'),
  transferImport: el('transfer-import'),
  transferClose: el('transfer-close'),
  transferStatus: el('transfer-status'),
  auth: el('auth'),
  signIn: el('sign-in'),
  authUser: el('auth-user'),
  authName: el('auth-name'),
  authNote: el('auth-note'),
  signOut: el('sign-out'),
  scoreboardNote: el('scoreboard-note'),
  account: el('account'),
  accountDialog: el('account-dialog'),
  accountName: el('account-name'),
  accountClose: el('account-close'),
  deleteStart: el('delete-start'),
  deleteDialog: el('delete-dialog'),
  deleteBody: el('delete-body'),
  deleteCancel: el('delete-cancel'),
  deleteContinue: el('delete-continue'),
  deleteFinal: el('delete-final'),
  deleteTyped: el('delete-typed'),
  deleteStatus: el('delete-status'),
  deleteFinalCancel: el('delete-final-cancel'),
  deleteConfirm: el('delete-confirm'),
  guardBadge: el('guard-badge'),
  guardShield: el('guard-shield'),
  guardDialog: el('guard-dialog'),
  guardBody: el('guard-body'),
  guardToggle: el('guard-toggle'),
  guardClose: el('guard-close'),
  guardNotice: el('guard-notice'),
  guardNoticeTitle: el('guard-notice-title'),
  guardNoticeBody: el('guard-notice-body'),
  guardNoticeOk: el('guard-notice-ok'),
  speakPrompt: el('speak-prompt'),
  speakPromptDots: el('speak-prompt-dots')
};

let store = load();
let game = null;
let stages = [0];   // which stages the round draws from; never empty
let depthAtRoundStart = 0;
let account = null;   // { signedIn, name } once /me has answered, else null
/** Guards the end of a round against being counted twice. See showSummary. */
let roundCredited = false;

/** Answers per sync request; the server refuses more than 500. */
const SYNC_BATCH = 250;

/**
 * Pronunciation, when there is any.
 *
 * The clips are static files, and the same markup is served from places that
 * have none — the single-file build most obviously. So one probe decides
 * whether the button ever appears, rather than every word failing quietly.
 */
let spoken = new Set();
let lastVoice = null;
let playing = null;

async function loadAudioManifest() {
  try {
    const res = await fetch(MANIFEST_URL);
    if (!res.ok) return;
    const words = await res.json();
    if (Array.isArray(words)) spoken = new Set(words);
  } catch {
    // No manifest, so no audio. The single-file build and any copy served
    // before the clips were generated both land here, and correctly show
    // nothing rather than a button that cannot work.
  }
}

/** Which of the four voices was last heard. Nothing lit means none yet. */
function renderDots() {
  for (const dots of [ui.speakPromptDots]) {
    if (dots.children.length !== VOICE_COUNT) {
      dots.innerHTML = '';
      for (let i = 0; i < VOICE_COUNT; i++) {
        dots.append(Object.assign(document.createElement('span'), { className: 'dot' }));
      }
    }
    [...dots.children].forEach((dot, i) => dot.classList.toggle('on', i === lastVoice));
  }
}

/**
 * The little tone an answer makes.
 *
 * The context is built on first use rather than at load, because a browser
 * refuses to start one before the page has been interacted with — and the
 * first answer is always a click or a keypress, so by then it is allowed.
 */
let tones = null;
let muted = isMuted();

function chime(correct) {
  if (muted) return;
  try {
    tones ??= new (window.AudioContext ?? window.webkitAudioContext)();
    if (tones.state === 'suspended') tones.resume();

    for (const tone of tonesFor(correct)) {
      const at = tones.currentTime + tone.start;
      const osc = tones.createOscillator();
      const gain = tones.createGain();

      osc.type = 'sine';
      osc.frequency.value = tone.hz;
      // Eased in and out. A square-edged envelope clicks, and the click is
      // louder than the note it is wrapping.
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(tone.gain, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.seconds);

      osc.connect(gain).connect(tones.destination);
      osc.start(at);
      osc.stop(at + tone.seconds + 0.02);
    }
  } catch {
    // No audio on this device, or the context refused. Silence is a fine
    // outcome; the colours already said whether the answer was right.
  }
}

function speak(button, word) {
  if (!hasClip(spoken, word.es)) return;

  if (playing) {
    playing.audio.pause();
    playing.button.classList.remove('playing');
  }

  lastVoice = nextVoice(lastVoice, VOICE_COUNT);
  renderDots();
  const audio = new Audio(clipUrl(word.es, lastVoice));
  playing = { audio, button };
  button.classList.add('playing');

  const done = () => {
    button.classList.remove('playing');
    if (playing?.audio === audio) playing = null;
  };
  audio.addEventListener('ended', done);
  // A missing clip should look like nothing happened, not like a broken button.
  audio.addEventListener('error', done);
  audio.play().catch(done);
}

/**
 * Show the button only where speaking the word would not simply answer the
 * question — beside the prompt when the prompt is already Spanish, and only
 * after answering when the Spanish is what was being asked for.
 */
function renderSpeakers() {
  const question = game?.state.question;
  const show =
    Boolean(question) && hasClip(spoken, question.word.es) && canPlay(question.direction);

  ui.speakPrompt.hidden = !show;
  ui.speakPromptDots.hidden = !show;
  if (show) renderDots();
}

function populateDecks() {
  const options = [{ id: ALL_DECK_ID, emoji: '🌎', name: 'All words' }, ...DECKS];
  const selected = ui.deck.value;
  ui.deck.innerHTML = '';
  for (const deck of options) {
    const option = document.createElement('option');
    option.value = deck.id;
    // Filled stars show how deep the deck is open, at a glance in the list.
    // The filled one is the emoji star rather than U+2605 because option text
    // cannot be styled per-character — an emoji carries its own gold.
    //
    // "All words" reports the depth every category shares, not the deepest one
    // reached anywhere: a star there claims the whole thing is open, and one
    // category racing ahead would otherwise show progress nobody has made.
    const depth = deck.id === ALL_DECK_ID
      ? commonDepth(store.cards)
      : unlockedDepth(deck.id, store.cards);
    const stars = STAGE_NAMES.map((_, i) => (i <= depth ? '⭐' : '☆')).join('');
    option.textContent = `${deck.emoji} ${deck.name}  ${stars}`;
    ui.deck.append(option);
  }
  if (selected) ui.deck.value = selected;
}

function renderStages() {
  const deckId = ui.deck.value;
  const report = deckProgress(deckId, store.cards);
  ui.stageRow.innerHTML = '';

  report.forEach((info, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'stage';
    button.disabled = !info.unlocked;
    button.setAttribute('aria-pressed', String(stages.includes(index)));

    const name = document.createElement('span');
    name.className = 'stage-name';
    name.textContent = info.unlocked ? STAGE_NAMES[index] : `🔒 ${STAGE_NAMES[index]}`;

    const meta = document.createElement('span');
    meta.className = 'stage-meta';
    meta.textContent = info.unlocked
      ? `${info.mastered}/${info.total} mastered`
      : 'locked';

    // The bar and the count measure different things, and a full-looking bar
    // beside a small count reads as a contradiction without this. The bar is
    // mastery — how far every word has climbed — which is what opens the next
    // stage; the count is only the words that reached the top box.
    if (info.unlocked) {
      const percent = Math.round(info.mastery * 100);
      button.title =
        `${percent}% mastery — the bar. ${info.mastered} of ${info.total} ` +
        `words have reached the top box.` +
        (index + 1 < STAGE_NAMES.length
          ? ` ${STAGE_NAMES[index + 1]} opens at 60%.`
          : '');
    }

    const fill = document.createElement('span');
    fill.className = 'stage-fill';
    fill.style.width = `${Math.round(info.mastery * 100)}%`;

    button.append(name, meta, fill);
    button.addEventListener('click', () => {
      // Toggling, not choosing — Basics and Everyday can be studied together.
      // The last one cannot be turned off, because a round with no words is not
      // a state worth being able to reach.
      const next = stages.includes(index)
        ? stages.filter((s) => s !== index)
        : [...stages, index];
      if (next.length === 0) return;
      stages = next.sort();
      startGame();
    });
    ui.stageRow.append(button);
  });

  const next = nextUnlock(deckId, store.cards);
  if (!next) {
    ui.unlockNote.textContent = 'Every stage in this deck is open.';
  } else {
    const now = Math.round(next.mastery * 100);
    const goal = Math.round(next.threshold * 100);
    ui.unlockNote.innerHTML =
      `<strong>${STAGE_NAMES[next.stage]}</strong> unlocks at ${goal}% mastery of ` +
      `${STAGE_NAMES[next.from]} — you're at ${now}%.`;
  }
}

function startGame() {
  const deckId = ui.deck.value;
  // Switching decks can leave stages selected that this deck has not opened.
  const depth = unlockedDepth(deckId, store.cards);
  stages = stages.filter((index) => index <= depth);
  if (stages.length === 0) stages = [0];

  depthAtRoundStart = depth;
  game = createGame({
    deckId,
    stages,
    direction: ui.direction.value,
    cards: store.cards
  });
  ui.summary.hidden = true;
  ui.play.hidden = false;
  ui.unlockBanner.hidden = true;
  ui.goalBanner.hidden = true;
  roundCredited = false;
  game.startRound();
  renderStages();
  render();
}

/**
 * The scoreboard: today's goal, the day streak, and how the deck is going.
 * One function so the four tiles can never disagree with each other.
 */
function renderScoreboard() {
  const streak = streakFrom(store.days, localDay(), store.guards);

  ui.today.textContent = `${Math.min(streak.roundsToday, DAILY_GOAL)}/${DAILY_GOAL}`;
  ui.goalFill.style.width = `${goalProgress(store.days) * 100}%`;
  ui.todayStat.classList.toggle('met', streak.hitToday);
  ui.streak.textContent = streak.current;
  ui.streak.classList.toggle('lit', streak.current > 0);

  const guarded = streak.guard === GUARD.GUARDED;
  ui.streakStat.classList.toggle('guarded', guarded);
  ui.guardShield.classList.toggle('on', guarded);
  ui.guardShield.title = guarded ? 'Streak guard is on' : 'Streak guard';
  ui.mastered.textContent = game ? game.masteredCount() : 0;
  ui.mastery.textContent = game ? `${Math.round(game.mastery() * 100)}%` : '0%';

  renderNote(streak);
}

/**
 * The one line under the scoreboard, which two things want to use.
 *
 * A tile being pointed at wins, because it was asked for. Otherwise it falls
 * back to the grace warning, which nobody asked for but needs to be seen. One
 * element rather than two, so they cannot both appear and argue.
 */
let hoveredTip = null;

function renderNote(streak = streakFrom(store.days, localDay(), store.guards)) {
  const note = ui.scoreboardNote;

  if (hoveredTip) {
    note.textContent = hoveredTip;
    note.className = 'scoreboard-note';
    return;
  }

  if (streak.guard === GUARD.GUARDED) {
    ui.streakStat.classList.remove('at-risk');
    note.textContent =
      `Streak guard is on — your ${streak.current}-day streak is held until you turn it off.`;
    note.className = 'scoreboard-note warning';
    return;
  }

  const missed = GRACE_DAYS - streak.graceDaysLeft;
  const atRisk = streak.current > 0 && !streak.hitToday && missed > 0;
  ui.streakStat.classList.toggle('at-risk', atRisk);

  if (!atRisk) {
    note.textContent = '';
    note.className = 'scoreboard-note';
    return;
  }

  const left = streak.graceDaysLeft;
  const rounds = DAILY_GOAL - streak.roundsToday;
  note.innerHTML =
    `Your <strong>${streak.current}-day streak</strong> has ${left} day${left === 1 ? '' : 's'} ` +
    `of grace left — ${rounds} more round${rounds === 1 ? '' : 's'} today keeps it, or ` +
    `<button class="linkish" data-open-guard>pause it</button>.`;
  note.className = 'scoreboard-note warning';
}



function render() {
  const { state } = game;
  renderScoreboard();
  ui.roundProgress.style.width = `${(state.asked / state.roundLength) * 100}%`;

  const question = state.question;
  if (!question) return;

  // Direction is per question now, not per round — on a mixed round the two
  // alternate, so the hint and the prompt's language have to follow the
  // question rather than the setting that produced it.
  const side = DIRECTIONS[question.direction].promptSide;
  ui.directionHint.textContent =
    side === 'es' ? 'What does it mean…?' : 'How do you say…?';

  ui.prompt.textContent = question.prompt;
  ui.prompt.lang = side;
  ui.choices.innerHTML = '';
  question.choices.forEach((choice, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice';
    button.dataset.choice = choice;
    button.innerHTML = `<span class="key">${index + 1}</span><span class="text"></span>`;
    button.querySelector('.text').textContent = choice;
    button.addEventListener('click', () => submit(choice));
    ui.choices.append(button);
  });
  ui.feedback.textContent = ' ';
  ui.feedback.className = 'feedback';
  ui.variantNote.hidden = true;
  ui.variantNote.textContent = '';
  ui.hint.innerHTML =
    'Answer with <kbd>1</kbd>\u2013<kbd>4</kbd> \u00b7 <kbd>Enter</kbd> to continue';
  ui.hint.classList.remove('waiting');
  renderSpeakers();
}

/**
 * Show where else in the Spanish-speaking world this word goes by another name.
 * Only ever called after an answer — in the English -> Spanish direction these
 * variants would otherwise hand over the answer.
 */
function showVariants(word) {
  if (!word.alt?.length) return;

  ui.variantNote.textContent = 'Also ';
  word.alt.forEach((variant, index) => {
    if (index > 0) ui.variantNote.append(', ');
    const name = document.createElement('span');
    name.className = 'variant-word';
    name.textContent = variant.es;
    const region = document.createElement('span');
    region.className = 'variant-region';
    region.textContent = ` ${variant.region}`;
    ui.variantNote.append(name, region);
  });
  ui.variantNote.hidden = false;
}

function submit(choice) {
  if (!game.state.question || game.state.lastAnswer) return;

  const result = game.answer(choice);
  // Recorded whether or not anyone is signed in: history kept from the start
  // is history a later sign-in can actually carry with it.
  queueReview({
    id: newReviewId(),
    wordEs: result.question.word.es,
    deckId: game.state.deckId,
    stage: result.question.word.stage,
    direction: result.question.direction,
    correct: result.correct,
    reviewedAt: result.at
  });
  store = withCards(store, game.state.cards);
  save(store);

  // Let go of the tapped button before disabling it. A disabled element that
  // still holds focus keeps its ring in some mobile browsers, and the keyboard
  // route reads from the document rather than the button, so nothing is lost.
  document.activeElement?.blur?.();

  for (const button of ui.choices.querySelectorAll('.choice')) {
    const value = button.dataset.choice;
    button.disabled = true;
    if (value === result.question.answer) button.classList.add('correct');
    else if (value === choice) button.classList.add('wrong');
  }

  chime(result.correct);
  ui.feedback.className = `feedback ${result.correct ? 'good' : 'bad'}`;
  ui.feedback.textContent = result.correct
    ? 'Correct!'
    : `${result.question.prompt} = ${result.question.answer}`;

  showVariants(result.question.word);
  renderSpeakers();

  // The stage row is derived from the cards too, and every answer moves one.
  // Without this it keeps showing whatever was true when the round began, so a
  // bar and a count rendered moments apart disagree with each other.
  renderStages();
  renderScoreboard();
  ui.roundProgress.style.width = `${(game.state.asked / game.state.roundLength) * 100}%`;

  // A correct answer moves on by itself; a miss waits. The moment you got
  // something wrong is the one worth sitting with, and 1.6 seconds was only
  // ever a guess at how long that takes to read.
  if (result.correct) {
    setTimeout(advance, 700);
  } else {
    ui.hint.textContent = 'Tap anywhere or press Enter to continue';
    ui.hint.classList.add('waiting');
  }
}

function advance() {
  if (!game.state.lastAnswer) return;
  if (game.isRoundOver()) return showSummary();
  game.nextQuestion();
  render();
}

/**
 * Credit a finished round against today, and queue it for the account.
 *
 * Only completed rounds count, so this is the one place a day advances. The
 * streak is derived from these day counts rather than tracked as a number of
 * its own — the same reason cards are derived from reviews: a stored counter
 * drifts across devices and cannot be repaired, a derived one cannot.
 */
function creditRound() {
  const day = localDay();
  const before = streakFrom(store.days, day, store.guards);

  store = withDays(store, recordRound(store.days, day));
  save(store);

  queueRound({
    id: newReviewId(),
    localDay: day,
    deckId: game.state.deckId,
    stage: Math.min(...game.state.stages),
    stages: game.state.stages.join(','),
    direction: game.state.direction,
    asked: game.state.asked,
    correct: game.state.correct,
    startedAt: game.state.startedAt,
    endedAt: Date.now()
  });

  // Playing is the clearest possible signal that the hold is no longer wanted.
  const released = before.guard === GUARD.GUARDED;
  if (released) setGuard(GUARD.ACTIVE);

  return { before, after: streakFrom(store.days, day, store.guards), released };
}

/** The one line at the top of the summary worth reading. */
function renderGoalBanner({ before, after }) {
  ui.goalBanner.className = 'goal-banner';

  if (after.hitToday && !before.hitToday) {
    ui.goalBanner.textContent = after.current > 1
      ? `🎯 Goal met — ${after.current} day streak!`
      : '🎯 Daily goal met!';
    ui.goalBanner.hidden = false;
    return;
  }

  // Mid-streak but not there yet: say what is at stake, once it is close.
  const left = DAILY_GOAL - after.roundsToday;
  if (!after.hitToday && after.current > 0 && after.graceDaysLeft <= 1) {
    ui.goalBanner.className = 'goal-banner warning';
    ui.goalBanner.textContent =
      `${left} more round${left === 1 ? '' : 's'} today to keep your ${after.current}-day streak.`;
    ui.goalBanner.hidden = false;
    return;
  }
  ui.goalBanner.hidden = true;
}

function showSummary() {
  // Answering schedules advance() on a timer, and Enter calls it too, so the
  // end of a round can be reached more than once for the same round — the
  // guard in advance() only checks that an answer exists, and the last answer
  // of a round is never cleared. Crediting the day is not idempotent, so it
  // has to be gated here rather than relying on only being called once.
  if (roundCredited) return;
  roundCredited = true;

  const streaks = creditRound();
  syncProgress();

  ui.play.hidden = true;
  ui.summary.hidden = false;
  populateDecks();
  renderStages();
  renderScoreboard();
  renderGoalBanner(streaks);

  // Crossing the threshold mid-round is the reward; call it out first.
  const depth = unlockedDepth(ui.deck.value, store.cards);
  const unlocked = depth > depthAtRoundStart;
  ui.unlockBanner.hidden = !unlocked;
  if (unlocked) ui.unlockBanner.textContent = `🔓 ${STAGE_NAMES[depth]} unlocked!`;
  depthAtRoundStart = depth;

  ui.summaryAccuracy.textContent = `${Math.round(game.accuracy() * 100)}%`;
  ui.summaryToday.textContent = `${streaks.after.roundsToday}/${DAILY_GOAL}`;
  ui.summaryMastered.textContent = game.masteredCount();
  ui.summaryLongest.textContent = streaks.after.longest;

  // After the summary is up, so the notice lands on top of it rather than
  // being the first thing seen and hiding what the round achieved.
  if (streaks.released) noticeGuard(GUARD.ACTIVE, true);
}

document.addEventListener('keydown', (event) => {
  // A dialog owns the keyboard while it is up. The transfer one has text
  // fields, where 1-4 has to type digits rather than answer the question.
  if (document.querySelector('dialog[open]')) return;
  if (event.key >= '1' && event.key <= '4' && !ui.play.hidden) {
    const button = ui.choices.children[Number(event.key) - 1];
    if (button && !button.disabled) button.click();
  }
  if (event.key === 'Enter') {
    if (!ui.summary.hidden) startGame();
    else advance();
  }
});

/**
 * "Mixed (recommended)" does not fit a phone's select, and a native option
 * cannot be trimmed with CSS — it truncates to "Mixed (reco…", which reads as
 * a mistake. The word is dropped where there is no room for it and kept where
 * there is, rather than being lost everywhere to satisfy the narrowest case.
 */
function fitDirectionLabels() {
  const narrow = window.matchMedia('(max-width: 460px)').matches;
  for (const option of ui.direction.options) {
    const wanted = narrow ? option.dataset.short : option.dataset.full;
    if (wanted) option.textContent = wanted;
  }
}

window.matchMedia('(max-width: 460px)').addEventListener('change', fitDirectionLabels);

ui.deck.addEventListener('change', startGame);
ui.direction.addEventListener('change', startGame);
// Tapping the card carries on after a miss — a phone has no Enter key. Buttons
// inside keep their own jobs, so the speaker still just speaks.
ui.play.addEventListener('click', (event) => {
  if (event.target.closest('button')) return;
  advance();
});

function renderSound() {
  ui.sound.textContent = muted ? 'Sound off' : 'Sound on';
  ui.sound.setAttribute('aria-pressed', String(!muted));
}

ui.sound.addEventListener('click', () => {
  muted = setMuted(!muted);
  renderSound();
  if (!muted) chime(true);   // so the choice is audible immediately
});

ui.again.addEventListener('click', startGame);

/**
 * Show the account control, but only where there is an API to back it. Served
 * from GitHub Pages or the single-file build there is none, and a sign-in
 * button that cannot work is worse than no button at all.
 */
async function renderAccount() {
  account = await fetchMe();
  if (!account) return; // no API behind this copy — leave the whole block hidden

  ui.auth.hidden = false;
  ui.signIn.hidden = account.signedIn;
  ui.authUser.hidden = !account.signedIn;
  if (account.signedIn) {
    ui.authName.textContent = account.name;
    ui.accountName.textContent = account.name;
  }
}

/**
 * Push queued answers, take back whatever the account knows.
 *
 * The outbox is only cleared for ids the server confirms, so a dropped
 * response costs a retry rather than the answers themselves — re-sending is
 * free, because the server ignores ids it has already stored.
 */
async function syncProgress() {
  if (!account?.signedIn) return;

  // The first sync of a browser is a special case, and getting it wrong
  // silently inflates every word. Progress earned while signed out exists in
  // two overlapping forms here: the card map, and the queued answers that
  // produced it. Sending both would fold those answers on top of a snapshot
  // that already contains them, promoting every word a second time.
  //
  // So the snapshot wins for the handover — it is the complete picture,
  // including progress from before answers were ever recorded — and the queue
  // is dropped rather than sent. Granular history starts from the account.
  if (store.syncedAt === 0) {
    const imports = Object.entries(store.cards).map(([wordEs, card]) => ({ wordEs, ...card }));
    const days = Object.entries(store.days).map(([localDayName, rounds]) => ({
      localDay: localDayName,
      rounds
    }));
    const result = await sync({
      since: 0, reviews: [], imports, days, rounds: readRoundOutbox(), guards: store.guards
    });
    if (!result) return;

    clearQueued(readOutbox().map((entry) => entry.id));
    clearQueuedRounds(result.acceptedRounds ?? []);
    applySync(result);
    return;
  }

  // Afterwards it is just answers. Drained in batches so a long offline run
  // catches up in one go, bounded so a server that keeps refusing cannot spin.
  for (let pass = 0; pass < 5; pass++) {
    const queued = readOutbox();
    const rounds = readRoundOutbox();
    // Guards go every time: there is no outbox for them, and a pause with
    // nothing else pending would otherwise never leave this browser.
    if (queued.length === 0 && rounds.length === 0 && pass > 0) return;

    const result = await sync({
      since: store.syncedAt,
      reviews: queued.slice(0, SYNC_BATCH),
      rounds,
      guards: store.guards
    });
    if (!result) return; // offline or refused — the outbox keeps everything

    clearQueued(result.accepted);
    clearQueuedRounds(result.acceptedRounds ?? []);
    applySync(result);
  }
}

/**
 * Take the server's answer as the truth. Its cards are the fold over every
 * device's history including the answers just pushed, so they cannot be behind
 * what this browser holds.
 */
function applySync(result) {
  store = {
    ...store,
    cards: { ...store.cards, ...result.cards },
    // The server counts rounds from every device, so its day totals are the
    // real ones — this browser only ever knew its own.
    days: result.days ?? store.days,
    syncedAt: result.serverTime
  };
  store = withDays(store, store.days);
  if (result.guards) store = withGuards(store, result.guards);
  save(store);

  // The round in play holds its own copy of the cards; without this it would
  // write that now-stale copy back over what just arrived.
  game?.adoptCards(result.cards);

  populateDecks();
  renderStages();
  renderScoreboard();
}

/**
 * The OAuth round trip comes back to `/?auth=ok` or `/?auth=failed`. Report
 * only the failure — arriving signed in speaks for itself — then drop the
 * parameter so a refresh does not replay a stale message.
 */
function readAuthResult() {
  const result = new URL(location.href).searchParams.get('auth');
  if (!result) return;

  if (result === 'failed') {
    ui.authNote.textContent = 'Sign-in did not complete. Please try again.';
    ui.authNote.hidden = false;
  }
  history.replaceState(null, '', location.pathname);
}

/**
 * Say when the guard changes, whichever way and whoever caused it.
 *
 * The release matters most: finishing a round turns the guard off without
 * anybody asking, and a hold quietly disappearing is exactly the kind of thing
 * someone discovers a fortnight later when their streak is gone.
 */
function noticeGuard(state, released) {
  ui.guardNoticeTitle.textContent =
    state === GUARD.GUARDED ? 'Streak guard on' : 'Streak guard off';
  ui.guardNoticeBody.textContent =
    state === GUARD.GUARDED
      ? 'Your streak is held. It will not run down while this is on, and finishing a round turns it off again.'
      : released
        ? 'You finished a round, so the guard stepped aside and your streak is running again.'
        : 'Your streak is running again, and the usual three-day grace applies.';
  ui.guardNotice.showModal();
}

function openGuardDialog() {
  const streak = streakFrom(store.days, localDay(), store.guards);
  const guarded = streak.guard === GUARD.GUARDED;

  ui.guardBody.textContent = guarded
    ? `Your ${streak.current}-day streak is held. It will not run down until you turn this off.`
    : 'Your streak is running normally.';

  ui.guardToggle.textContent = guarded ? 'Resume my streak' : 'Pause my streak';
  ui.guardDialog.showModal();
}

/** Append a guard change and save. Returns the state now in force. */
function setGuard(state) {
  store = withGuards(store, [...store.guards, guardEvent(state)]);
  save(store);
  renderScoreboard();
  syncProgress();
  return state;
}

ui.streakStat.addEventListener('click', openGuardDialog);
ui.guardShield.addEventListener('click', openGuardDialog);

// Delegated, because the note's markup is rebuilt every time it is drawn.
ui.scoreboardNote.addEventListener('click', (event) => {
  if (event.target.closest('[data-open-guard]')) openGuardDialog();
});
ui.guardClose.addEventListener('click', () => ui.guardDialog.close());

ui.guardToggle.addEventListener('click', () => {
  const guarded = streakFrom(store.days, localDay(), store.guards).guard === GUARD.GUARDED;
  ui.guardDialog.close();
  noticeGuard(setGuard(guarded ? GUARD.ACTIVE : GUARD.GUARDED), false);
});

ui.guardNoticeOk.addEventListener('click', () => ui.guardNotice.close());

function setTransferStatus(message, tone = '') {
  ui.transferStatus.textContent = message;
  ui.transferStatus.className = `transfer-status ${tone}`;
}

ui.transfer.addEventListener('click', () => {
  ui.transferOut.value = exportProgress(store);
  ui.transferIn.value = '';
  setTransferStatus('');
  ui.transferDialog.showModal();
});

ui.transferCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(ui.transferOut.value);
    setTransferStatus('Copied.', 'good');
  } catch {
    // No clipboard permission, or an insecure origin. Selecting the text still
    // leaves the reader one keystroke away from having it.
    ui.transferOut.select();
    setTransferStatus('Selected — press ⌘C or Ctrl+C to copy.');
  }
});

ui.transferImport.addEventListener('click', () => {
  let incoming;
  try {
    incoming = parseProgress(ui.transferIn.value.trim());
  } catch (error) {
    return setTransferStatus(error.message, 'bad');
  }

  const words = Object.keys(incoming.cards).length;
  store = incoming;
  save(store);
  stage = 0;
  populateDecks();
  startGame();

  setTransferStatus(`Restored ${words} word${words === 1 ? '' : 's'}.`, 'good');
  ui.transferOut.value = exportProgress(store);
  ui.transferIn.value = '';
});

ui.transferClose.addEventListener('click', () => ui.transferDialog.close());

ui.account.addEventListener('click', () => ui.accountDialog.showModal());
ui.accountClose.addEventListener('click', () => ui.accountDialog.close());

ui.signOut.addEventListener('click', async () => {
  await signOut();
  location.assign('/');
});

// Deleting an account is asked twice on purpose. The first asks whether, and
// says exactly what will go; the second asks the person to type the word, which
// is the difference between a mis-click and a decision.
ui.deleteStart.addEventListener('click', () => {
  const words = Object.keys(store.cards).length;
  const streak = streakFrom(store.days);
  ui.deleteBody.textContent =
    `This deletes progress on ${words} word${words === 1 ? '' : 's'}, your ` +
    `${streak.current}-day streak, and every answer you have given — from this ` +
    `browser and from the account, on every device you have signed in on.`;
  ui.accountDialog.close();
  ui.deleteDialog.showModal();
});

ui.deleteCancel.addEventListener('click', () => ui.deleteDialog.close());

ui.deleteContinue.addEventListener('click', () => {
  ui.deleteDialog.close();
  ui.deleteTyped.value = '';
  ui.deleteConfirm.disabled = true;
  ui.deleteStatus.textContent = '';
  ui.deleteStatus.className = 'transfer-status';
  ui.deleteFinal.showModal();
});

ui.deleteTyped.addEventListener('input', () => {
  ui.deleteConfirm.disabled = ui.deleteTyped.value.trim().toLowerCase() !== 'delete';
});

ui.deleteFinalCancel.addEventListener('click', () => ui.deleteFinal.close());

ui.deleteConfirm.addEventListener('click', async () => {
  ui.deleteConfirm.disabled = true;
  ui.deleteStatus.className = 'transfer-status';
  ui.deleteStatus.textContent = 'Deleting…';

  if (!(await deleteAccount())) {
    ui.deleteStatus.className = 'transfer-status bad';
    ui.deleteStatus.textContent = 'That did not go through. Nothing was deleted — try again.';
    ui.deleteConfirm.disabled = false;
    return;
  }

  // Only once the server has confirmed. Local progress goes too: leaving it
  // behind would hand it straight back as an import on the next sign-in,
  // resurrecting exactly what was just deleted.
  reset();
  location.assign('/');
});

// Explaining a tile on hover, and on focus so it also works by keyboard and by
// tapping on a phone, where there is no hover at all.
for (const tile of document.querySelectorAll('[data-tip]')) {
  const show = () => { hoveredTip = tile.dataset.tip; renderNote(); };
  const hide = () => { hoveredTip = null; renderNote(); };
  tile.addEventListener('mouseenter', show);
  tile.addEventListener('focus', show);
  tile.addEventListener('mouseleave', hide);
  tile.addEventListener('blur', hide);
}

for (const button of [ui.speakPrompt]) {
  button.addEventListener('click', () => {
    const word = game?.state.question?.word;
    if (word) speak(button, word);
  });
}

fitDirectionLabels();
renderSound();
populateDecks();
startGame();
loadAudioManifest().then(renderSpeakers);
readAuthResult();
renderAccount().then(syncProgress);
