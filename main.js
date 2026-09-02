import { DECKS, STAGE_NAMES, ALL_DECK_ID } from './source/vocab.js';
import { DIRECTIONS } from './source/quiz.js';
import { createGame } from './source/game.js';
import {
  load,
  save,
  withCards,
  withDays,
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
import { deckProgress, unlockedDepth, nextUnlock } from './source/stages.js';
import { fetchMe, signOut, sync, deleteAccount } from './source/api.js';
import { clipUrl, nextVoice, canPlay, hasClip, MANIFEST_URL, VOICE_COUNT } from './source/audio.js';
import {
  DAILY_GOAL,
  GRACE_DAYS,
  localDay,
  streakFrom,
  recordRound,
  goalProgress
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
  reset: el('reset'),
  confirmDialog: el('confirm-reset'),
  confirmBody: el('confirm-body'),
  confirmCancel: el('confirm-cancel'),
  confirmClear: el('confirm-clear'),
  transfer: el('transfer'),
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
  speakPrompt: el('speak-prompt'),
  speakAnswer: el('speak-answer'),
  speakPromptDots: el('speak-prompt-dots'),
  speakAnswerDots: el('speak-answer-dots')
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
  for (const dots of [ui.speakPromptDots, ui.speakAnswerDots]) {
    if (dots.children.length !== VOICE_COUNT) {
      dots.innerHTML = '';
      for (let i = 0; i < VOICE_COUNT; i++) {
        dots.append(Object.assign(document.createElement('span'), { className: 'dot' }));
      }
    }
    [...dots.children].forEach((dot, i) => dot.classList.toggle('on', i === lastVoice));
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
  const answered = Boolean(game?.state.lastAnswer);

  const sayable = Boolean(question) && hasClip(spoken, question.word.es);
  const showPrompt = sayable && canPlay(question.direction, false);
  const showAnswer = sayable && answered && !canPlay(question.direction, false);

  ui.speakPrompt.hidden = !showPrompt;
  ui.speakAnswer.hidden = !showAnswer;
  ui.speakPromptDots.hidden = !showPrompt;
  ui.speakAnswerDots.hidden = !showAnswer;
  if (showPrompt || showAnswer) renderDots();
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
    const depth = unlockedDepth(deck.id, store.cards);
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
  const streak = streakFrom(store.days);

  ui.today.textContent = `${Math.min(streak.roundsToday, DAILY_GOAL)}/${DAILY_GOAL}`;
  ui.goalFill.style.width = `${goalProgress(store.days) * 100}%`;
  ui.todayStat.classList.toggle('met', streak.hitToday);
  ui.streak.textContent = streak.current;
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

function renderNote(streak = streakFrom(store.days)) {
  const note = ui.scoreboardNote;

  if (hoveredTip) {
    note.textContent = hoveredTip;
    note.className = 'scoreboard-note';
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
    `of grace left — ${rounds} more round${rounds === 1 ? '' : 's'} today keeps it.`;
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

  for (const button of ui.choices.querySelectorAll('.choice')) {
    const value = button.dataset.choice;
    button.disabled = true;
    if (value === result.question.answer) button.classList.add('correct');
    else if (value === choice) button.classList.add('wrong');
  }

  ui.feedback.className = `feedback ${result.correct ? 'good' : 'bad'}`;
  ui.feedback.textContent = result.correct
    ? 'Correct!'
    : `${result.question.prompt} = ${result.question.answer}`;

  showVariants(result.question.word);
  renderSpeakers();

  renderScoreboard();
  ui.roundProgress.style.width = `${(game.state.asked / game.state.roundLength) * 100}%`;

  setTimeout(advance, result.correct ? 700 : 1600);
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
  const before = streakFrom(store.days);

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

  return { before, after: streakFrom(store.days) };
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

ui.deck.addEventListener('change', startGame);
ui.direction.addEventListener('change', startGame);
ui.again.addEventListener('click', startGame);
ui.reset.addEventListener('click', () => {
  const tracked = Object.keys(store.cards).length;
  ui.confirmBody.textContent = tracked
    ? `This erases progress on ${tracked} word${tracked === 1 ? '' : 's'}, your ` +
      `${streakFrom(store.days).current}-day streak, and relocks every stage. It is saved ` +
      `only in this browser, so there is no copy to restore from.`
    : 'Nothing is saved on this device yet, so there is nothing to clear.';
  ui.confirmDialog.showModal();
});

ui.confirmCancel.addEventListener('click', () => ui.confirmDialog.close());

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

ui.confirmClear.addEventListener('click', () => {
  ui.confirmDialog.close();
  store = reset();
  stage = 0;
  populateDecks();
  startGame();
});

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
    const result = await sync({ since: 0, reviews: [], imports, days, rounds: readRoundOutbox() });
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
    if (queued.length === 0 && rounds.length === 0) return;

    const result = await sync({
      since: store.syncedAt,
      reviews: queued.slice(0, SYNC_BATCH),
      rounds
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
for (const tile of document.querySelectorAll('.stat[data-tip]')) {
  const show = () => { hoveredTip = tile.dataset.tip; renderNote(); };
  const hide = () => { hoveredTip = null; renderNote(); };
  tile.addEventListener('mouseenter', show);
  tile.addEventListener('focus', show);
  tile.addEventListener('mouseleave', hide);
  tile.addEventListener('blur', hide);
}

for (const button of [ui.speakPrompt, ui.speakAnswer]) {
  button.addEventListener('click', () => {
    const word = game?.state.question?.word;
    if (word) speak(button, word);
  });
}

populateDecks();
startGame();
loadAudioManifest().then(renderSpeakers);
readAuthResult();
renderAccount().then(syncProgress);
