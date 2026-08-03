import { fetchWordBank, languageLabel } from './data.js';
import {
  availableLanguages,
  availableLevels,
  availableCategories,
  buildPool,
  createDealer,
} from './wordbank.js';
import * as sfx from './sfx.js';

const STORAGE_KEY = 'watchword-setup-v1';

const screens = {
  setup: document.getElementById('setupScreen'),
  handoff: document.getElementById('handoffScreen'),
  play: document.getElementById('playScreen'),
  result: document.getElementById('resultScreen'),
  final: document.getElementById('finalScreen'),
};

const teamInput = document.getElementById('teamInput');
const languageSelect = document.getElementById('languageSelect');
const levelPills = document.getElementById('levelPills');
const categoryPills = document.getElementById('categoryPills');
const toggleLevels = document.getElementById('toggleLevels');
const toggleCategories = document.getElementById('toggleCategories');
const secondsInput = document.getElementById('secondsInput');
const targetInput = document.getElementById('targetInput');
const relatedInput = document.getElementById('relatedInput');
const phrasesInput = document.getElementById('phrasesInput');
const bankStatus = document.getElementById('bankStatus');
const poolSummary = document.getElementById('poolSummary');
const setupError = document.getElementById('setupError');
const startGameBtn = document.getElementById('startGame');
const resetSetupBtn = document.getElementById('resetSetup');

const handoffTeam = document.getElementById('handoffTeam');
const handoffRules = document.getElementById('handoffRules');
const beginTurnBtn = document.getElementById('beginTurn');
const handoffBackBtn = document.getElementById('handoffBack');

const playTeam = document.getElementById('playTeam');
const playScore = document.getElementById('playScore');
const playTarget = document.getElementById('playTarget');
const timerText = document.getElementById('timerText');
const timerFill = document.getElementById('timerFill');
const wordCategory = document.getElementById('wordCategory');
const wordDisplay = document.getElementById('wordDisplay');
const correctBtn = document.getElementById('correctBtn');
const passBtn = document.getElementById('passBtn');
const pauseBtn = document.getElementById('pauseBtn');
const endTurnBtn = document.getElementById('endTurnBtn');

const resultTeam = document.getElementById('resultTeam');
const resultHeadline = document.getElementById('resultHeadline');
const resultStats = document.getElementById('resultStats');
const resultWords = document.getElementById('resultWords');
const nextTurnBtn = document.getElementById('nextTurnBtn');

const winnerText = document.getElementById('winnerText');
const scoreboard = document.getElementById('scoreboard');
const playAgainBtn = document.getElementById('playAgainBtn');
const backToSetupBtn = document.getElementById('backToSetupBtn');

const muteBtn = document.getElementById('muteBtn');
const blackout = document.getElementById('blackout');

// Cancels the pending final-score reveal, when one is waiting on the music.
let cancelReveal = null;

const DEFAULTS = {
  teams: ['Team 1', 'Team 2'],
  language: 'en',
  levels: [],
  categories: [],
  seconds: 120,
  target: 5,
  includeRelated: true,
  allowPhrases: false,
  muted: false,
};

let bank = {};
let settings = { ...DEFAULTS };

// Live game state, rebuilt on every "Start game".
let game = null;

// Turn state, rebuilt on every team's turn.
let turn = null;

/* ─── Screens ─────────────────────────────────────────────────── */

function showScreen(name) {
  // Whatever the route, changing screen lifts the blackout — no navigation
  // should ever be able to leave the device showing a black rectangle.
  if (cancelReveal) {
    cancelReveal();
    cancelReveal = null;
  }
  blackout.classList.add('hidden');

  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('hidden', key !== name);
  });
}

/* ─── Setup persistence ───────────────────────────────────────── */

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable — settings just won't persist */
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) settings = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    settings = { ...DEFAULTS };
  }
}

/* ─── Setup rendering ─────────────────────────────────────────── */

function checkedValues(container) {
  return Array.from(container.querySelectorAll('input:checked')).map((i) => i.value);
}

function renderPills(container, values, selected) {
  container.innerHTML = '';
  values.forEach((value) => {
    const wrapper = document.createElement('label');
    wrapper.className = 'pill-option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = value;
    input.checked = selected.includes(value);
    input.className = 'hidden-input';
    const badge = document.createElement('span');
    badge.className = 'pill-badge';
    badge.textContent = value;
    wrapper.append(input, badge);
    container.appendChild(wrapper);
  });
}

