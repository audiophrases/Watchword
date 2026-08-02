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

function playableWords(bank, language, level, category) {
  return (bank[language]?.[level]?.[category] || []).filter(isPlayable);
}

export function availableLanguages(bank) {
  return Object.keys(bank)
    .filter((language) =>
      Object.keys(bank[language]).some((level) =>
        Object.keys(bank[language][level]).some(
          (category) => playableWords(bank, language, level, category).length > 0,
        ),
      ),
    )
    .sort((a, b) => a.localeCompare(b));
}

// Levels with nothing playable are hidden rather than offered and then found
// empty — English A0 is entirely a class roster of "Surname, Firstname" rows.
export function availableLevels(bank, language) {
  const levels = Object.keys(bank[language] || {}).filter((level) =>
    Object.keys(bank[language][level]).some(
      (category) => playableWords(bank, language, level, category).length > 0,
    ),
  );
  const ordered = LEVEL_ORDER.filter((level) => levels.includes(level));
  const leftovers = levels.filter((level) => !ordered.includes(level)).sort();
  return [...ordered, ...leftovers];
}

// Likewise for categories — the idiom categories are wholly multi-word, so they
// never appear here.
export function availableCategories(bank, language, levels) {
  const categories = new Set();
  levels.forEach((level) => {
    const levelBank = bank[language]?.[level];
    if (!levelBank) return;
    Object.keys(levelBank).forEach((category) => {
      if (playableWords(bank, language, level, category).length) categories.add(category);
    });
  });
  return Array.from(categories).sort((a, b) => a.localeCompare(b));
}

export function buildPool(bank, language, levels, categories) {
  const languageBank = bank[language];
  if (!languageBank) return [];

  const pool = [];
  levels.forEach((level) => {
    const levelBank = languageBank[level];
    if (!levelBank) return;

    categories.forEach((category) => {
      playableWords(bank, language, level, category).forEach((word) =>
        pool.push({ word, level, category }),
      );
    });
  });

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

function signature(language, levels, categories) {
  return [
    language,
    [...levels].sort().join('|'),
    [...categories].sort().join('|'),
  ].join('__');
}

// A dealer hands out words one at a time, reshuffling only once the pool is
// exhausted. Rebuild it whenever the filters change.
export function createDealer(bank, language, levels, categories) {
  const pool = buildPool(bank, language, levels, categories);
  let queue = shuffle(pool);

  return {
    key: signature(language, levels, categories),
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
