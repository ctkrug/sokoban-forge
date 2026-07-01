import { describe, expect, it } from 'vitest';
import { createRng, mulberry32, xmur3 } from '../src/game/rng.js';

describe('mulberry32', () => {
  it('produces the same sequence for the same numeric seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);

    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());

    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);

    expect(a()).not.toBe(b());
  });

  it('accepts a zero seed rather than treating it as absent', () => {
    // 0 is falsy, so a naive `seed || fallback` upstream would silently
    // replace it - pin down that mulberry32 itself has no such trap.
    const a = mulberry32(0);
    const b = mulberry32(0);

    expect(a()).toBe(b());
  });

  it('is deterministic for a negative seed', () => {
    // `seed >>> 0` wraps a negative integer into the unsigned 32-bit range
    // (e.g. -5 becomes 4294967291) rather than throwing - pin down that the
    // wrap is itself deterministic, since a crafted share URL like
    // ?seed=-5 reaches this same coercion via parseSeed.
    const a = mulberry32(-5);
    const b = mulberry32(-5);

    expect(a()).toBe(b());
  });

  it('always yields floats in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 100; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('xmur3', () => {
  it('hashes the same string to the same integer', () => {
    expect(xmur3('sokoban')()).toBe(xmur3('sokoban')());
  });

  it('hashes different strings to different integers', () => {
    expect(xmur3('sokoban')()).not.toBe(xmur3('forge')());
  });

  it('hashes an empty string without throwing', () => {
    expect(() => xmur3('')()).not.toThrow();
    expect(xmur3('')()).toBe(xmur3('')());
  });

  it('hashes a string containing multi-byte characters deterministically', () => {
    // charCodeAt walks UTF-16 code units, so an astral character (e.g. an
    // emoji) is seen as a surrogate pair rather than one code point - still
    // fine for a hash (it just needs to be a deterministic function of the
    // string), but worth pinning down since a shared level code is free-form
    // user-facing text.
    expect(xmur3('sököbän 📦')()).toBe(xmur3('sököbän 📦')());
    expect(xmur3('sököbän 📦')()).not.toBe(xmur3('sokoban')());
  });
});

describe('createRng', () => {
  it('is deterministic for a given string seed', () => {
    const seqA = Array.from({ length: 5 }, () => createRng('level-1')());
    const seqB = Array.from({ length: 5 }, () => createRng('level-1')());

    expect(seqA).toEqual(seqB);
  });

  it('is deterministic for a given numeric seed', () => {
    const seqA = Array.from({ length: 5 }, () => createRng(99)());
    const seqB = Array.from({ length: 5 }, () => createRng(99)());

    expect(seqA).toEqual(seqB);
  });

  it('treats a numeric seed and its string form as different seeds', () => {
    // The numeric branch feeds mulberry32 directly; the string branch hashes
    // it through xmur3 first, so 42 and "42" take genuinely different code
    // paths - this is exactly why share.js's parseSeed exists (a URL always
    // round-trips the seed as a string, so it must be converted back to a
    // number to reproduce the original level rather than a different one).
    expect(createRng(42)()).not.toBe(createRng('42')());
  });
});
