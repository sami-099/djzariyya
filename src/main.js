import './style.css';
import { buildDeck, label } from './lib/wordbank.js';
import { buildQuiz, parseQuestionCount, sidesFor } from './lib/quiz.js';
import { shuffle } from './lib/shuffle.js';

const app = document.querySelector('#app');

// Filled in by init() from the server's API.
let categories = [];
let totalWords = 0; // unique words: a few (e.g. "Hair") are listed under two categories
let build = { version: '', commit: '' };

const state = {
  view: 'setup', // setup | flashcards | quiz | results
  mode: 'flashcards', // flashcards | quiz
  direction: 'da-en', // da-en | en-da
  selected: new Set(),
  length: 'all', // 'all' | 'custom'
  customCount: '', // what was typed into the custom box, unvalidated
  // flashcards
  cards: [],
  index: 0,
  flipped: false,
  // quiz
  questions: [],
  picked: null, // index of the chosen option for the current question
  results: [], // { question, pickedLabel, correct }
};

const esc = (text) =>
  String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const deck = () => buildDeck(categories, state.selected);
const allSelected = () => state.selected.size === categories.length;

/** How many questions to ask: { ok, value } where value is 'all' or a number, or { ok: false, error }. */
function questionCount(size) {
  if (state.mode !== 'quiz' || state.length === 'all') return { ok: true, value: 'all' };
  return parseQuestionCount(state.customCount, size);
}

// ---------- views ----------

function segmented(action, options, current) {
  return `<div class="segmented" role="group">${options
    .map(
      (o) =>
        `<button data-action="${action}" data-value="${o.value}" aria-pressed="${o.value === current}" ${
          o.disabled ? 'disabled' : ''
        }>${esc(o.text)}</button>`,
    )
    .join('')}</div>`;
}

function setupView() {
  const size = deck().length;
  const count = questionCount(size);
  const custom = state.length === 'custom';

  return `
    <header class="masthead">
      <h1>Djzariyya</h1>
      <p>Algerian Arabic &middot; ${totalWords} words in ${categories.length} categories</p>
    </header>

    <section>
      <h2>Mode</h2>
      ${segmented('mode', [{ value: 'flashcards', text: 'Flashcards' }, { value: 'quiz', text: 'Quiz' }], state.mode)}
    </section>

    <section>
      <h2>Direction</h2>
      ${segmented(
        'direction',
        [{ value: 'da-en', text: 'Darija → English' }, { value: 'en-da', text: 'English → Darija' }],
        state.direction,
      )}
    </section>

    <section>
      <div class="row">
        <h2>Word bank</h2>
        <button class="link" data-action="toggle-all">${allSelected() ? 'Clear all' : 'Select all'}</button>
      </div>
      <div class="chips">
        ${categories
          .map(
            (c) =>
              `<button class="chip" data-action="category" data-value="${c.id}" aria-pressed="${state.selected.has(c.id)}">${esc(
                c.name,
              )} <span>${c.words.length}</span></button>`,
          )
          .join('')}
      </div>
      <p class="hint">${
        size
          ? `${size} word${size === 1 ? '' : 's'} selected${allSelected() ? ' (entire word bank)' : ''}`
          : 'Pick at least one category.'
      }</p>
    </section>

    ${
      state.mode === 'quiz'
        ? `<section>
            <h2>Questions</h2>
            <div class="segmented">
              <button id="count-all" data-action="length-all" aria-pressed="${!custom}" ${size ? '' : 'disabled'}>All (${size})</button>
              <input id="count" class="${custom ? 'active' : ''}" type="text" inputmode="numeric" autocomplete="off"
                aria-label="Number of questions" aria-describedby="count-error"
                placeholder="${size > 1 ? `Or type 1–${size}` : 'Or type a number'}" value="${esc(state.customCount)}" ${size ? '' : 'disabled'} />
            </div>
            <p class="hint error" id="count-error" role="alert">${size && !count.ok ? esc(count.error) : ''}</p>
            ${
              size > 0 && size < 4
                ? '<p class="hint">Answer choices come from the selected words, so with fewer than 4 selected each question has fewer choices.</p>'
                : ''
            }
          </section>`
        : ''
    }

    <button class="primary" id="start" data-action="start" ${size && count.ok ? '' : 'disabled'}>
      Start ${state.mode === 'quiz' ? 'quiz' : 'flashcards'}
    </button>

    <footer>${build.version ? `v${esc(build.version)} &middot; ${esc(build.commit)}` : ''}</footer>
  `;
}

