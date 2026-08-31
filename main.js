import { DECKS } from './source/vocab.js';
import { DIRECTIONS } from './source/quiz.js';
import { createGame } from './source/game.js';
import { load, save, withCards, withBests, reset } from './source/storage.js';

const el = (id) => document.getElementById(id);
const ui = {
  deck: el('deck'),
  direction: el('direction'),
  score: el('score'),
  streak: el('streak'),
  mastery: el('mastery'),
  best: el('best'),
  roundProgress: el('round-progress'),
  play: el('play'),
  directionHint: el('direction-hint'),
  prompt: el('prompt'),
  choices: el('choices'),
  feedback: el('feedback'),
  summary: el('summary'),
  summaryScore: el('summary-score'),
  summaryAccuracy: el('summary-accuracy'),
  summaryStreak: el('summary-streak'),
  summaryMastered: el('summary-mastered'),
  again: el('again'),
  reset: el('reset')
};

let store = load();
let game = null;

function populateDecks() {
  const options = [{ id: 'todos', emoji: '🌎', name: 'Todas las palabras' }, ...DECKS];
  ui.deck.innerHTML = '';
  for (const deck of options) {
    const option = document.createElement('option');
    option.value = deck.id;
    option.textContent = `${deck.emoji} ${deck.name}`;
    ui.deck.append(option);
  }
}

function startGame() {
  game = createGame({
    deckId: ui.deck.value,
    direction: ui.direction.value,
    cards: store.cards
  });
  ui.summary.hidden = true;
  ui.play.hidden = false;
  game.startRound();
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
    state.direction === 'es-en' ? '¿Qué significa…?' : '¿Cómo se dice…?';

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
}

function submit(choice) {
  if (!game.state.question || game.state.lastAnswer) return;

  const result = game.answer(choice);
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
    ? `¡Correcto! +${result.points}`
    : `${result.question.prompt} = ${result.question.answer}`;

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
  ui.play.hidden = true;
  ui.summary.hidden = false;
  ui.summaryScore.textContent = game.state.score;
  ui.summaryAccuracy.textContent = `${Math.round(game.accuracy() * 100)}%`;
  ui.summaryStreak.textContent = game.state.bestStreak;
  ui.summaryMastered.textContent = game.masteredCount();
}

document.addEventListener('keydown', (event) => {
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
  store = reset();
  startGame();
});

populateDecks();
startGame();
