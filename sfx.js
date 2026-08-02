// Sound effects.
//
// The clips are the same stings the other classroom apps use — they come from
// PinPlay's music folder by way of the earlier Password prototype — so the
// games share one audio identity. Names here describe the *role*, not the
// original filename, which makes swapping a clip a one-line change.
//
// Everything degrades to silence: a missing file, a codec the browser dislikes
// or an autoplay block all end up in the same `catch`, and the game plays on.

const FILES = {
  // Scoring fires every few seconds, so both clips are under a second. A
  // longer sting would still be sounding over the next word.
  correct: ['sounds/correct-1.mp3', 'sounds/correct-2.mp3'],
  turnWon: ['sounds/turn-won.mp3'],
  timeUp: ['sounds/time-up.mp3'],
  gameOver: ['sounds/game-over.mp3'],
};

const COUNTDOWN_SRC = 'sounds/countdown.mp3';

// Every clip this module can reach. Exported because missing audio fails
// silently by design, so only a test that checks the files exist on disk can
// catch a renamed or mistyped one.
export const SOUND_FILES = [...Object.values(FILES).flat(), COUNTDOWN_SRC];

// Passing is deliberately silent. A pass is not a failure — the word visibly
// changes, which is confirmation enough, and a buzzer would make skipping feel
// like a penalty in a language class.

let muted = false;
let countdown = null;
let countdownRunning = false;

/* ─── Stings ──────────────────────────────────────────────────── */

// Each kind draws from a shuffled bag, refilled when empty, so the same sting
// never lands twice in a row — the same fairness the word dealer uses.
const bags = {};
const lastPlayed = {};

function drawFile(kind) {
  const files = FILES[kind];
  if (!files || !files.length) return null;
  if (files.length === 1) return files[0];

  let bag = bags[kind];
  if (!bag || !bag.length) {
    bag = bags[kind] = [...files];
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    // A fresh bag can start with the clip that just played — push it deeper.
    if (bag.length > 1 && bag[bag.length - 1] === lastPlayed[kind]) bag.unshift(bag.pop());
  }

  const src = bag.pop();
  lastPlayed[kind] = src;
  return src;
}

// Sounding stings, so a long one can be cut short when the game moves on --
// the winner drumroll runs ten seconds and must not bleed into the next game.
const sounding = new Set();

export function play(kind) {
  if (muted) return;
  const src = drawFile(kind);
  if (!src) return;

  try {
    // A fresh element per hit, so quick scoring can overlap instead of cutting
    // the previous sting short mid-note.
    const element = new Audio(src);
    sounding.add(element);
    element.addEventListener('ended', () => sounding.delete(element), { once: true });
    element.play().catch(() => sounding.delete(element));
  } catch {
    /* no Audio in this environment (tests) — stay silent */
  }
}

export function stopStings() {
  sounding.forEach((element) => {
    try {
      element.pause();
      element.currentTime = 0;
    } catch {
      /* already finished */
    }
  });
  sounding.clear();
}

/* ─── Countdown bed ───────────────────────────────────────────── */

function countdownElement() {
  if (countdown === null) {
    try {
      countdown = new Audio(COUNTDOWN_SRC);
      countdown.preload = 'auto';
    } catch {
      countdown = false;
    }
  }
  return countdown || null;
}

// Align the clip so its final beat lands on zero: play the tail that matches
// the time left. A round longer than the clip stays silent until the clip's
// own length is all that remains; a shorter round starts partway in.
function seekTo(element, remainingSeconds) {
  const total = element.duration;
  if (!Number.isFinite(total) || total <= 0) return false;
  if (remainingSeconds > total) return false;

  try {
    element.currentTime = Math.max(0, total - remainingSeconds);
  } catch {
    return false;
  }
  return true;
}

// Call on every timer tick with the seconds left in the turn.
export function syncCountdown(remainingSeconds) {
  if (muted || remainingSeconds <= 0) return;

  const element = countdownElement();
  if (!element) return;

  if (!countdownRunning) {
    if (!seekTo(element, remainingSeconds)) return; // still too early, or no metadata yet
    countdownRunning = true;
    try {
      element.play().catch(() => {
        countdownRunning = false;
      });
    } catch {
      countdownRunning = false;
    }
  }
}

export function pauseCountdown() {
  const element = countdown || null;
  if (element && countdownRunning) {
    element.pause();
    countdownRunning = false;
  }
}

// Resuming re-seeks rather than simply un-pausing, so a long pause cannot
// leave the audio drifting behind the clock.
export function resumeCountdown(remainingSeconds) {
  if (muted) return;
  syncCountdown(remainingSeconds);
}

export function stopCountdown() {
  const element = countdown || null;
  if (!element) return;
  try {
    element.pause();
    element.currentTime = 0;
  } catch {
    /* nothing playing */
  }
  countdownRunning = false;
}

/* ─── Mute ────────────────────────────────────────────────────── */

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  if (muted) {
    stopCountdown();
    stopStings();
  }
  return muted;
}
