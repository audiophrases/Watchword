// Selection + draw logic on top of the raw bank from data.js.
// Keeps a shuffled queue per filter selection so words never repeat until the
// whole filtered pool has been used.

import { LEVEL_ORDER } from './data.js';

// Two settings decide what may be dealt. Every function here takes them as one
// options object rather than a row of booleans, so a call site cannot silently
// swap them.
//
//   includeRelated  deal the sheet's distractors as answers too   (default on)
//   allowPhrases    deal multi-word answers as well as single ones (default off)
export const DEFAULT_RULES = { includeRelated: true, allowPhrases: false };

function rules(options) {
  // These took a bare `includeRelated` boolean once. Spreading a stray boolean
  // yields an empty object, so an un-migrated call would quietly run on the
  // defaults instead of what it asked for — fail loudly rather than silently.
  if (options != null && typeof options !== 'object') {
    throw new TypeError('wordbank: pass an options object, e.g. { includeRelated, allowPhrases }');
  }
  return { ...DEFAULT_RULES, ...(options || {}) };
}

// Watchword is built for single-word answers. The clue is one word, so the
// answer is normally one word too: with "ice cream" there is no unambiguous
// moment where the guess is right, and the format cannot judge a half-correct
// answer. Password avoids multi-word answers entirely for this reason, which is
// why single-word is the default — but `allowPhrases` opens it up for classes
// that want the collocations and idioms the sheet is full of.
//
// Nothing is ever deleted either way: excluded entries stay in the shared
// sheet, where the Impostor game and ordinary classroom use still want them.
//
// Hyphenated and elided forms count as one word whatever the setting:
// "pique-nique", "rendez-vous", "grand-mère", "s'asseoir" and "despertar-se"
// are a single written token, spoken as one word. Only whitespace splits a word.
export function isPlayable(word, allowPhrases = false) {
  if (typeof word !== 'string') return false;
  const trimmed = word.trim();
  if (trimmed === '') return false;
  return allowPhrases || !/\s/u.test(trimmed);
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
function playableEntries(bank, language, level, category, options) {
  const { includeRelated, allowPhrases } = rules(options);
  const rows = bank[language]?.[level]?.[category] || [];
  const entries = [];

  rows.forEach((row) => {
    if (isPlayable(row.word, allowPhrases)) entries.push({ word: row.word, related: false });
    if (!includeRelated) return;
    (row.distractors || []).forEach((word) => {
      if (isPlayable(word, allowPhrases)) entries.push({ word, related: true });
    });
  });

  return entries;
}

function hasPlayable(bank, language, options) {
  return Object.keys(bank[language] || {}).some((level) =>
    Object.keys(bank[language][level]).some(
      (category) => playableEntries(bank, language, level, category, options).length > 0,
    ),
  );
}

export function availableLanguages(bank, options) {
  return Object.keys(bank)
    .filter((language) => hasPlayable(bank, language, options))
    .sort((a, b) => a.localeCompare(b));
}

// Levels with nothing playable are hidden rather than offered and then found
// empty — English A0 is entirely a class roster of "Surname, Firstname" rows.
export function availableLevels(bank, language, options) {
  const levels = Object.keys(bank[language] || {}).filter((level) =>
    Object.keys(bank[language][level]).some(
      (category) => playableEntries(bank, language, level, category, options).length > 0,
    ),
  );
  const ordered = LEVEL_ORDER.filter((level) => levels.includes(level));
  const leftovers = levels.filter((level) => !ordered.includes(level)).sort();
  return [...ordered, ...leftovers];
}

// Likewise for categories. The idiom categories are wholly multi-word in their
// `word` column, so they appear only once distractors are switched on — those
// gloss the idiom in a single word ("blab" for "spill the beans").
export function availableCategories(bank, language, levels, options) {
  const categories = new Set();
  levels.forEach((level) => {
    const levelBank = bank[language]?.[level];
    if (!levelBank) return;
    Object.keys(levelBank).forEach((category) => {
      if (playableEntries(bank, language, level, category, options).length) {
        categories.add(category);
      }
    });
  });
  return Array.from(categories).sort((a, b) => a.localeCompare(b));
}

export function buildPool(bank, language, levels, categories, options) {
  const { includeRelated } = rules(options);
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
        playableEntries(bank, language, level, category, options).forEach(
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

function signature(language, levels, categories, options) {
  const { includeRelated, allowPhrases } = rules(options);
  return [
    language,
    [...levels].sort().join('|'),
    [...categories].sort().join('|'),
    includeRelated ? 'related' : 'core',
    allowPhrases ? 'phrases' : 'single',
  ].join('__');
}

// A dealer hands out words one at a time, reshuffling only once the pool is
// exhausted. Rebuild it whenever the filters change.
export function createDealer(bank, language, levels, categories, options) {
  const pool = buildPool(bank, language, levels, categories, options);
  let queue = shuffle(pool);

  return {
    key: signature(language, levels, categories, options),
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
