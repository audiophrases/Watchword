// Exercises the countdown alignment, which the jsdom walkthrough cannot reach:
// Node has no Audio constructor, so sfx.js correctly no-ops there. Here we
// install a fake one and check the arithmetic that makes the clip's last beat
// land on zero.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIP_SECONDS = 39; // the real countdown.mp3 length

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

const made = [];

class FakeAudio {
  constructor(src) {
    this.src = src;
    this.duration = src.includes('countdown') ? CLIP_SECONDS : 1;
    this.currentTime = 0;
    this.paused = true;
    this.plays = 0;
    this.listeners = {};
    made.push(this);
  }

  play() {
    this.paused = false;
    this.plays += 1;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }
}

global.Audio = FakeAudio;

// A fresh module per scenario — the countdown element is cached deliberately.
const loadSfx = (tag) => import(`${pathToFileURL(path.join(ROOT, 'sfx.js')).href}?${tag}`);
const bed = () => made.find((a) => a.src.includes('countdown'));

console.log('-- countdown holds off until its own length remains --');
{
  const sfx = await loadSfx('long');
  sfx.syncCountdown(120);
  check('silent at 2:00 left', !bed() || bed().plays === 0, String(bed()?.plays));
  sfx.syncCountdown(60);
  check('silent at 1:00 left', bed().plays === 0, String(bed().plays));
  sfx.syncCountdown(CLIP_SECONDS);
  check('starts when clip length remains', bed().plays === 1, String(bed().plays));
  check('starts from the top', bed().currentTime === 0, String(bed().currentTime));
  sfx.syncCountdown(20);
  check('does not restart on later ticks', bed().plays === 1, String(bed().plays));
}

console.log('\n-- a round shorter than the clip starts partway in --');
{
  made.length = 0;
  const sfx = await loadSfx('short');
  sfx.syncCountdown(20);
  check('plays immediately', bed().plays === 1, String(bed().plays));
  check('seeks so 20s remain', Math.abs(bed().currentTime - (CLIP_SECONDS - 20)) < 0.01, String(bed().currentTime));
}

console.log('\n-- pause and resume stay in sync with the clock --');
{
  made.length = 0;
  const sfx = await loadSfx('pause');
  sfx.syncCountdown(30);
  check('running', !bed().paused);
  sfx.pauseCountdown();
  check('paused', bed().paused);
  // Resuming re-seeks rather than continuing, so a long pause cannot drift.
  sfx.resumeCountdown(12);
  check('resumed', !bed().paused);
  check('re-seeked to 12s left', Math.abs(bed().currentTime - (CLIP_SECONDS - 12)) < 0.01, String(bed().currentTime));
}

console.log('\n-- stop and mute --');
{
  made.length = 0;
  const sfx = await loadSfx('stop');
  sfx.syncCountdown(30);
  sfx.stopCountdown();
  check('stopped and rewound', bed().paused && bed().currentTime === 0, String(bed().currentTime));

  sfx.setMuted(true);
  sfx.syncCountdown(30);
  check('muted stays silent', bed().plays === 1, String(bed().plays));

  const before = made.length;
  sfx.play('correct');
  check('muted plays no sting', made.length === before, `${before} -> ${made.length}`);

  sfx.setMuted(false);
  sfx.play('correct');
  check('unmuted plays a sting', made.length === before + 1, `${before} -> ${made.length}`);
}

console.log('\n-- muting mid-turn cuts the bed --');
{
  made.length = 0;
  const sfx = await loadSfx('mutemid');
  sfx.syncCountdown(30);
  check('running before mute', !bed().paused);
  sfx.setMuted(true);
  check('mute silences the bed', bed().paused && bed().currentTime === 0, String(bed().currentTime));
}

console.log('\n-- stings rotate without repeating back to back --');
{
  made.length = 0;
  const sfx = await loadSfx('bag');
  const heard = [];
  for (let i = 0; i < 40; i += 1) {
    const before = made.length;
    sfx.play('correct');
    if (made.length > before) heard.push(made[made.length - 1].src);
  }
  check('40 stings played', heard.length === 40, String(heard.length));
  check('uses both clips', new Set(heard).size === 2, [...new Set(heard)].join(', '));
  const backToBack = heard.filter((s, i) => i > 0 && s === heard[i - 1]).length;
  check('never repeats back to back', backToBack === 0, `${backToBack} repeats`);
}

console.log('\n-- a long sting can be cut short --');
{
  made.length = 0;
  const sfx = await loadSfx('cut');
  sfx.play('gameOver');
  const drumroll = made[made.length - 1];
  check('drumroll playing', !drumroll.paused);
  sfx.stopStings();
  check('stopStings halts it', drumroll.paused && drumroll.currentTime === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
