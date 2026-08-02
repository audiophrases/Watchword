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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