function topBar(progress) {
  return `<div class="row topbar">
    <button class="link" data-action="home">← Back</button>
    <span class="progress">${progress}</span>
  </div>`;
}

function faceHtml(word, side) {
  const lang = side === 'darija' ? 'Darija' : 'English';
  const note = side === 'darija' && word.note ? `<span class="note">${esc(word.note)}</span>` : '';
  return `<span class="lang">${lang}</span><span class="term">${esc(label(word, side))}</span>${note}`;
}

function flashcardsView() {
  const word = state.cards[state.index];
  const { promptSide, answerSide } = sidesFor(state.direction);
  const last = state.index === state.cards.length - 1;
  return `
    ${topBar(`Card ${state.index + 1} of ${state.cards.length}`)}
    <button class="card ${state.flipped ? 'flipped' : ''}" data-action="flip" aria-label="Flip card">
      ${faceHtml(word, state.flipped ? answerSide : promptSide)}
      <span class="tap">${state.flipped ? 'Answer' : 'Tap to reveal'}</span>
    </button>
    <div class="row actions">
      <button data-action="prev" ${state.index === 0 ? 'disabled' : ''}>Previous</button>
      <button data-action="reshuffle">Shuffle</button>
      <button data-action="next" ${last ? 'disabled' : ''}>Next</button>
    </div>
    <p class="hint center">Space flips &middot; ← → move between cards</p>
  `;
}

function quizView() {
  const number = state.results.length + (state.picked === null ? 1 : 0);
  const question = state.questions[number - 1];
  const answered = state.picked !== null;
  const score = state.results.filter((r) => r.correct).length;
  const last = number === state.questions.length;
  const { promptSide } = sidesFor(state.direction);

  return `
    ${topBar(`Question ${number} of ${state.questions.length} &middot; Score ${score}`)}
    <div class="prompt">
      <span class="lang">${promptSide === 'darija' ? 'Darija' : 'English'}</span>
      <span class="term">${esc(question.prompt)}</span>
    </div>
    <div class="options">
      ${question.options
        .map((option, i) => {
          let cls = '';
          if (answered && option.correct) cls = 'correct';
          else if (answered && i === state.picked) cls = 'wrong';
          return `<button class="option ${cls}" data-action="answer" data-value="${i}" ${answered ? 'disabled' : ''}>
            <kbd>${i + 1}</kbd><span>${esc(option.label)}</span>
          </button>`;
        })
        .join('')}
    </div>
    ${
      answered
        ? `<button class="primary" data-action="continue">${last ? 'See results' : 'Next question'}</button>`
        : `<p class="hint center">Press 1–${question.options.length} to answer</p>`
    }
  `;
}

function resultsView() {
  const total = state.results.length;
  const score = state.results.filter((r) => r.correct).length;
  const missed = state.results.filter((r) => !r.correct);
  return `
    ${topBar('Results')}
    <div class="score">
      <span class="term">${score} / ${total}</span>
      <span class="lang">${Math.round((score / total) * 100)}% correct</span>
    </div>
    ${
      missed.length
        ? `<section><h2>To review</h2><ul class="review">${missed
            .map(
              (r) => `<li>
                <strong>${esc(r.question.prompt)}</strong>
                <span class="right">${esc(r.question.answer)}</span>
                <span class="yours">You chose: ${esc(r.pickedLabel)}</span>
              </li>`,
            )
            .join('')}</ul></section>`
        : '<p class="hint center">Perfect score.</p>'
    }
    <div class="row actions">
      <button data-action="home">Change settings</button>
      <button class="primary" data-action="start">New quiz</button>
    </div>
  `;
}

const views = { setup: setupView, flashcards: flashcardsView, quiz: quizView, results: resultsView };

function render() {
  app.innerHTML = views[state.view]();
}

// ---------- actions ----------

