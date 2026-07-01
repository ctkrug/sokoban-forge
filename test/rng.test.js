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
});
