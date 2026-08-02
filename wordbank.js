// Selection + draw logic on top of the raw bank from data.js.
// Keeps a shuffled queue per filter selection so words never repeat until the
// whole filtered pool has been used.

import { LEVEL_ORDER } from './data.js';

export function availableLanguages(bank) {
  return Object.keys(bank).sort((a, b) => a.localeCompare(b));
}

export function availableLevels(bank, language) {
  const levels = Object.keys(bank[language] || {});
  const ordered = LEVEL_ORDER.filter((level) => levels.includes(level));
  const leftovers = levels.filter((level) => !ordered.includes(level)).sort();
  return [...ordered, ...leftovers];
}

export function availableCategories(bank, language, levels) {
  const categories = new Set();
  levels.forEach((level) => {
    const levelBank = bank[language]?.[level];
    if (!levelBank) return;
    Object.keys(levelBank).forEach((category) => categories.add(category));
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
      const words = levelBank[category] || [];
      words.forEach((word) => pool.push({ word, level, category }));
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
