import { describe, expect, it } from 'vitest';
import data from '../data/wordbank.json';
import { buildQuiz, parseQuestionCount } from '../src/lib/quiz.js';
import { shuffle } from '../src/lib/shuffle.js';
import { buildDeck, isAmbiguous, label, norm, wordKey } from '../src/lib/wordbank.js';

const { categories } = data;
const everything = buildDeck(categories, categories.map((c) => c.id));

// Small seeded generator so the tests are repeatable.
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('shuffle', () => {
  it('keeps every item and leaves the input untouched', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(input, seeded(1));
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(input);
  });
});

describe('parseQuestionCount', () => {
  it('accepts whole numbers from 1 up to the number of selected words', () => {
    expect(parseQuestionCount('1', 40)).toEqual({ ok: true, value: 1 });
    expect(parseQuestionCount('17', 40)).toEqual({ ok: true, value: 17 });
    expect(parseQuestionCount('40', 40)).toEqual({ ok: true, value: 40 });
    expect(parseQuestionCount(' 12 ', 40)).toEqual({ ok: true, value: 12 });
    expect(parseQuestionCount('007', 40)).toEqual({ ok: true, value: 7 });
  });

  it('rejects zero and negative numbers', () => {
    for (const raw of ['0', '00', '-1', '-10']) {
      expect(parseQuestionCount(raw, 40).ok, raw).toBe(false);
    }
  });

  it('rejects more than the number of selected words', () => {
    expect(parseQuestionCount('41', 40).ok).toBe(false);
    expect(parseQuestionCount('999999999999999999999', 40).ok).toBe(false);
  });

  it('rejects anything that is not a whole number', () => {
    for (const raw of ['', '  ', '2.5', '1e1', '10.0', 'ten', '5 5', '+5', '0x10', '٣', 'NaN', 'Infinity']) {
      expect(parseQuestionCount(raw, 40).ok, JSON.stringify(raw)).toBe(false);
    }
  });

  it('explains what is allowed', () => {
    expect(parseQuestionCount('50', 40).error).toMatch(/1 to 40/);
    expect(parseQuestionCount('2', 1).error).toMatch(/only option is 1/i);
  });
});

describe('buildQuiz', () => {
  for (const direction of ['en-da', 'da-en']) {
    describe(direction, () => {
      // Many seeds over the whole bank: every word gets asked many times.
      const quizzes = Array.from({ length: 25 }, (_, seed) =>
        buildQuiz({ pool: everything, count: 'all', direction, rng: seeded(seed) }),
      );
      const questions = quizzes.flat();

      it('gives every question four distinct options with exactly one correct', () => {
        for (const q of questions) {
          expect(q.options, q.prompt).toHaveLength(4);
          expect(q.options.filter((o) => o.correct), q.prompt).toHaveLength(1);
          expect(new Set(q.options.map((o) => norm(o.label))).size, q.prompt).toBe(4);
          expect(q.options.find((o) => o.correct).label).toBe(q.answer);
        }
      });

      it('never offers a wrong answer that could also be right', () => {
        const answerSide = direction === 'en-da' ? 'darija' : 'en';
        for (const q of questions) {
          const wrong = new Set(q.options.filter((o) => !o.correct).map((o) => norm(o.label)));
          const culprits = everything.filter((c) => wrong.has(norm(label(c, answerSide))) && isAmbiguous(q.word, c));
          // A wrong label is only acceptable if no ambiguous word produces it.
          expect(culprits.map((c) => label(c, answerSide)), q.prompt).toEqual([]);
        }
      });

      it('asks each word once per quiz', () => {
        for (const quiz of quizzes) {
          expect(new Set(quiz.map((q) => wordKey(q.word))).size).toBe(quiz.length);
        }
      });
    });
  }

  it('respects the requested number of questions', () => {
    for (const count of [1, 7, 10, 33]) {
      expect(buildQuiz({ pool: everything, count, direction: 'da-en' })).toHaveLength(count);
    }
    expect(buildQuiz({ pool: everything, count: 'all', direction: 'da-en' })).toHaveLength(everything.length);
  });

  it('caps the count at the size of the selection', () => {
    const pool = buildDeck(categories, ['weather']);
    expect(buildQuiz({ pool, count: 25, direction: 'da-en' })).toHaveLength(pool.length);
  });

  it('draws questions and every answer choice from the selected categories only', () => {
    for (const direction of ['en-da', 'da-en']) {
      const answerSide = direction === 'en-da' ? 'darija' : 'en';
      for (const ids of [['fruits'], ['animals', 'clothes'], ['house', 'furniture', 'colors']]) {
        const pool = buildDeck(categories, ids);
        const allowed = new Set(pool.map((w) => norm(label(w, answerSide))));
        for (let seed = 0; seed < 10; seed++) {
          for (const q of buildQuiz({ pool, count: 'all', direction, rng: seeded(seed) })) {
            expect(ids).toContain(q.word.categoryId);
            for (const option of q.options) expect(allowed.has(norm(option.label)), option.label).toBe(true);
          }
        }
      }
    }
  });

  it('gives fewer options when the selection is too small for four', () => {
    const pool = buildDeck(categories, ['weather']);
    expect(pool).toHaveLength(3);
    for (const q of buildQuiz({ pool, count: 'all', direction: 'da-en', rng: seeded(1) })) {
      expect(q.options).toHaveLength(3);
      expect(q.options.filter((o) => o.correct)).toHaveLength(1);
    }
  });

  it('always includes the correct answer and at least one wrong one, for every single category', () => {
    for (const category of categories) {
      const pool = buildDeck(categories, [category.id]);
      for (const direction of ['en-da', 'da-en']) {
        for (const q of buildQuiz({ pool, count: 'all', direction, rng: seeded(3) })) {
          expect(q.options.filter((o) => o.correct), `${category.id}: ${q.prompt}`).toHaveLength(1);
          expect(q.options.length, `${category.id}: ${q.prompt}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('produces different options on different runs', () => {
    const pool = buildDeck(categories, ['fruits']);
    const run = (seed) =>
      JSON.stringify(buildQuiz({ pool, count: 'all', direction: 'da-en', rng: seeded(seed) }).map((q) => q.options));
    expect(run(1)).not.toBe(run(2));
  });
});
