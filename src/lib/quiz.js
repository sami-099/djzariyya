import { shuffle } from './shuffle.js';
import { isAmbiguous, label, norm } from './wordbank.js';


/**
 * Validate a typed-in number of questions.
 * Accepts whole numbers from 1 to `max` (the number of selected words).
 * Returns { ok: true, value } or { ok: false, error } with a message to show.
 */
export function parseQuestionCount(raw, max) {
  const text = String(raw).trim();
  const range = max === 1 ? 'The only option is 1.' : `Enter a whole number from 1 to ${max}.`;
  if (text === '') return { ok: false, error: range };
  // Digits only: rejects negatives, decimals, exponents and stray characters.
  if (!/^\d+$/.test(text)) return { ok: false, error: `Whole numbers only. ${range}` };
  const value = Number(text);
  if (value < 1) return { ok: false, error: `At least 1 question. ${range}` };
  if (value > max) {
    return { ok: false, error: `Only ${max} word${max === 1 ? '' : 's'} selected. ${range}` };
  }
  return { ok: true, value };
}
export const OPTIONS_PER_QUESTION = 4;

/** 'en-da' asks in English and answers in Darija; 'da-en' is the reverse. */
export function sidesFor(direction) {
  return direction === 'en-da'
    ? { promptSide: 'en', answerSide: 'darija' }
    : { promptSide: 'darija', answerSide: 'en' };
}

/**
 * Build a quiz.
 *
 * Questions and wrong answers both come from `pool`, so a quiz on Fruits
 * only ever shows fruits. A question normally has four options; it has
 * fewer when the pool cannot supply three suitable wrong answers (a very
 * small selection, or one whose words overlap in meaning).
 *
 * @param pool      the selected words: source of questions and wrong answers
 * @param count     number of questions, or 'all'
 * @param direction 'en-da' | 'da-en'
 * @param rng       random source, injectable for tests
 */
export function buildQuiz({ pool, count, direction, rng = Math.random }) {
  const { promptSide, answerSide } = sidesFor(direction);
  const total = count === 'all' ? pool.length : Math.min(count, pool.length);

  return shuffle(pool, rng)
    .slice(0, total)
    .map((word) => {
      const answer = label(word, answerSide);
      // Answer texts that are off-limits: the right answer itself, plus the
      // text of every word that could be confused with this one. Blocking by
      // text (not by word) matters because several words share a spelling,
      // e.g. "Small" and "Young" are both "Sghir".
      const used = new Set([norm(answer)]);
      for (const other of pool) {
        if (isAmbiguous(word, other)) used.add(norm(label(other, answerSide)));
      }
      const options = [{ label: answer, correct: true }];

      for (const candidate of shuffle(pool, rng)) {
        if (options.length === OPTIONS_PER_QUESTION) break;
        const text = label(candidate, answerSide);
        if (used.has(norm(text))) continue;
        used.add(norm(text));
        options.push({ label: text, correct: false });
      }

      return {
        word,
        prompt: label(word, promptSide),
        answer,
        options: shuffle(options, rng),
      };
    });
}
