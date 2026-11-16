/**
 * Fisher-Yates shuffle. Returns a new array; the input is left untouched.
 * `rng` is injectable so tests can pass a seeded generator.
 */
export function shuffle(items, rng = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
