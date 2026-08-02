# Sounds

Clips reused from [PinPlay](https://github.com/audiophrases/pinplay)'s `music/` folder,
by way of the earlier [password](https://github.com/audiophrases/password) prototype, so
the classroom apps share one audio identity.

Filenames here describe the **role**, not the origin, so swapping a clip is a one-line
change in `sfx.js`.

| File | Plays when | Length | Originally |
|------|------------|--------|------------|
| `correct-1.mp3` | a word is scored | 0.84s | `correct3.mp3` |
| `correct-2.mp3` | a word is scored | 0.74s | `correct4.mp3` |
| `turn-won.mp3` | the team reaches its target | 1.99s | `correct.mp3` |
| `time-up.mp3` | the clock runs out | 0.91s | `incorrect.mp3` |
| `game-over.mp3` | the final scoreboard appears | 10.29s | `drumrollwinner.mp3` |
| `countdown.mp3` | the last stretch of a turn | 39.00s | `counter.mp3` |

Scoring fires every few seconds, so both `correct-*` clips are deliberately under a
second — a longer sting would still be sounding over the next word. That rules out
PinPlay's `correct.mp3` (2s) and `correct2.mp3` (3.5s) for scoring, which is why the
former is used for the rarer target-reached moment instead.

Passing is silent on purpose. A pass is not a failure — the word visibly changes, which
is confirmation enough, and a buzzer would make skipping feel like a penalty.

`countdown.mp3` is a bed, not a tick. `sfx.js` reads its real duration and seeks so the
final beat lands on zero whatever the round length: a long round stays silent until 39
seconds remain, a short one starts partway in.

## Replacing a clip

Drop in a file, point `FILES` in `sfx.js` at it, done. Keep scoring clips under a
second. Every audio failure — missing file, unsupported codec, autoplay block — degrades
to silence rather than an error, which also means a mistyped filename is invisible at
runtime; `test/game.test.mjs` checks every referenced clip exists on disk for that reason.
