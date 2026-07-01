import { describe, expect, it } from 'vitest';
import { decodeShareParams, encodeShareParams, parseSeed } from '../src/game/share.js';

describe('encodeShareParams / decodeShareParams', () => {
  it('round-trips difficulty and seed through a query string', () => {
    const query = encodeShareParams({ difficulty: 'hard', seed: 12345 });

    expect(decodeShareParams(query)).toEqual({ difficulty: 'hard', seed: '12345' });
  });

  it('returns null when the difficulty is missing', () => {
    expect(decodeShareParams('?seed=42')).toBeNull();
  });

  it('returns null when the seed is missing', () => {
    expect(decodeShareParams('?difficulty=easy')).toBeNull();
  });

  it('returns null for an empty query string', () => {
    expect(decodeShareParams('')).toBeNull();
  });

  it('accepts a seed of "0" instead of treating it as missing', () => {
    // "0" is a non-empty string (truthy), unlike the numeric 0 it
    // represents - make sure the `!seed` check doesn't confuse the two.
    expect(decodeShareParams('?difficulty=easy&seed=0')).toEqual({ difficulty: 'easy', seed: '0' });
  });
});

describe('parseSeed', () => {
  it('converts a numeric-looking string back to a number', () => {
    expect(parseSeed('12345')).toBe(12345);
  });

  it('leaves a non-numeric seed as a string', () => {
    expect(parseSeed('reproducible')).toBe('reproducible');
  });

  it('leaves the literal string "NaN" as a string instead of producing NaN', () => {
    expect(parseSeed('NaN')).toBe('NaN');
  });

  it('coerces an empty string to 0, matching Number("")', () => {
    // decodeShareParams already rejects an empty seed before this runs, but
    // parseSeed is still a plain function — pin down its actual behavior.
    expect(parseSeed('')).toBe(0);
  });

  it('coerces a whitespace-only string to 0, matching Number(" ")', () => {
    // Number(" ") is 0, not NaN, so unlike "NaN" or "reproducible" a
    // whitespace-only seed takes the numeric branch rather than being
    // hashed as a string - same trap as the empty-string case above, but
    // decodeShareParams's `!seed` guard doesn't catch it since a
    // non-empty-length string of spaces is truthy.
    expect(parseSeed('   ')).toBe(0);
  });
});
