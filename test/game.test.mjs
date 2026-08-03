// Walks a whole game in a headless DOM against the live word sheet.
// Run with:  npm install && npm test
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;

// Expose the browser globals app.js expects; fetch comes from Node.
global.window = window;
global.document = window.document;
global.localStorage = window.localStorage;
global.Event = window.Event;
// Node's own performance/setInterval are left in place — swapping in jsdom's
// Performance makes its implementation recurse into itself.

const $ = (id) => window.document.getElementById(id);
const visible = () =>
  ['setupScreen', 'handoffScreen', 'playScreen', 'resultScreen', 'finalScreen'].find(
    (id) => !$(id).classList.contains('hidden'),
  );
const click = (id) => $(id).dispatchEvent(new window.Event('click', { bubbles: true }));
const fire = (id, type) => $(id).dispatchEvent(new window.Event(type, { bubbles: true }));

await import(pathToFileURL(path.join(ROOT, 'app.js')).href);

// Wait for the live sheet to load.
for (let i = 0; i < 100 && $('languageSelect').options.length === 0; i += 1) {
  await new Promise((r) => setTimeout(r, 100));
}

let pass = 0;
let fail = 0;
const check = (label, cond, extra = '') => {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}  ${extra}`);
  }
};

console.log('\n-- setup --');
check('bank loaded (3 languages)', $('languageSelect').options.length === 3, $('bankStatus').textContent);
check('status line', $('bankStatus').textContent.includes('languages'), $('bankStatus').textContent);
check('levels rendered', $('levelPills').querySelectorAll('input').length >= 6);
check('categories rendered', $('categoryPills').querySelectorAll('input').length > 10);
check('pool summary', /\d+ words ready/.test($('poolSummary').textContent), $('poolSummary').textContent);
check('starts on setup', visible() === 'setupScreen', visible());

console.log('\n-- related-words toggle --');
check('on by default', $('relatedInput').checked);
const poolCount = () => Number(($('poolSummary').textContent.match(/^(\d+)/) || [])[1] || 0);
const withRelated = poolCount();
const categoriesWithRelated = $('categoryPills').querySelectorAll('input').length;
check('summary breaks the count down', /\(\d+ \+ \d+ related\)/.test($('poolSummary').textContent), $('poolSummary').textContent);
$('relatedInput').checked = false;
fire('relatedInput', 'change');
const withoutRelated = poolCount();
check(`unticking shrinks the pool (${withRelated} -> ${withoutRelated})`, withoutRelated > 0 && withoutRelated < withRelated);
check('breakdown drops when off', !/related\)/.test($('poolSummary').textContent), $('poolSummary').textContent);
check('categories shrink too', $('categoryPills').querySelectorAll('input').length < categoriesWithRelated,
  `${$('categoryPills').querySelectorAll('input').length} vs ${categoriesWithRelated}`);
$('relatedInput').checked = true;
fire('relatedInput', 'change');
check('reticking restores the pool', poolCount() === withRelated, `${poolCount()} vs ${withRelated}`);

console.log('\n-- multi-word toggle --');
check('off by default', !$('phrasesInput').checked);
check('no phrase count while off', !/multi-word/.test($('poolSummary').textContent), $('poolSummary').textContent);
const levelsSingleWord = $('levelPills').querySelectorAll('input').length;
$('phrasesInput').checked = true;
fire('phrasesInput', 'change');
const withPhrases = poolCount();
check(`ticking grows the pool (${withRelated} -> ${withPhrases})`, withPhrases > withRelated);
check('summary counts the phrases', /\d+ multi-word/.test($('poolSummary').textContent), $('poolSummary').textContent);
check('summary switches to "answers"', /answers ready/.test($('poolSummary').textContent), $('poolSummary').textContent);
check('the roster level reappears', $('levelPills').querySelectorAll('input').length > levelsSingleWord,
  `${$('levelPills').querySelectorAll('input').length} vs ${levelsSingleWord}`);
$('phrasesInput').checked = false;
fire('phrasesInput', 'change');
check('unticking restores single-word play', poolCount() === withRelated, `${poolCount()} vs ${withRelated}`);
check('levels shrink back', $('levelPills').querySelectorAll('input').length === levelsSingleWord);

console.log('\n-- validation --');
$('teamInput').value = 'Solo';
click('startGame');
check('rejects one team', $('setupError').textContent.includes('two teams'), $('setupError').textContent);

$('teamInput').value = 'Red\nBlue';
$('targetInput').value = '99999';
fire('targetInput', 'input');
click('startGame');
check('rejects target > pool', $('setupError').textContent.includes('fewer than'), $('setupError').textContent);

console.log('\n-- game flow --');
$('targetInput').value = '3';
$('secondsInput').value = '120';
fire('targetInput', 'input');
click('startGame');
check('no error', $('setupError').textContent === '', $('setupError').textContent);
check('-> handoff', visible() === 'handoffScreen', visible());
check('handoff names first team', $('handoffTeam').textContent === 'Red', $('handoffTeam').textContent);

click('beginTurn');
check('-> play', visible() === 'playScreen', visible());
const firstWord = $('wordDisplay').textContent;
check('word shown', firstWord.length > 0, `"${firstWord}"`);
check('category shown', $('wordCategory').textContent.includes('\u00b7'), $('wordCategory').textContent);
check('target shown', $('playTarget').textContent === '/ 3', $('playTarget').textContent);
check('timer shows 2:00', $('timerText').textContent === '2:00', $('timerText').textContent);

click('passBtn');
check('pass changes word', $('wordDisplay').textContent !== firstWord);
check('pass does not score', $('playScore').textContent === '0', $('playScore').textContent);

click('correctBtn');
check('score 1', $('playScore').textContent === '1', $('playScore').textContent);
click('correctBtn');
check('score 2', $('playScore').textContent === '2', $('playScore').textContent);
check('still playing below target', visible() === 'playScreen', visible());
click('correctBtn');
check('reaching target ends turn', visible() === 'resultScreen', visible());
check('success headline', $('resultHeadline').textContent.includes('to spare'), $('resultHeadline').textContent);
check('correct stat 3 / 3', $('resultStats').textContent.includes('3 / 3'), $('resultStats').textContent);
check('one passed chip', $('resultWords').querySelectorAll('.word-chip.passed').length === 1);
check('three correct chips', $('resultWords').querySelectorAll('.word-chip.correct').length === 3);
check('next button names Blue', $('nextTurnBtn').textContent.includes('Blue'), $('nextTurnBtn').textContent);

console.log('\n-- second team --');
click('nextTurnBtn');
check('-> handoff', visible() === 'handoffScreen', visible());
check('team is Blue', $('handoffTeam').textContent === 'Blue', $('handoffTeam').textContent);
click('beginTurn');
check('score reset', $('playScore').textContent === '0', $('playScore').textContent);

click('pauseBtn');
check('pause blurs word', $('wordDisplay').classList.contains('blurred'));
const wordWhilePaused = $('wordDisplay').textContent;
click('correctBtn');
check(
  'paused ignores correct',
  $('playScore').textContent === '0' && $('wordDisplay').textContent === wordWhilePaused,
  $('playScore').textContent,
);
click('pauseBtn');
check('resume unblurs', !$('wordDisplay').classList.contains('blurred'));

click('correctBtn');
check('scores after resume', $('playScore').textContent === '1', $('playScore').textContent);
click('endTurnBtn');
check('end turn -> result', visible() === 'resultScreen', visible());
check('early-end headline', $('resultHeadline').textContent.includes('early'), $('resultHeadline').textContent);
check('last team -> final label', $('nextTurnBtn').textContent.includes('final'), $('nextTurnBtn').textContent);

console.log('\n-- final --');
click('nextTurnBtn');
check('-> final', visible() === 'finalScreen', visible());
check('Red wins (3 v 1)', $('winnerText').textContent.includes('Red wins'), $('winnerText').textContent);
check('two score rows', $('scoreboard').querySelectorAll('.score-row').length === 2);
check('leader marked', $('scoreboard').querySelector('.score-row').classList.contains('leader'));
check('Red row first', $('scoreboard').querySelector('.score-team').textContent === 'Red');

click('playAgainBtn');
check(
  'play again -> handoff Red',
  visible() === 'handoffScreen' && $('handoffTeam').textContent === 'Red',
  visible(),
);

console.log('\n-- no-repeat across a long game --');
const drawn = [];
$('teamInput').value = 'A\nB';
$('targetInput').value = '5';
fire('targetInput', 'input');
click('startGame');
for (let t = 0; t < 2; t += 1) {
  click('beginTurn');
  for (let w = 0; w < 5; w += 1) {
    drawn.push($('wordDisplay').textContent);
    click('correctBtn');
  }
  click('nextTurnBtn');
}
check('10 words drawn', drawn.length === 10, String(drawn.length));
check('all unique', new Set(drawn).size === 10, drawn.join(', '));
check(
  'every word dealt is one word',
  drawn.every((w) => !/\s/u.test(w)),
  drawn.filter((w) => /\s/u.test(w)).join(' | '),
);

console.log('\n-- single-word rule --');
const wb = await import(pathToFileURL(path.join(ROOT, 'wordbank.js')).href);
const bank = await (await import(pathToFileURL(path.join(ROOT, 'data.js')).href)).fetchWordBank();

check('keeps plain words', wb.isPlayable('book'));
check('keeps hyphenated', wb.isPlayable('rendez-vous') && wb.isPlayable('grand-mère'));
check('keeps elided', wb.isPlayable("s'asseoir") && wb.isPlayable('despertar-se'));
check('drops phrases', !wb.isPlayable('ice cream') && !wb.isPlayable('Harry Potter'));
check('drops roster names', !wb.isPlayable('Alsina Diaye, Martina'));
check('drops non-breaking space', !wb.isPlayable('a b'));
check('drops blank', !wb.isPlayable('') && !wb.isPlayable('   '));

// The four settings combinations, exercised as a matrix — every one of them is
// a mode a teacher can actually pick from the setup screen.
const MODES = [
  ['single/core', { includeRelated: false, allowPhrases: false }],
  ['single/related', { includeRelated: true, allowPhrases: false }],
  ['phrases/core', { includeRelated: false, allowPhrases: true }],
  ['phrases/related', { includeRelated: true, allowPhrases: true }],
];
const cats = (lang, o) => wb.availableCategories(bank, lang, wb.availableLevels(bank, lang, o), o);
const pool = (lang, o) => wb.buildPool(bank, lang, wb.availableLevels(bank, lang, o), cats(lang, o), o);

// Every filter the setup screen offers must actually yield words, or a teacher
// picks it and gets an empty pool at kickoff.
let emptyOffer = '';
for (const [name, o] of MODES) {
  for (const lang of wb.availableLanguages(bank, o)) {
    for (const level of wb.availableLevels(bank, lang, o)) {
      const levelCats = wb.availableCategories(bank, lang, [level], o);
      if (!wb.buildPool(bank, lang, [level], levelCats, o).length) emptyOffer ||= `${name} ${lang}/${level}`;
      for (const cat of levelCats) {
        if (!wb.buildPool(bank, lang, [level], [cat], o).length) emptyOffer ||= `${name} ${lang}/${level}/${cat}`;
      }
    }
    const p = pool(lang, o);
    const keys = p.map((x) => x.word.toLocaleLowerCase());
    check(`${name} ${lang}: no answer deals twice (${p.length})`, new Set(keys).size === keys.length,
      `${keys.length} vs ${new Set(keys).size}`);
    if (!o.allowPhrases) {
      check(`${name} ${lang}: single words only`, p.every((x) => wb.isPlayable(x.word)));
    }
    if (!o.includeRelated) {
      check(`${name} ${lang}: no related words`, p.every((x) => !x.related));
    }
  }
}
check('no filter is offered empty in any mode', emptyOffer === '', emptyOffer);

console.log('\n-- each switch only ever grows the pool --');
for (const lang of wb.availableLanguages(bank)) {
  const [sc, sr, pc, pr] = MODES.map(([, o]) => pool(lang, o).length);
  check(`${lang}: related words add (${sc} -> ${sr})`, sr > sc);
  check(`${lang}: phrases add (${sc} -> ${pc})`, pc > sc);
  check(`${lang}: both add most (${pr})`, pr > sr && pr > pc);
  // A curated word must keep its own level and category, never be shadowed by
  // an earlier row that happens to list it as a distractor.
  check(`${lang}: every core word survives related mode`,
    pool(lang, MODES[1][1]).filter((p) => !p.related).length === sc);
}

console.log('\n-- what each switch unlocks --');
// Idiom rows are multi-word in the `word` column, so the category needs either
// switch: distractors gloss them in one word, or phrases admit the idiom itself.
check('idioms hidden with both off', !cats('en', MODES[0][1]).includes('Idioms'));
check('idioms return via related words', cats('en', MODES[1][1]).includes('Idioms'));
check('idioms return via phrases', cats('en', MODES[2][1]).includes('Idioms'));

// The A0 class roster is "Surname, Firstname" rows with no distractors, so only
// allowing phrases can reach it.
check('roster hidden while single-word', !wb.availableLevels(bank, 'en', MODES[1][1]).includes('A0'));
check('roster reachable with phrases', wb.availableLevels(bank, 'en', MODES[2][1]).includes('A0'));

check('every mode gets its own dealer', new Set(
  MODES.map(([, o]) => wb.createDealer(bank, 'en', ['A1'], cats('en', o), o).key),
).size === 4);

// The old positional boolean must not slip through as a silent no-op.
check('a stray boolean is rejected', (() => {
  try { wb.buildPool(bank, 'en', ['A1'], ['Classroom'], true); return false; } catch { return true; }
})());

// The sheet files some words under two categories on purpose; dealing one
// twice in a game would break the no-repeat promise.
const enCore = pool('en', MODES[0][1]);
['apple', 'madrid', 'map', 'paradox', 'platform'].forEach((w) => {
  const hits = enCore.filter((p) => p.word.toLowerCase() === w).length;
  if (hits) check(`"${w}" is dealt once`, hits === 1, String(hits));
});

console.log('\n-- sound --');
const sfx = await import(pathToFileURL(path.join(ROOT, 'sfx.js')).href);

// Audio failure is silent by design, so a renamed clip would never surface at
// runtime. This is the only thing standing between a typo and a mute game.
sfx.SOUND_FILES.forEach((src) => {
  check(`${src} exists`, fs.existsSync(path.join(ROOT, src)));
});
check('every clip lives under sounds/', sfx.SOUND_FILES.every((s) => s.startsWith('sounds/')));
check('no duplicate clip paths', new Set(sfx.SOUND_FILES).size === sfx.SOUND_FILES.length);

// jsdom has no Audio constructor, so the whole module must no-op rather than
// throw — the same path a browser takes when a codec or autoplay blocks it.
check('play() survives without Audio', (() => { try { sfx.play('correct'); return true; } catch { return false; } })());
check('unknown kind is ignored', (() => { try { sfx.play('nope'); return true; } catch { return false; } })());
check('countdown helpers survive', (() => {
  try { sfx.syncCountdown(10); sfx.pauseCountdown(); sfx.resumeCountdown(10); sfx.stopCountdown(); sfx.stopStings(); return true; }
  catch { return false; }
})());

check('starts unmuted', sfx.isMuted() === false);
check('setMuted(true) sticks', sfx.setMuted(true) === true && sfx.isMuted() === true);
check('setMuted(false) sticks', sfx.setMuted(false) === false && sfx.isMuted() === false);

console.log('\n-- mute toggle --');
click('backToSetupBtn');
const muteIcon = () => $('muteIcon').textContent;
check('button starts on', $('muteBtn').getAttribute('aria-pressed') === 'false' && muteIcon() === '🔊', muteIcon());
click('muteBtn');
check('click mutes', $('muteBtn').getAttribute('aria-pressed') === 'true' && muteIcon() === '🔇', muteIcon());
check('module agrees', sfx.isMuted() === true);
check('mute persists to storage', JSON.parse(localStorage.getItem('watchword-setup-v1')).muted === true);
click('muteBtn');
check('click unmutes', $('muteBtn').getAttribute('aria-pressed') === 'false' && sfx.isMuted() === false);

// Reset is a setup-form action; it must not un-silence the room.
click('muteBtn');
click('resetSetup');
check('reset keeps mute', sfx.isMuted() === true && muteIcon() === '🔇', muteIcon());
click('muteBtn');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
