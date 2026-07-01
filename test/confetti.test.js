import { describe, expect, it } from 'vitest';
import {
  CONFETTI_COLORS,
  CONFETTI_COUNT,
  confettiAlpha,
  spawnConfetti,
  stepConfetti,
} from '../src/game/confetti.js';

/** Deterministic 0..1 sequence so spawn positions are reproducible. */
function seededRandom() {
  let n = 0;
  return () => {
    n = (n * 9301 + 49297) % 233280;
    return n / 233280;
  };
}

describe('spawnConfetti', () => {
  it('spawns the full burst across the board width, starting above it', () => {
    const cols = 8;
    const particles = spawnConfetti(cols, seededRandom());

    expect(particles).toHaveLength(CONFETTI_COUNT);
    for (const p of particles) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(cols);
      expect(p.y).toBeLessThanOrEqual(0); // rains in from above the board
      expect(CONFETTI_COLORS).toContain(p.color);
    }
  });

  it('cycles through the board palette so all four colors appear', () => {
    const colors = new Set(spawnConfetti(4, seededRandom()).map((p) => p.color));
    expect(colors.size).toBe(CONFETTI_COLORS.length);
  });

  it('uses Math.random by default', () => {
    // Just the happy default path: valid particles, no injection required.
    const particles = spawnConfetti(5);
    expect(particles).toHaveLength(CONFETTI_COUNT);
  });
});

describe('stepConfetti', () => {
  it('applies velocity and gravity without mutating the input', () => {
    const initial = spawnConfetti(6, seededRandom());
    const before = JSON.parse(JSON.stringify(initial));

    const stepped = stepConfetti(initial, 0.1);

    expect(initial).toEqual(before); // pure
    expect(stepped[0].y).toBeGreaterThan(initial[0].y); // fell
    expect(stepped[0].vy).toBeGreaterThan(initial[0].vy); // accelerated
    expect(stepped[0].angle).not.toBe(initial[0].angle); // tumbled
  });

  it('expires particles at the end of their life', () => {
    const particles = spawnConfetti(6, seededRandom());
    expect(stepConfetti(particles, 0.5)).toHaveLength(CONFETTI_COUNT);
    expect(stepConfetti(particles, 10)).toHaveLength(0);
  });
});

describe('confettiAlpha', () => {
  it('holds full opacity for most of the life, fading only at the end', () => {
    expect(confettiAlpha({ life: 1.8 })).toBe(1);
    expect(confettiAlpha({ life: 0.25 })).toBeCloseTo(0.5);
    expect(confettiAlpha({ life: 0 })).toBe(0);
    expect(confettiAlpha({ life: -1 })).toBe(0); // clamped, never negative
  });
});
