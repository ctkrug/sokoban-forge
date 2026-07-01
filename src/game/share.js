/**
 * Encodes a level's difficulty + seed as a URL query string, so a level
 * can be shared as a link and reproduced exactly (generateLevel is
 * deterministic for a given seed).
 */
export function encodeShareParams({ difficulty, seed }) {
  const params = new URLSearchParams();
  params.set('difficulty', difficulty);
  params.set('seed', String(seed));
  return `?${params.toString()}`;
}

/** Parses a query string back into { difficulty, seed }, or null if incomplete. */
export function decodeShareParams(search) {
  const params = new URLSearchParams(search);
  const difficulty = params.get('difficulty');
  const seed = params.get('seed');
  if (!difficulty || !seed) {
    return null;
  }
  return { difficulty, seed };
}

/**
 * A numeric-looking seed round-trips through the URL as a string; convert it
 * back to a number so it reproduces the exact same level (createRng treats
 * numeric and string seeds differently). Non-numeric seeds (or "NaN"/"" edge
 * cases) are passed through unchanged and still hash deterministically via
 * xmur3.
 */
export function parseSeed(rawSeed) {
  const asNumber = Number(rawSeed);
  return Number.isNaN(asNumber) ? rawSeed : asNumber;
}