// Read straight from the checkboxes: the filter lists have to redraw the moment
// one changes, before any of it is committed to settings.
function currentRules() {
  return { includeRelated: relatedInput.checked, allowPhrases: phrasesInput.checked };
}

function renderLanguages() {
  const languages = availableLanguages(bank, currentRules());
  languageSelect.innerHTML = '';
  languages.forEach((code) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = languageLabel(code);
    languageSelect.appendChild(option);
  });
  if (!languages.includes(settings.language)) {
    settings.language = languages[0] || '';
  }
  languageSelect.value = settings.language;
}

function renderLevels() {
  const levels = availableLevels(bank, settings.language, currentRules());
  const selected = settings.levels.filter((l) => levels.includes(l));
  renderPills(levelPills, levels, selected.length ? selected : levels);
}

function renderCategories() {
  const levels = checkedValues(levelPills);
  const categories = availableCategories(bank, settings.language, levels, currentRules());
  const selected = settings.categories.filter((c) => categories.includes(c));
  renderPills(categoryPills, categories, selected.length ? selected : categories);
}

function updatePoolSummary() {
  const levels = checkedValues(levelPills);
  const categories = checkedValues(categoryPills);
  const pool = buildPool(bank, settings.language, levels, categories, currentRules());
  const target = Number(targetInput.value) || DEFAULTS.target;

  if (!pool.length) {
    poolSummary.textContent = 'No words match these filters.';
    poolSummary.classList.add('pool-warning');
    return;
  }

  poolSummary.classList.remove('pool-warning');
  const parts = [];
  const related = pool.filter((entry) => entry.related).length;
  if (related) parts.push(`${pool.length - related} + ${related} related`);
  const phrases = pool.filter((entry) => /\s/u.test(entry.word)).length;
  if (phrases) parts.push(`${phrases} multi-word`);
  const breakdown = parts.length ? ` (${parts.join(', ')})` : '';

  const noun = phrases ? 'answers' : 'words';
  poolSummary.textContent =
    `${pool.length} ${noun} ready${breakdown} — about ${Math.floor(pool.length / Math.max(target, 1))} full turns before any repeat.`;
}

function refreshSetup() {
  renderLevels();
  renderCategories();
  updatePoolSummary();
}

function populateSetupInputs() {
  teamInput.value = settings.teams.join('\n');
  secondsInput.value = settings.seconds;
  targetInput.value = settings.target;
  relatedInput.checked = settings.includeRelated !== false;
  phrasesInput.checked = settings.allowPhrases === true;
}

/* ─── Setup reading ───────────────────────────────────────────── */

