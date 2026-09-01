import { DECKS, STAGE_NAMES, ALL_DECK_ID } from './source/vocab.js';
import { DIRECTIONS } from './source/quiz.js';
import { createGame } from './source/game.js';
import {
  load,
  save,
  withCards,
  withBests,
  reset,
  exportProgress,
  parseProgress,
  newReviewId,
  queueReview,
  readOutbox,
  clearQueued
} from './source/storage.js';
import { deckProgress, unlockedDepth, nextUnlock } from './source/stages.js';
import { fetchMe, signOut, sync } from './source/api.js';

const el = (id) => document.getElementById(id);
const ui = {
  deck: el('deck'),
  direction: el('direction'),
  score: el('score'),
  streak: el('streak'),
  mastery: el('mastery'),
  best: el('best'),
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
  summaryScore: el('summary-score'),
  summaryAccuracy: el('summary-accuracy'),
  summaryStreak: el('summary-streak'),
  summaryMastered: el('summary-mastered'),
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
  signOut: el('sign-out')
};

let store = load();
let game = null;
let stage = 0;
let depthAtRoundStart = 0;
let account = null;   // { signedIn, name } once /me has answered, else null

/** Answers per sync request; the server refuses more than 500. */
const SYNC_BATCH = 250;

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
    button.setAttribute('aria-pressed', String(index === stage));

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
      if (index === stage) return;
      stage = index;
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
  // Switching decks can land on a stage this deck has not opened yet.
  stage = Math.min(stage, unlockedDepth(deckId, store.cards));

  depthAtRoundStart = unlockedDepth(deckId, store.cards);
  game = createGame({
    deckId,
    stage,
    direction: ui.direction.value,
    cards: store.cards
  });
  ui.summary.hidden = true;
  ui.play.hidden = false;
  ui.unlockBanner.hidden = true;
  game.startRound();
  renderStages();
  render();
}

function render() {
  const { state } = game;
  ui.score.textContent = state.score;
  ui.streak.textContent = state.streak;
  ui.mastery.textContent = `${Math.round(game.mastery() * 100)}%`;
  ui.best.textContent = store.best.score;
  ui.roundProgress.style.width = `${(state.asked / state.roundLength) * 100}%`;

  ui.directionHint.textContent =
    state.direction === 'es-en' ? 'What does it mean…?' : 'How do you say…?';

  const question = state.question;
  if (!question) return;

  ui.prompt.textContent = question.prompt;
  ui.prompt.lang = DIRECTIONS[state.direction].promptSide === 'es' ? 'es' : 'en';
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
    stage: game.state.stage,
    direction: game.state.direction,
    correct: result.correct,
    reviewedAt: result.at
  });
  store = withBests(withCards(store, game.state.cards), {
    score: game.state.score,
    streak: game.state.bestStreak
  });
  save(store);

  for (const button of ui.choices.querySelectorAll('.choice')) {
    const value = button.dataset.choice;
    button.disabled = true;
    if (value === result.question.answer) button.classList.add('correct');
    else if (value === choice) button.classList.add('wrong');
  }

  ui.feedback.className = `feedback ${result.correct ? 'good' : 'bad'}`;
  ui.feedback.textContent = result.correct
    ? `Correct! +${result.points}`
    : `${result.question.prompt} = ${result.question.answer}`;

  showVariants(result.question.word);

  ui.score.textContent = game.state.score;
  ui.streak.textContent = game.state.streak;
  ui.mastery.textContent = `${Math.round(game.mastery() * 100)}%`;
  ui.best.textContent = store.best.score;
  ui.roundProgress.style.width = `${(game.state.asked / game.state.roundLength) * 100}%`;

  setTimeout(advance, result.correct ? 700 : 1600);
}

function advance() {
  if (!game.state.lastAnswer) return;
  if (game.isRoundOver()) return showSummary();
  game.nextQuestion();
  render();
}

function showSummary() {
  syncProgress();
  ui.play.hidden = true;
  ui.summary.hidden = false;
  populateDecks();
  renderStages();

  // Crossing the threshold mid-round is the reward; call it out before the score.
  const depth = unlockedDepth(ui.deck.value, store.cards);
  const unlocked = depth > depthAtRoundStart;
  ui.unlockBanner.hidden = !unlocked;
  if (unlocked) ui.unlockBanner.textContent = `🔓 ${STAGE_NAMES[depth]} unlocked!`;
  depthAtRoundStart = depth;
  ui.summaryScore.textContent = game.state.score;
  ui.summaryAccuracy.textContent = `${Math.round(game.accuracy() * 100)}%`;
  ui.summaryStreak.textContent = game.state.bestStreak;
  ui.summaryMastered.textContent = game.masteredCount();
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
    ? `This erases progress on ${tracked} word${tracked === 1 ? '' : 's'} and a best score of ` +
      `${store.best.score}, and relocks every stage. It is saved only in this browser, ` +
      `so there is no copy to restore from.`
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
  if (account.signedIn) ui.authName.textContent = account.name;
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
    const result = await sync({ since: 0, reviews: [], imports, best: store.best });
    if (!result) return;

    clearQueued(readOutbox().map((entry) => entry.id));
    applySync(result);
    return;
  }

  // Afterwards it is just answers. Drained in batches so a long offline run
  // catches up in one go, bounded so a server that keeps refusing cannot spin.
  for (let pass = 0; pass < 5; pass++) {
    const queued = readOutbox();
    if (queued.length === 0) return;

    const result = await sync({
      since: store.syncedAt,
      reviews: queued.slice(0, SYNC_BATCH),
      best: store.best
    });
    if (!result) return; // offline or refused — the outbox keeps everything

    clearQueued(result.accepted);
    applySync(result);
  }
}

/**
 * Take the server's answer as the truth. Its cards are the fold over every
 * device's history including the answers just pushed, so they cannot be behind
 * what this browser holds.
 */
function applySync(result) {
  store = withBests(
    { ...store, cards: { ...store.cards, ...result.cards }, syncedAt: result.serverTime },
    result.best
  );
  save(store);

  // The round in play holds its own copy of the cards; without this it would
  // write that now-stale copy back over what just arrived.
  game?.adoptCards(result.cards);

  populateDecks();
  renderStages();
  ui.best.textContent = store.best.score;
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

ui.signOut.addEventListener('click', async () => {
  await signOut();
  location.assign('/');
});

populateDecks();
startGame();
readAuthResult();
renderAccount().then(syncProgress);
