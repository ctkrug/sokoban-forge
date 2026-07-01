import { describe, expect, it } from 'vitest';
import {
  BUMP_MS,
  MOVE_MS,
  POP_MS,
  bumpOffset,
  easeOutCubic,
  lerp,
  popScale,
  progress,
  slidePosition,
} from '../src/game/motion.js';

describe('primitives', () => {
  it('lerps between two values', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 1)).toBe(10);
  });

  it('eases out: fast start, settled end', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5); // front-loaded
  });

  it('clamps progress to 0..1 and treats a non-positive duration as done', () => {
    expect(progress(-50, 100)).toBe(0);
    expect(progress(50, 100)).toBe(0.5);
    expect(progress(500, 100)).toBe(1);
    expect(progress(0, 0)).toBe(1);
  });
});

describe('slidePosition', () => {
  it('starts at from, ends exactly at to', () => {
    const from = { x: 1, y: 2 };
    const to = { x: 2, y: 2 };
    expect(slidePosition(from, to, 0)).toEqual(from);
    expect(slidePosition(from, to, MOVE_MS)).toEqual(to);
    expect(slidePosition(from, to, MOVE_MS * 10)).toEqual(to); // never overshoots
  });

  it('is between the endpoints mid-flight', () => {
    const mid = slidePosition({ x: 0, y: 0 }, { x: 1, y: 0 }, MOVE_MS / 2);
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.x).toBeLessThan(1);
    expect(mid.y).toBe(0);
  });
});

describe('bumpOffset', () => {
  it('pushes toward the wall mid-bump and returns to exactly zero', () => {
    const right = { dx: 1, dy: 0 };
    const mid = bumpOffset(right, BUMP_MS / 2);
    expect(mid.x).toBeCloseTo(0.18);
    expect(mid.y).toBe(0);

    const done = bumpOffset(right, BUMP_MS);
    expect(done.x).toBeCloseTo(0); // sin(pi) - the sprite never sticks off-grid
  });

  it('follows the bump direction on the other axis too', () => {
    const down = { dx: 0, dy: 1 };
    const mid = bumpOffset(down, BUMP_MS / 2);
    expect(mid.x).toBe(0);
    expect(mid.y).toBeGreaterThan(0);
  });
});

describe('popScale', () => {
  it('swells to its peak mid-pop and lands back at 1', () => {
    expect(popScale(0)).toBeCloseTo(1);
    expect(popScale(POP_MS / 2)).toBeCloseTo(1.18);
    expect(popScale(POP_MS)).toBeCloseTo(1);
    expect(popScale(POP_MS * 5)).toBeCloseTo(1); // clamped after the pop
  });
});