function parseTeams(raw) {
  const seen = new Set();
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function readSetup() {
  return {
    teams: parseTeams(teamInput.value),
    language: languageSelect.value,
    levels: checkedValues(levelPills),
    categories: checkedValues(categoryPills),
    seconds: Number(secondsInput.value),
    target: Number(targetInput.value),
    ...currentRules(),
    // Mute lives in the header rather than the setup form, so carry it across
    // instead of letting a fresh read drop it.
    muted: sfx.isMuted(),
  };
}

function validate(next) {
  if (next.teams.length < 2) return 'Add at least two teams, one per line.';
  if (!next.levels.length) return 'Select at least one level.';
  if (!next.categories.length) return 'Select at least one category.';
  if (!Number.isFinite(next.seconds) || next.seconds < 15) return 'Round length must be at least 15 seconds.';
  if (!Number.isFinite(next.target) || next.target < 1) return 'Words to win must be at least 1.';

  const pool = buildPool(bank, next.language, next.levels, next.categories, next);
  if (!pool.length) return 'No words match these filters.';
  if (pool.length < next.target) {
    return `Only ${pool.length} words match these filters — fewer than the ${next.target} needed to win a turn.`;
  }
  return '';
}

/* ─── Game flow ───────────────────────────────────────────────── */

function startGame() {
  const next = readSetup();
  const error = validate(next);
  setupError.textContent = error;
  if (error) return;

  settings = next;
  saveSettings();

  game = {
    dealer: createDealer(bank, next.language, next.levels, next.categories, next),
    turnIndex: 0,
    results: [],
  };

  goToHandoff();
}

function goToHandoff() {
  const team = settings.teams[game.turnIndex];
  handoffTeam.textContent = team;
  // The clue is always a single word; only the answer may be a phrase.
  handoffRules.textContent =
    `${settings.target} ${settings.allowPhrases ? 'answers' : 'words'} in ${formatTime(settings.seconds)} — one-word clues only` +
    `${settings.allowPhrases ? ', answers may be phrases.' : '.'}`;
  showScreen('handoff');
}

function beginTurn() {
  turn = {
    team: settings.teams[game.turnIndex],
    correct: 0,
    passes: 0,
    words: [],
    current: null,
    deadline: performance.now() + settings.seconds * 1000,
    remainingWhenPaused: null,
    tickId: null,
    finished: false,
  };

  sfx.stopStings();
  playTeam.textContent = turn.team;
  playTarget.textContent = `/ ${settings.target}`;
  pauseBtn.textContent = 'Pause';
  updateScore();
  nextWord();
  showScreen('play');
  startTicking();
}

function startTicking() {
  stopTicking();
  turn.tickId = setInterval(tick, 100);
  tick();
}

function stopTicking() {
  if (turn?.tickId) {
    clearInterval(turn.tickId);
    turn.tickId = null;
  }
}

function remainingMs() {
  if (turn.remainingWhenPaused !== null) return turn.remainingWhenPaused;
  return Math.max(0, turn.deadline - performance.now());
}

function tick() {
  const remaining = remainingMs();
  const total = settings.seconds * 1000;
  const seconds = Math.ceil(remaining / 1000);

  timerText.textContent = formatTime(seconds);
  timerFill.style.width = `${Math.max(0, (remaining / total) * 100)}%`;
  timerText.classList.toggle('urgent', remaining <= 15000 && remaining > 0);
  timerFill.classList.toggle('urgent', remaining <= 15000 && remaining > 0);

  // The countdown bed decides for itself when to come in, so that its last
  // beat lands on zero whatever the round length.
  sfx.syncCountdown(remaining / 1000);

  if (remaining <= 0) endTurn('time');
}

function togglePause() {
  if (turn.remainingWhenPaused === null) {
    turn.remainingWhenPaused = remainingMs();
    stopTicking();
    sfx.pauseCountdown();
    pauseBtn.textContent = 'Resume';
    wordDisplay.classList.add('blurred');
  } else {
    turn.deadline = performance.now() + turn.remainingWhenPaused;
    turn.remainingWhenPaused = null;
    pauseBtn.textContent = 'Pause';
    wordDisplay.classList.remove('blurred');
    sfx.resumeCountdown(remainingMs() / 1000);
    startTicking();
  }
}

function nextWord() {
  const item = game.dealer.next();
  turn.current = item;
  if (!item) {
    wordDisplay.textContent = '—';
    wordCategory.textContent = '';
    return;
  }
  wordDisplay.textContent = item.word;
  wordCategory.textContent = `${item.category} · ${item.level}`;
}

function updateScore() {
  playScore.textContent = turn.correct;
}

function markCorrect() {
  if (!turn || turn.finished || turn.remainingWhenPaused !== null || !turn.current) return;

  turn.correct += 1;
  turn.words.push({ ...turn.current, result: 'correct' });
  updateScore();

  // One sound per action: the word that wins the turn gets the bigger sting
  // from endTurn rather than a score chirp underneath it.
  if (turn.correct >= settings.target) {
    endTurn('target');
    return;
  }
  sfx.play('correct');
  nextWord();
}

function markPass() {
  if (!turn || turn.finished || turn.remainingWhenPaused !== null || !turn.current) return;

  turn.passes += 1;
  turn.words.push({ ...turn.current, result: 'passed' });
  game.dealer.pushBack(turn.current);
  sfx.play('pass');
  nextWord();
}

function endTurn(reason) {
  if (turn.finished) return;
  turn.finished = true;

  const remaining = remainingMs();
  stopTicking();
  sfx.stopCountdown();
  wordDisplay.classList.remove('blurred');

  // Ending the turn by hand is a deliberate, undramatic act — no sting.
  if (reason === 'target') sfx.play('turnWon');
  else if (reason === 'time') sfx.play('timeUp');

  const elapsed = settings.seconds - Math.max(0, remaining / 1000);

  game.results.push({
    team: turn.team,
    correct: turn.correct,
    passes: turn.passes,
    words: turn.words,
    elapsed,
    reachedTarget: reason === 'target',
  });

  renderResult(game.results[game.results.length - 1], reason);
  showScreen('result');
}

function renderResult(result, reason) {
  resultTeam.textContent = result.team;

  if (reason === 'target') {
    resultHeadline.textContent = `Made it with ${formatTime(Math.round(settings.seconds - result.elapsed))} to spare!`;
    resultHeadline.className = 'result-headline success';
  } else if (reason === 'ended') {
    resultHeadline.textContent = 'Turn ended early.';
    resultHeadline.className = 'result-headline';
  } else {
    resultHeadline.textContent = "Time's up.";
    resultHeadline.className = 'result-headline';
  }

  resultStats.innerHTML = '';
  const stats = [
    ['Correct', `${result.correct} / ${settings.target}`],
    ['Passed', String(result.passes)],
    ['Time used', formatTime(Math.round(result.elapsed))],
  ];
  stats.forEach(([label, value]) => {
    const box = document.createElement('div');
    box.className = 'stat-box';
    box.innerHTML = `<p class="label">${label}</p><p class="stat-value"></p>`;
    box.querySelector('.stat-value').textContent = value;
    resultStats.appendChild(box);
  });

  resultWords.innerHTML = '';
  if (result.words.length) {
    const heading = document.createElement('p');
    heading.className = 'label';
    heading.textContent = 'Words this turn';
    resultWords.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'word-chips';
    result.words.forEach(({ word, result: outcome }) => {
      const chip = document.createElement('span');
      chip.className = `word-chip ${outcome}`;
      chip.textContent = word;
      list.appendChild(chip);
    });
    resultWords.appendChild(list);
  }

  const isLastTeam = game.turnIndex >= settings.teams.length - 1;
  nextTurnBtn.textContent = isLastTeam ? 'See final score' : `Next team: ${settings.teams[game.turnIndex + 1]}`;
}

// How much of the winner music is left playing once the score is on screen.
const REVEAL_LEAD_SECONDS = 3.5;

function revealFinalScore() {
  cancelReveal = null;
  blackout.classList.add('hidden');
}

function advanceTurn() {
  if (game.turnIndex >= settings.teams.length - 1) {
    // Build the scoreboard behind the blackout so it is ready the instant the
    // music cues, then reveal it with REVEAL_LEAD_SECONDS still to play.
    renderFinal();
    showScreen('final');
    blackout.classList.remove('hidden');
    cancelReveal = sfx.playWithCue('gameOver', REVEAL_LEAD_SECONDS, revealFinalScore);
    return;
  }
  game.turnIndex += 1;
  goToHandoff();
}

function rankResults(results) {
  // More words wins; ties break on the faster time.
  return [...results].sort((a, b) => b.correct - a.correct || a.elapsed - b.elapsed);
}

function renderFinal() {
  const ranked = rankResults(game.results);
  const best = ranked[0];
  const tied = ranked.filter(
    (r) => r.correct === best.correct && Math.abs(r.elapsed - best.elapsed) < 0.5,
  );

  winnerText.textContent =
    tied.length > 1 ? `Tie: ${tied.map((r) => r.team).join(' & ')}` : `${best.team} wins!`;

  scoreboard.innerHTML = '';
  ranked.forEach((result, index) => {
    const row = document.createElement('div');
    row.className = `score-row${index === 0 && tied.length === 1 ? ' leader' : ''}`;

    const rank = document.createElement('span');
    rank.className = 'score-rank';
    rank.textContent = String(index + 1);

    const name = document.createElement('span');
    name.className = 'score-team';
    name.textContent = result.team;

    const detail = document.createElement('span');
    detail.className = 'score-detail';
    detail.textContent = result.reachedTarget
      ? `${result.correct} in ${formatTime(Math.round(result.elapsed))}`
      : `${result.correct} words`;

    row.append(rank, name, detail);
    scoreboard.appendChild(row);
  });
}

function playAgain() {
  game.dealer.reset();
  game.turnIndex = 0;
  game.results = [];
  goToHandoff();
}

/* ─── Helpers ─────────────────────────────────────────────────── */

function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/* ─── Sound ───────────────────────────────────────────────────── */

function applyMute(value) {
  const isMuted = sfx.setMuted(value);
  muteBtn.setAttribute('aria-pressed', String(isMuted));
  muteBtn.classList.toggle('muted', isMuted);
  document.getElementById('muteIcon').textContent = isMuted ? '🔇' : '🔊';
  document.getElementById('muteLabel').textContent = isMuted ? 'Sound off' : 'Sound on';
  settings.muted = isMuted;
}

/* ─── Wiring ──────────────────────────────────────────────────── */

muteBtn.addEventListener('click', () => {
  applyMute(!sfx.isMuted());
  saveSettings();
});

// Nobody should be stuck watching a black screen wait out the music.
blackout.addEventListener('click', () => {
  if (cancelReveal) cancelReveal();
  revealFinalScore();
});

startGameBtn.addEventListener('click', startGame);

resetSetupBtn.addEventListener('click', () => {
  // Reset is about the setup form; it should not silently unmute the room.
  settings = { ...DEFAULTS, language: settings.language, muted: sfx.isMuted() };
  populateSetupInputs();
  refreshSetup();
  setupError.textContent = '';
  saveSettings();
});

languageSelect.addEventListener('change', () => {
  settings.language = languageSelect.value;
  settings.levels = [];
  settings.categories = [];
  refreshSetup();
});

levelPills.addEventListener('change', () => {
  renderCategories();
  updatePoolSummary();
});

categoryPills.addEventListener('change', updatePoolSummary);
targetInput.addEventListener('input', updatePoolSummary);

// Remember what is ticked, plus anything previously chosen that this mode
// simply isn't showing. Flipping the switch retires whole categories — the
// idiom ones only exist as related words — and a category disappearing is not
// the same as the teacher unticking it, so it must come back on the way back.
function rememberPicks(container, chosen) {
  const onScreen = new Set(Array.from(container.querySelectorAll('input')).map((i) => i.value));
  return [...checkedValues(container), ...chosen.filter((value) => !onScreen.has(value))];
}

// Both switches change which levels and categories have anything to deal, so
// they redraw the filters the same way.
[relatedInput, phrasesInput].forEach((input) => {
  input.addEventListener('change', () => {
    settings.levels = rememberPicks(levelPills, settings.levels);
    settings.categories = rememberPicks(categoryPills, settings.categories);
    Object.assign(settings, currentRules());
    refreshSetup();
  });
});

function toggleAll(container) {
  const inputs = Array.from(container.querySelectorAll('input'));
  const allChecked = inputs.every((i) => i.checked);
  inputs.forEach((i) => {
    i.checked = !allChecked;
  });
  container.dispatchEvent(new Event('change'));
}

toggleLevels.addEventListener('click', () => toggleAll(levelPills));
toggleCategories.addEventListener('click', () => toggleAll(categoryPills));

beginTurnBtn.addEventListener('click', beginTurn);
handoffBackBtn.addEventListener('click', () => showScreen('setup'));

correctBtn.addEventListener('click', markCorrect);
passBtn.addEventListener('click', markPass);
pauseBtn.addEventListener('click', togglePause);
endTurnBtn.addEventListener('click', () => endTurn('ended'));

nextTurnBtn.addEventListener('click', advanceTurn);

playAgainBtn.addEventListener('click', () => {
  sfx.stopStings(); // cut the winner drumroll short
  playAgain();
});

backToSetupBtn.addEventListener('click', () => {
  sfx.stopStings();
  showScreen('setup');
});

document.addEventListener('keydown', (event) => {
  if (screens.play.classList.contains('hidden')) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.matches('input, textarea, select')) return;
  // A focused button already activates on Space; handling it here too would
  // count the word twice.
  if (event.target.tagName === 'BUTTON') return;

  if (event.code === 'Space') {
    event.preventDefault();
    markCorrect();
  } else if (event.key.toLowerCase() === 'p') {
    event.preventDefault();
    markPass();
  }
});

/* ─── Boot ────────────────────────────────────────────────────── */

async function init() {
  loadSettings();
  applyMute(settings.muted);
  populateSetupInputs();
  bankStatus.textContent = 'Loading words…';

  try {
    bank = await fetchWordBank();
    renderLanguages();
    refreshSetup();
    const total = availableLanguages(bank, currentRules()).length;
    bankStatus.textContent = `Live from the shared sheet · ${total} languages`;
  } catch (error) {
    bankStatus.textContent = 'Could not load the word list.';
    bankStatus.classList.add('pool-warning');
    setupError.textContent = error.message;
    startGameBtn.disabled = true;
  }
}

init();
