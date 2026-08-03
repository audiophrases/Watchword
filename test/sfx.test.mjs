// Exercises the audio timing the jsdom walkthrough cannot reach: Node has no
// Audio constructor, so sfx.js correctly no-ops there. Here we install a fake
// one and check the arithmetic — the countdown that must land on zero, and the
// cue that reveals the final score over the closing bars of the music.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COUNTDOWN_SECONDS = 39; // the real countdown.mp3 length
const LEAD = 5; // COUNTDOWN_LEAD_SECONDS in sfx.js

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const made = [];

// Durations the fake reports, so a test can shrink a clip and keep its own
// runtime short while still checking the real arithmetic.
const DURATIONS = { 'sounds/countdown.mp3': COUNTDOWN_SECONDS };

class FakeAudio {
  constructor(src) {
    this.src = src;
    this.duration = DURATIONS[src] ?? 1;
    this.currentTime = 0;
    this.paused = true;
    this.plays = 0;
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

  addEventListener(type, fn, options) {
    // Metadata is already known on this fake, so a `loadedmetadata` listener
    // would never fire — sfx.js only registers one when duration is unknown.
    if (type === 'loadedmetadata') fn();
    else if (options?.once !== undefined || type === 'ended') this.onEnded = fn;
  }
}

global.Audio = FakeAudio;

// A fresh module per scenario — the countdown element is cached deliberately.
const loadSfx = (tag) => import(`${pathToFileURL(path.join(ROOT, 'sfx.js')).href}?${tag}`);
const bed = () => made.find((a) => a.src.includes('countdown'));

console.log(`-- countdown holds off until the last ${LEAD}s --`);
{
  const sfx = await loadSfx('long');
  sfx.syncCountdown(120);
  check('silent at 2:00 left', !bed() || bed().plays === 0, String(bed()?.plays));
  sfx.syncCountdown(30);
  check('silent at 0:30 left', bed().plays === 0, String(bed().plays));
  sfx.syncCountdown(LEAD + 1);
  check(`silent at ${LEAD + 1}s left`, bed().plays === 0, String(bed().plays));
  sfx.syncCountdown(LEAD);
  check(`starts at ${LEAD}s left`, bed().plays === 1, String(bed().plays));
  check('plays the clip tail, so it ends on zero',
    Math.abs(bed().currentTime - (COUNTDOWN_SECONDS - LEAD)) < 0.01, String(bed().currentTime));
  sfx.syncCountdown(3);
  check('does not restart on later ticks', bed().plays === 1, String(bed().plays));
}

console.log('\n-- a turn already inside the lead starts partway in --');
{
  made.length = 0;
  const sfx = await loadSfx('short');
  sfx.syncCountdown(2);
  check('plays immediately', bed().plays === 1, String(bed().plays));
  check('seeks so 2s remain', Math.abs(bed().currentTime - (COUNTDOWN_SECONDS - 2)) < 0.01, String(bed().currentTime));
}

console.log('\n-- a clip shorter than the lead plays whole --');
{
  made.length = 0;
  DURATIONS['sounds/countdown.mp3'] = 3;
  const sfx = await loadSfx('tiny');
  sfx.syncCountdown(LEAD);
  check('still silent above its own length', bed().plays === 0, String(bed().plays));
  sfx.syncCountdown(3);
  check('starts at its own length', bed().plays === 1, String(bed().plays));
  check('starts from the top', Math.abs(bed().currentTime) < 0.01, String(bed().currentTime));
  DURATIONS['sounds/countdown.mp3'] = COUNTDOWN_SECONDS;
}

console.log('\n-- pause and resume stay in sync with the clock --');
{
  made.length = 0;
  const sfx = await loadSfx('pause');
  sfx.syncCountdown(4);
  check('running', !bed().paused);
  sfx.pauseCountdown();
  check('paused', bed().paused);
  // Resuming re-seeks rather than continuing, so a long pause cannot drift.
  sfx.resumeCountdown(2);
  check('resumed', !bed().paused);
  check('re-seeked to 2s left', Math.abs(bed().currentTime - (COUNTDOWN_SECONDS - 2)) < 0.01, String(bed().currentTime));
}

console.log('\n-- stop and mute --');
{
  made.length = 0;
  const sfx = await loadSfx('stop');
  sfx.syncCountdown(4);
  sfx.stopCountdown();
  check('stopped and rewound', bed().paused && bed().currentTime === 0, String(bed().currentTime));

  sfx.setMuted(true);
  sfx.syncCountdown(4);
  check('muted stays silent', bed().plays === 1, String(bed().plays));

  const before = made.length;
  sfx.play('correct');
  check('muted plays no sting', made.length === before, `${before} -> ${made.length}`);

  sfx.setMuted(false);
  sfx.play('correct');
  check('unmuted plays a sting', made.length === before + 1, `${before} -> ${made.length}`);
}

console.log('\n-- passing has its own sting, distinct from time-up --');
{
  made.length = 0;
  const sfx = await loadSfx('pass');
  sfx.play('pass');
  const passSrc = made[made.length - 1].src;
  sfx.play('timeUp');
  const timeUpSrc = made[made.length - 1].src;
  check('pass makes a sound', made.length === 2);
  check('pass is not the time-up buzzer', passSrc !== timeUpSrc, `${passSrc} vs ${timeUpSrc}`);
}

console.log('\n-- the final-score cue lands over the closing bars --');
{
  made.length = 0;
  DURATIONS['sounds/game-over.mp3'] = 0.5;
  const sfx = await loadSfx('cue');
  const started = Date.now();
  let firedAt = 0;
  sfx.playWithCue('gameOver', 0.2, () => {
    firedAt = Date.now() - started;
  });
  check('music starts at once', made.some((a) => a.src.includes('game-over') && a.plays === 1));
  check('reveal waits', firedAt === 0, String(firedAt));
  await sleep(450);
  // 0.5s clip, revealed with 0.2s left => ~300ms.
  check(`reveal fires at duration minus lead (${firedAt}ms, want ~300)`, firedAt >= 250 && firedAt <= 430, String(firedAt));
}

console.log('\n-- the cue can be cancelled and cannot fire twice --');
{
  made.length = 0;
  const sfx = await loadSfx('cancel');
  let fired = 0;
  const cancel = sfx.playWithCue('gameOver', 0.2, () => {
    fired += 1;
  });
  cancel();
  await sleep(450);
  check('cancelled cue never fires', fired === 0, String(fired));

  let twice = 0;
  sfx.playWithCue('gameOver', 0.2, () => {
    twice += 1;
  });
  await sleep(450);
  check('fires exactly once', twice === 1, String(twice));
}

console.log('\n-- muting mid-wait must not strand a black screen --');
{
  made.length = 0;
  const sfx = await loadSfx('mutecue');
  let revealed = false;
  sfx.playWithCue('gameOver', 0.2, () => {
    revealed = true;
  });
  check('not revealed yet', !revealed);
  sfx.setMuted(true);
  check('muting reveals immediately', revealed, 'screen would stay black');
  sfx.setMuted(false);
}

console.log('\n-- with no audio the reveal still happens --');
{
  made.length = 0;
  const sfx = await loadSfx('nomusic');
  sfx.setMuted(true);
  let revealed = false;
  sfx.playWithCue('gameOver', 0.2, () => {
    revealed = true;
  });
  check('muted does not reveal instantly', !revealed);
  await sleep(1200); // FALLBACK_CUE_MS
  check('falls back to a fixed beat', revealed, 'never revealed');
  sfx.setMuted(false);
  DURATIONS['sounds/game-over.mp3'] = undefined;
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
