import { describe, expect, it } from 'vitest';
import data from '../data/wordbank.json';
import { allWords, buildDeck, isAmbiguous, wordKey } from '../src/lib/wordbank.js';

const { categories } = data;

// These tests double as the data-quality gate for word bank changes:
// a malformed entry added to wordbank.json fails the pipeline.
describe('word bank data', () => {
  it('has categories with unique, URL-safe ids', () => {
    const ids = categories.map((c) => c.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('has a name and at least one word in every category', () => {
    for (const category of categories) {
      expect(category.name.trim(), category.id).not.toBe('');
      expect(category.words.length, category.id).toBeGreaterThan(0);
    }
  });

  it('has well-formed words', () => {
    for (const word of allWords(categories)) {
      const where = `${word.categoryId}: ${JSON.stringify(word)}`;
      for (const side of ['en', 'darija']) {
        expect(Array.isArray(word[side]), where).toBe(true);
        expect(word[side].length, where).toBeGreaterThan(0);
        for (const variant of word[side]) {
          expect(typeof variant, where).toBe('string');
          expect(variant, where).toBe(variant.trim());
          expect(variant, where).not.toBe('');
        }
      }
      if ('note' in word) expect(word.note.trim(), where).not.toBe('');
      const extra = Object.keys(word).filter((k) => !['en', 'darija', 'note', 'categoryId'].includes(k));
      expect(extra, where).toEqual([]);
    }
  });

  it('has no repeated word inside a category', () => {
    for (const category of categories) {
      const keys = category.words.map(wordKey);
      expect(new Set(keys).size, category.id).toBe(keys.length);
    }
  });

  it('has enough distinct words to build four-option questions', () => {
    expect(buildDeck(categories, categories.map((c) => c.id)).length).toBeGreaterThanOrEqual(20);
  });
});

describe('buildDeck', () => {
  it('returns only words from the selected categories', () => {
    const deck = buildDeck(categories, ['fruits', 'colors']);
    expect(deck.length).toBeGreaterThan(0);
    for (const word of deck) expect(['fruits', 'colors']).toContain(word.categoryId);
  });

  it('removes words that appear in more than one selected category', () => {
    const deck = buildDeck(categories, ['body', 'appearance']);
    const hair = deck.filter((w) => w.en.length === 1 && w.en[0] === 'Hair');
    expect(hair).toHaveLength(1);
    expect(new Set(deck.map(wordKey)).size).toBe(deck.length);
  });

  it('returns nothing when nothing is selected', () => {
    expect(buildDeck(categories, [])).toEqual([]);
  });
});

describe('isAmbiguous', () => {
  const w = (en, darija) => ({ en: [en].flat(), darija: [darija].flat() });

  it('flags words that share a Darija variant', () => {
    expect(isAmbiguous(w('Big', 'Kbir'), w('Old (person)', ['Kbir', '3ajouz']))).toBe(true);
  });

  it('flags words that share an English variant', () => {
    expect(isAmbiguous(w(['Beautiful', 'Pretty'], 'Chbab'), w(['Handsome', 'Beautiful'], 'Zin'))).toBe(true);
  });

  it('flags a phrase that contains the other as whole words', () => {
    expect(isAmbiguous(w('Tired', '3ayan'), w("I'm tired", 'Rani 3ayan'))).toBe(true);
    expect(isAmbiguous(w('Hair', 'Ch3ar'), w('Long hair', 'Ch3ar twil'))).toBe(true);
  });

  it('does not flag unrelated or merely similar-looking words', () => {
    expect(isAmbiguous(w('Egg', 'Beida'), w('Eggs', 'Beid'))).toBe(false);
    expect(isAmbiguous(w('Water', 'Ma'), w('My mother', 'Mama'))).toBe(false);
    expect(isAmbiguous(w('Orange (fruit)', 'Tchina'), w('Orange (color)', 'Bortqali'))).toBe(false);
  });
});
