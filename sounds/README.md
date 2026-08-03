# Sounds

Clips reused from [PinPlay](https://github.com/audiophrases/pinplay)'s `music/` folder,
by way of the earlier [password](https://github.com/audiophrases/password) prototype, so
the classroom apps share one audio identity.

Filenames here describe the **role**, not the origin, so swapping a clip is a one-line
change in `sfx.js`.

| File            | Plays when                       | Length | Originally          |
|-----------------|----------------------------------|--------|---------------------|
| `correct-1.mp3` | a word is scored                 | 0.84s  | `correct3.mp3`      |
| `correct-2.mp3` | a word is scored                 | 0.74s  | `correct4.mp3`      |
| `pass.mp3`      | a word is passed                 | 0.91s  | `incorrect.mp3`     |
| `turn-won.mp3`  | the team reaches its target      | 1.99s  | `correct.mp3`       |
| `time-up.mp3`   | the clock runs out               | 1.75s  | `incorrect2.mp3`    |
| `game-over.mp3` | the final scoreboard is revealed | 10.29s | `drumrollwinner.mp3`|
| `countdown.mp3` | the last 5 seconds of a turn     | 39.00s | `counter.mp3`       |

Length drives most of these choices. Scoring and passing both fire every few seconds, so
their clips are deliberately under a second — a longer sting would still be sounding over
the next word. That rules out PinPlay's `correct.mp3` (2s) and `correct2.mp3` (3.5s) for
scoring, which is why the former took the rarer target-reached moment instead. For the
same reason passing gets PinPlay's crisp `incorrect.mp3` and time-up the fuller
`incorrect2.mp3`, that being a once-a-turn moment with nothing following it.

`countdown.mp3` is a 39-second bed, but only its **last 5 seconds** are heard.
`COUNTDOWN_LEAD_SECONDS` in `sfx.js` sets that; the clip is then seeked so its final beat
lands on zero, whatever the round length. Raise the constant for a longer run-in — it is
capped at the clip's own length, so a shorter clip simply plays whole.

`game-over.mp3` drives the final reveal. The music starts, the screen goes black, and the
scoreboard appears with `REVEAL_LEAD_SECONDS` (3.5s, in `app.js`) still playing. The wait
is measured from the clip's real duration rather than hard-coded, so replacing the clip
retimes the reveal automatically. Tapping the black screen skips it.

## Replacing a clip

Drop in a file, point `FILES` in `sfx.js` at it, done. Keep scoring clips under a
second. Every audio failure — missing file, unsupported codec, autoplay block — degrades
to silence rather than an error, which also means a mistyped filename is invisible at
runtime; `test/game.test.mjs` checks every referenced clip exists on disk for that reason.
