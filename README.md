# Watchword

A one-word-clue guessing game for language classrooms, inspired by the Spanish TV show
*Password*. Runs on a single shared device — no accounts, no build step, no backend.

**▶ [Play Watchword](https://audiophrases.github.io/Watchword/)**

## How a game works

Teams take turns. On a team's turn one player is the **clue-giver** and holds the device;
their teammates guess.

- The clue-giver sees a secret word and may say **exactly one word** as a clue.
- Guessing is unlimited — a wrong guess costs nothing, so there is no "wrong" button.
- **Correct** scores the word and deals the next one. **Pass** skips it (passed words go
  back to the bottom of the pile).
- The turn ends when the team reaches the target number of words or the clock runs out.
- Every team plays its own timed turn, then the scoreboard ranks them: most words wins,
  and a tie breaks on the faster time.

Defaults are 5 words in 2 minutes; both are adjustable in setup.

## Screens

1. **Setup** — teams, word-bank filters, round length and word target.
2. **Handoff** — "pass the device to the clue-giver", so nobody sees the word by accident.
3. **Play** — the secret word in large type, timer, score, and Correct / Pass.
4. **Turn result** — what the team scored and every word they saw.
5. **Scoreboard** — final ranking.

Keyboard shortcuts during play: **Space** = correct, **P** = pass.

## Sound

Scoring, winning a turn, running out of time and the final scoreboard each get a sting,
and a countdown bed comes in for the closing stretch — timed so its last beat lands on
zero whatever the round length. Passing is silent: a pass is not a failure.

The speaker button in the header mutes everything, from any screen, and the choice is
remembered. Audio never blocks play — a missing file, an unsupported codec or a browser
autoplay block all degrade to silence. See [sounds/README.md](sounds/README.md) for the
clips and how to swap them.

## Playing in class

Students only need a browser and one link:

> **<https://audiophrases.github.io/Watchword/>**

It runs the same on Windows, ChromeOS, macOS, phones and tablets, with nothing to install.

Everything is client-side, so each device runs its own independent game. That suits the
intended format anyway: one device per group, passed to whoever is giving clues.

The only network requirement is access to `docs.google.com`, where the word bank lives.
If a school filter blocks it, the word list cannot load and the app will say so.

## Running locally

Browsers block `index.html` from loading its code when opened straight off the disk —
`app.js` is an ES module, and module scripts are refused on `file://` pages. So the
folder has to be served, even for a single-player look.

On Windows, double-click **`Play Watchword.bat`**. It finds Node.js or Python, starts the
server and opens a browser.

Anywhere else:

```sh
node serve.mjs        # or:  npm start
```

`serve.mjs` has no dependencies. It prints two addresses — `localhost` for this computer,
and a `192.168.x.x` one that other machines on the same network can open, Chromebooks
included. Note that many school networks isolate clients from each other, in which case
only the hosted version will reach them.

Add a port number to override the default 8000; if it is busy, the next free port is used.

## The word bank

Words load at runtime from a **published Google Sheet** — the same sheet the
[Impostor Game](https://github.com/audiophrases/impostor) uses. Anything you add or edit
in that sheet appears in **both apps** on the next page load; there is nothing to redeploy.

Sheet columns:

| Column        | Purpose                                                          |
|---------------|------------------------------------------------------------------|
| `language`    | `en`, `fr`, `ca`, … — becomes a language option                  |
| `level`       | CEFR level `A0`–`C2` — becomes a level filter                    |
| `category`    | Free text — becomes a category filter                            |
| `word`        | The secret word                                                  |
| `enabled`     | Set to `0`, `false` or `no` to retire a word without deleting it |
| `Distractors` | Comma-separated near-synonyms — dealt as extra words, see below  |

New languages, levels and categories appear as filters automatically — no code change
needed. Rows missing any of language / level / category / word are skipped.

### Related words

The `Distractors` column exists for the Impostor game, which hands those near-synonyms to
its impostor. As Watchword answers they are ordinary vocabulary, and there are about six
per row, so switching them on takes the bank from roughly 900 playable words to **5,500**:

| Language | Words only | With related words |
|----------|------------|--------------------|
| ca       | 275        | 1,713              |
| en       | 351        | 2,009              |
| fr       | 299        | 1,786              |

They are **on by default**, and the setup screen has a tickbox to turn them off. One thing
to weigh when picking a level: a useful distractor is a *rarer* near-synonym of its row's
word, so related words lean harder than the level they inherit — `cup` brings `mug`,
`sleep` brings `doze`, and `eavesdrop` sits in A1. Untick the box for a class that needs
to stay strictly on-level.

Switching them on also revives the idiom categories, whose `word` column is entirely
multi-word but whose distractors gloss each idiom in a single word — `blab` for
*spill the beans*.

A word is never dealt twice in one game, even where the sheet files it under two
categories on purpose (`apple` as food and as a brand). Where a curated word is also some
other row's distractor, the curated entry wins and keeps the level and category the sheet
filed it under.

### Only single-word answers are dealt

The clue is one word, so the answer must be one word too. There is no unambiguous moment
where *ice cream* has been guessed, and the format cannot judge a half-correct answer —
which is why *Password* itself never uses multi-word answers.

Entries containing a space are therefore **skipped, not deleted**. They stay in the sheet
for the Impostor game and for ordinary classroom use; Watchword simply never deals them.
Hyphenated and elided forms are one written token spoken as one word, so `rendez-vous`,
`grand-mère`, `s'asseoir` and `despertar-se` all stay in play.

This is a Watchword game rule, not a parsing rule, so it lives in `wordbank.js`. Both
game rules do: `data.js` only reads the sheet, and hands on every row it finds.

A level or category with nothing playable left is hidden from setup rather than offered
and then found empty. English `A0` disappears for this reason in both modes — it is a
class roster of *Surname, Firstname* rows, and those carry no distractors either.

`data.js` (fetch + parse) is deliberately a **standalone copy** rather than a shared
import, so neither app can break the other. It returns the same shape Impostor's does —
`bank[language][level][category] = [{ word, distractors }]` — so the two stay easy to
compare. The sheet is the single source of truth; if you change the parsing rules, apply
the change in both repos.

## Tests

A headless walkthrough of a full game (setup validation, both teams' turns, pause,
scoring, tie-breaking, no-repeat dealing, the single-word rule and the mute toggle) runs
against the live sheet, plus a suite that drives the countdown alignment against a fake
audio element:

```sh
npm install
npm test
```

## Deploying

GitHub Pages is enabled and serves `main` at the root, so **pushing to `main` publishes**.
The site is static — no build step, and usually live within a minute.
