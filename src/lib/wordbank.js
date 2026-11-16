/**
 * Helpers for working with the word bank (src/data/wordbank.json).
 *
 * A word looks like:
 *   { "en": ["Sofa", "Couch"], "darija": ["Kanapé", "Sofa"], "note": "optional" }
 * `en` and `darija` are lists of accepted variants; `note` holds extras such
 * as feminine or plural forms.
 */

export const SIDES = ['en', 'darija'];

/** Text shown for one side of a word, e.g. "Kanapé / Sofa". */
export function label(word, side) {
  return word[side].join(' / ');
}

/** Lowercase, strip accents and punctuation, collapse spaces. */
export function norm(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[?!.,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Identity of a word: the same word listed in two categories has the same key. */
export function wordKey(word) {
  return `${norm(label(word, 'en'))}=${norm(label(word, 'darija'))}`;
}

/** Every word in the given categories, tagged with its category id. */
export function allWords(categories) {
  return categories.flatMap((category) =>
    category.words.map((word) => ({ ...word, categoryId: category.id })),
  );
}

/**
 * Words from the selected categories, with repeats removed
 * (e.g. "Hair" appears under both Body parts and Appearance).
 */
export function buildDeck(categories, selectedIds) {
  const selected = new Set(selectedIds);
  const seen = new Set();
  const deck = [];
  for (const word of allWords(categories.filter((c) => selected.has(c.id)))) {
    const key = wordKey(word);
    if (seen.has(key)) continue;
    seen.add(key);
    deck.push(word);
  }
  return deck;
}

// True when one phrase equals the other or appears inside it as whole words:
// "3ayan" overlaps "rani 3ayan", but "beid" does not overlap "beida".
function overlaps(a, b) {
  return ` ${a} `.includes(` ${b} `) || ` ${b} `.includes(` ${a} `);
}

function sideOverlaps(a, b, side) {
  return a[side].some((x) => b[side].some((y) => overlaps(norm(x), norm(y))));
}

/**
 * Two words are "ambiguous" if they could be confused as quiz answers:
 * they share (or contain) a variant on either side. "Big -> Kbir" and
 * "Old (person) -> Kbir / 3ajouz" are ambiguous, so one must never be
 * offered as a wrong answer for the other.
 */
export function isAmbiguous(a, b) {
  return SIDES.some((side) => sideOverlaps(a, b, side));
}