function start() {
  const pool = deck();
  const count = questionCount(pool.length);
  if (!pool.length || !count.ok) return;
  if (state.mode === 'flashcards') {
    state.cards = shuffle(pool);
    state.index = 0;
    state.flipped = false;
    state.view = 'flashcards';
  } else {
    state.questions = buildQuiz({ pool, count: count.value, direction: state.direction });
    state.results = [];
    state.picked = null;
    state.view = 'quiz';
  }
}

function move(step) {
  const next = state.index + step;
  if (next < 0 || next >= state.cards.length) return;
  state.index = next;
  state.flipped = false;
}

function answer(i) {
  if (state.picked !== null) return;
  const question = state.questions[state.results.length];
  const option = question.options[i];
  if (!option) return;
  state.picked = i;
  state.results.push({ question, pickedLabel: option.label, correct: option.correct });
}

function continueQuiz() {
  if (state.picked === null) return;
  state.picked = null;
  if (state.results.length === state.questions.length) state.view = 'results';
}

const actions = {
  mode: (v) => (state.mode = v),
  direction: (v) => (state.direction = v),
  'length-all': () => {
    state.length = 'all';
    state.customCount = '';
  },
  category: (v) => (state.selected.has(v) ? state.selected.delete(v) : state.selected.add(v)),
  'toggle-all': () => (state.selected = new Set(allSelected() ? [] : categories.map((c) => c.id))),
  start,
  home: () => (state.view = 'setup'),
  flip: () => (state.flipped = !state.flipped),
  prev: () => move(-1),
  next: () => move(1),
  reshuffle: () => {
    state.cards = shuffle(state.cards);
    state.index = 0;
    state.flipped = false;
  },
  answer: (v) => answer(Number(v)),
  continue: continueQuiz,
};

app.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  actions[button.dataset.action](button.dataset.value);
  render();
});

// Typing a custom question count. The screen is not re-rendered here (that
// would reset the cursor); only the parts that depend on the value change.
app.addEventListener('input', (event) => {
  if (event.target.id !== 'count') return;
  state.customCount = event.target.value;
  state.length = state.customCount.trim() === '' ? 'all' : 'custom';
  const size = deck().length;
  const count = questionCount(size);
  const custom = state.length === 'custom';
  event.target.classList.toggle('active', custom);
  document.querySelector('#count-all').setAttribute('aria-pressed', String(!custom));
  document.querySelector('#count-error').textContent = count.ok ? '' : count.error;
  document.querySelector('#start').disabled = !size || !count.ok;
});

app.addEventListener('keydown', (event) => {
  if (event.target.id !== 'count' || event.key !== 'Enter') return;
  start();
  render();
});

document.addEventListener('keydown', (event) => {
  // Let focused buttons handle their own Enter/Space.
  const onButton = event.target.closest?.('button');
  const confirm = event.key === 'Enter' || event.key === ' ';
  if (onButton && confirm) return;

  if (state.view === 'flashcards') {
    if (confirm) actions.flip();
    else if (event.key === 'ArrowRight') move(1);
    else if (event.key === 'ArrowLeft') move(-1);
    else return;
  } else if (state.view === 'quiz') {
    if (/^[1-4]$/.test(event.key)) answer(Number(event.key) - 1);
    else if (confirm) continueQuiz();
    else return;
  } else {
    return;
  }
  event.preventDefault();
  render();
});

// ---------- startup ----------

async function getJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} responded ${res.status}`);
  return res.json();
}

async function init() {
  app.innerHTML = '<p class="hint center">Loading word bank…</p>';
  try {
    const data = await getJson('api/wordbank');
    categories = data.categories;
    totalWords = buildDeck(categories, categories.map((c) => c.id)).length;
    state.selected = new Set(categories.map((c) => c.id));
  } catch (error) {
    console.error(error);
    app.innerHTML = `<p class="hint center">Could not load the word bank from the server.</p>
      <button class="primary" id="retry">Try again</button>`;
    document.querySelector('#retry').addEventListener('click', init);
    return;
  }
  render();
  // The version stamp is nice-to-have: never block the app on it.
  getJson('api/version')
    .then((info) => {
      build = info;
      if (state.view === 'setup') render();
    })
    .catch(() => {});
}

init();
