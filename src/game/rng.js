/**
 * mulberry32: a small, fast 32-bit PRNG. Deterministic for a given integer
 * seed, which is what lets the generator reproduce the exact same level
 * from the same seed later (sharing, "daily puzzle" style features, etc.).
 * Returns a function that yields floats in [0, 1) on each call.
 */
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

/**
 * xmur3: hashes an arbitrary string into a 32-bit integer, so callers can
 * seed mulberry32 from a human-friendly string (e.g. a shared level code)
 * instead of requiring a raw number.
 */
export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** Builds a deterministic RNG from either a numeric or string seed. */
export function createRng(seed) {
  if (typeof seed === 'number') {
    return mulberry32(seed);
  }
  return mulberry32(xmur3(String(seed))());
}
