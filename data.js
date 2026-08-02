// Word bank loader — reads the shared Google Sheet published as CSV.
// Sheet columns: language, level, category, word, enabled, notes
// Shape returned: bank[language][level][category] = [word, ...]

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQcxAWrO_CWYBeeP8XFDZVuqz_V8R93lIffKbstLBpnQK-1CSL4pqS-Us5DJI0OrY02MiKO1Thj5J3L/pub?gid=2048829432&single=true&output=csv';

export const LEVEL_ORDER = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const LANGUAGE_LABELS = {
  en: 'English',
  fr: 'Français',
  ca: 'Català',
  es: 'Español',
};

export function languageLabel(code) {
  return LANGUAGE_LABELS[code] || code;
}

function normalizeHeader(header = '') {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.length > 1 || row[0]) {
    rows.push(row);
  }

  return rows;
}

// A row counts as disabled only when the sheet says so explicitly, so a blank
// `enabled` cell keeps the word in play.
function isEnabled(raw) {
  const value = (raw || '').trim().toLowerCase();
  return !['0', 'false', 'no', 'n'].includes(value);
}

export async function fetchWordBank() {
  const response = await fetch(CSV_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Could not download the latest word list.');
  }

  const text = await response.text();
  const rows = parseCsv(text);
  if (!rows.length) {
    throw new Error('The word list is empty.');
  }

  const headers = rows[0].map(normalizeHeader);
  const languageIdx = headers.findIndex((h) => h === 'language' || h === 'lang');
  const levelIdx = headers.findIndex((h) => h.startsWith('level') || h === 'cefr');
  const categoryIdx = headers.findIndex((h) => h.startsWith('category'));
  const wordIdx = headers.findIndex((h) => h === 'word' || h === 'words');
  const enabledIdx = headers.findIndex((h) => h.startsWith('enabled'));

  if ([languageIdx, levelIdx, categoryIdx, wordIdx].some((idx) => idx === -1)) {
    throw new Error('The sheet must include language, level, category, and word columns.');
  }

  const bank = {};

  rows.slice(1).forEach((cells) => {
    const language = (cells[languageIdx] || '').trim();
    const level = (cells[levelIdx] || '').trim();
    const category = (cells[categoryIdx] || '').trim();
    const word = (cells[wordIdx] || '').trim();

    if (!language || !level || !category || !word) return;
    if (enabledIdx >= 0 && !isEnabled(cells[enabledIdx])) return;

    if (!bank[language]) bank[language] = {};
    if (!bank[language][level]) bank[language][level] = {};
    if (!bank[language][level][category]) bank[language][level][category] = [];

    bank[language][level][category].push(word);
  });

  if (!Object.keys(bank).length) {
    throw new Error('No valid words found in the sheet.');
  }

  return bank;
}
