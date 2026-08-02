// Selection + draw logic on top of the raw bank from data.js.
// Keeps a shuffled queue per filter selection so words never repeat until the
// whole filtered pool has been used.

import { LEVEL_ORDER } from './data.js';

// Watchword can only be played with single-word answers. The clue is one word,
// so the answer has to be one word too: with "ice cream" there is no
// unambiguous moment where the guess is right, and the format has no way to
// judge a half-correct answer. Password avoids multi-word answers entirely for
// this reason, and so do we.
//
// These entries are *skipped, never deleted* — they stay in the shared sheet,
// where the Impostor game and ordinary classroom use still want them.
//
// Hyphenated and elided forms stay in play: "pique-nique", "rendez-vous",
// "grand-mère", "s'asseoir", "despertar-se" are one written token, spoken as
// one word. Only whitespace splits a word here.
export function isPlayable(word) {
  return typeof word === 'string' && word.trim() !== '' && !/\s/u.test(word.trim());
}

// The sheet's `Distractors` column holds the near-synonyms the Impostor game
// hands its impostor — six or so per row, sharing that row's language, level
// and category. As Watchword answers they are perfectly good vocabulary and
// they grow the bank about sixfold, so they are dealt by default.
//
// Worth knowing when choosing a level: a useful distractor is a *rarer*
// near-synonym of its row's word, so they skew harder than the level they
// inherit — "cup" brings "mug", "sleep" brings "doze" and "eavesdrop" sits in
// A1. Turn them off for a class that needs to stay strictly on-level.
function playableEntries(bank, language, level, category, includeRelated = true) {
  const rows = bank[language]?.[level]?.[category] || [];
  const entries = [];

  rows.forEach((row) => {
    if (isPlayable(row.word)) entries.push({ word: row.word, related: false });
    if (!includeRelated) return;
    (row.distractors || []).forEach((word) => {
      if (isPlayable(word)) entries.push({ word, related: true });
    });
  });

  return entries;
}

function hasPlayable(bank, language, includeRelated) {
  return Object.keys(bank[language] || {}).some((level) =>
    Object.keys(bank[language][level]).some(
      (category) => playableEntries(bank, language, level, category, includeRelated).length > 0,
    ),
  );
}

export function availableLanguages(bank, includeRelated = true) {
  return Object.keys(bank)
    .filter((language) => hasPlayable(bank, language, includeRelated))
    .sort((a, b) => a.localeCompare(b));
}

// Levels with nothing playable are hidden rather than offered and then found
// empty — English A0 is entirely a class roster of "Surname, Firstname" rows.
export function availableLevels(bank, language, includeRelated = true) {
  const levels = Object.keys(bank[language] || {}).filter((level) =>
    Object.keys(bank[language][level]).some(
      (category) => playableEntries(bank, language, level, category, includeRelated).length > 0,
    ),
  );
  const ordered = LEVEL_ORDER.filter((level) => levels.includes(level));
  const leftovers = levels.filter((level) => !ordered.includes(level)).sort();
  return [...ordered, ...leftovers];
}

// Likewise for categories. The idiom categories are wholly multi-word in their
// `word` column, so they appear only once distractors are switched on — those
// gloss the idiom in a single word ("blab" for "spill the beans").
export function availableCategories(bank, language, levels, includeRelated = true) {
  const categories = new Set();
  levels.forEach((level) => {
    const levelBank = bank[language]?.[level];
    if (!levelBank) return;
    Object.keys(levelBank).forEach((category) => {
      if (playableEntries(bank, language, level, category, includeRelated).length) {
        categories.add(category);
      }
    });
  });
  return Array.from(categories).sort((a, b) => a.localeCompare(b));
}

export function buildPool(bank, language, levels, categories, includeRelated = true) {
  const languageBank = bank[language];
  if (!languageBank) return [];

  const pool = [];
  // The sheet files some words under two categories or levels on purpose
  // ("apple" as food and as a brand), and distractors repeat far more often
  // still. Keep the first sighting so a single game never deals one twice.
  const seen = new Set();

  const collect = (wantRelated) => {
    levels.forEach((level) => {
      const levelBank = languageBank[level];
      if (!levelBank) return;

      categories.forEach((category) => {
        playableEntries(bank, language, level, category, includeRelated).forEach(
          ({ word, related }) => {
            if (related !== wantRelated) return;
            const key = word.toLocaleLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            pool.push({ word, level, category, related });
          },
        );
      });
    });
  };

  // Curated words first, so one that also happens to be another row's
  // distractor keeps the level and category the sheet actually filed it under.
  collect(false);
  if (includeRelated) collect(true);

  return pool;
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function signature(language, levels, categories, includeRelated) {
  return [
    language,
    [...levels].sort().join('|'),
    [...categories].sort().join('|'),
    includeRelated ? 'related' : 'core',
  ].join('__');
}

// A dealer hands out words one at a time, reshuffling only once the pool is
// exhausted. Rebuild it whenever the filters change.
export function createDealer(bank, language, levels, categories, includeRelated = true) {
  const pool = buildPool(bank, language, levels, categories, includeRelated);
  let queue = shuffle(pool);

  return {
    key: signature(language, levels, categories, includeRelated),
    size: pool.length,
    remaining: () => queue.length,
    next() {
      if (!pool.length) return null;
      if (!queue.length) queue = shuffle(pool);
      return queue.pop();
    },
    // A passed word goes to the bottom of the pile rather than being burned,
    // so it can come back around later in the session.
    pushBack(item) {
      if (item) queue.unshift(item);
    },
    reset() {
      queue = shuffle(pool);
    },
  };
}
