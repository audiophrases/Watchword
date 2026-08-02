# Watchword

A one-word-clue guessing game for language classrooms, inspired by the Spanish TV show
*Password*. Runs on a single shared device — no accounts, no build step, no backend.

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

## Running locally

Open `index.html` directly in a browser, or serve the folder:

```
python -m http.server 8000     # or:  npm start
```

Then visit http://localhost:8000.

## The word bank

Words load at runtime from a **published Google Sheet** — the same sheet the
[Impostor Game](https://github.com/audiophrases/impostor) uses. Anything you add or edit
in that sheet appears in **both apps** on the next page load; there is nothing to redeploy.

Sheet columns:

| Column     | Purpose                                                     |
|------------|-------------------------------------------------------------|
| `language` | `en`, `fr`, `ca`, … — becomes a language option             |
| `level`    | CEFR level `A0`–`C2` — becomes a level filter               |
| `category` | Free text — becomes a category filter                       |
| `word`     | The secret word                                             |
| `enabled`  | Set to `0`, `false` or `no` to retire a word without deleting it |

New languages, levels and categories appear as filters automatically — no code change
needed. Rows missing any of language / level / category / word are skipped.

`data.js` (fetch + parse) is deliberately a **standalone copy** rather than a shared
import, so neither app can break the other. The sheet is the single source of truth; if
you change the parsing rules, apply the change in both repos.

## Tests

A headless walkthrough of a full game (setup validation, both teams' turns, pause,
scoring, tie-breaking, no-repeat dealing) runs against the live sheet:

```
npm install
npm test
```

## Deploying to GitHub Pages

Push the repository, then in **Settings → Pages** choose *Deploy from a branch*, select
`main` and the `/ (root)` folder. The site is static, so no build step is involved.
