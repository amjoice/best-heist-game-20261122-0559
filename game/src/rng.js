// Deterministic randomness: mulberry32 plus small helpers. The game never
// calls Math.random during play, so a seed plus an input script always
// replays the same job — the screenshots and the grading runs agree.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A tiny RNG object with the helpers the game uses. */
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    /** Float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** Integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** Pick one element of an array. */
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
  };
}
