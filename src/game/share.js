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
