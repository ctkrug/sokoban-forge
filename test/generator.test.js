import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIFFICULTY_PRESETS, generateLevel } from '../src/game/generator.js';
import { aStarSolve, bfsSolve } from '../src/game/solver.js';
import { createGameState, isWon, move } from '../src/game/state.js';

describe('generateLevel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to Date.now() as the seed when none is given', () => {
    const params = { width: 8, height: 8, boxCount: 2, scrambleDepth: 20 };
    vi.spyOn(Date, 'now').mockReturnValue(123456789);

    const withoutSeed = generateLevel(params);
    const withEquivalentSeed = generateLevel({ ...params, seed: 123456789 });

    expect(withoutSeed).toEqual(withEquivalentSeed);
  });

  it('produces the exact same level for the same seed', () => {
    const params = { width: 8, height: 8, boxCount: 2, scrambleDepth: 20, seed: 'reproducible' };

    const a = generateLevel(params);
    const b = generateLevel(params);

    expect(a).toEqual(b);
  });

  it('produces a different level for a different seed', () => {
    const base = { width: 8, height: 8, boxCount: 2, scrambleDepth: 20 };

    const a = generateLevel({ ...base, seed: 'seed-a' });
    const b = generateLevel({ ...base, seed: 'seed-b' });

    expect(a).not.toEqual(b);
  });

  it('rejects boards too small to fit a border and one interior cell', () => {
    expect(() => generateLevel({ width: 3, height: 3, boxCount: 1, scrambleDepth: 5, seed: 1 })).toThrow(
      RangeError,
    );
  });

  it('rejects a non-finite width instead of failing deep inside array allocation', () => {
    // Regression: `NaN < 4` is false, so the naive range check let a NaN
    // width slip through to `Array(width)` and blow up with an opaque
    // "Invalid array length" RangeError instead of this function's own
    // clear message.
    expect(() => generateLevel({ width: NaN, height: 8, boxCount: 2, scrambleDepth: 5, seed: 1 })).toThrow(
      /at least 4x4/,
    );
  });

  it('rejects a non-integer boxCount', () => {
    expect(() =>
      generateLevel({ width: 8, height: 8, boxCount: 1.5, scrambleDepth: 5, seed: 1 }),
    ).toThrow(/must fit the interior/);
  });

  it('rejects a negative scrambleDepth', () => {
    // Without this guard, a negative scrambleDepth silently degraded to the
    // same behavior as 0 instead of failing fast on the bad input.
    expect(() =>
      generateLevel({ width: 8, height: 8, boxCount: 2, scrambleDepth: -1, seed: 1 }),
    ).toThrow(/scrambleDepth must be a non-negative integer/);
  });

  it('accepts a scrambleDepth of exactly 0', () => {
    expect(() =>
      generateLevel({ width: 8, height: 8, boxCount: 2, scrambleDepth: 0, seed: 1 }),
    ).not.toThrow();
  });

  it('rejects a boxCount that leaves no room for the player', () => {
    // 4x4 board has a 2x2 = 4-cell interior; 4 boxes leaves nowhere to stand.
    expect(() => generateLevel({ width: 4, height: 4, boxCount: 4, scrambleDepth: 5, seed: 1 })).toThrow(
      RangeError,
    );
  });

  it('accepts a boxCount that exactly fills the interior but for the player', () => {
    // 4x4 board has a 2x2 = 4-cell interior; 3 boxes + 1 player exactly
    // fills it, the boundary just inside the rejection tested above.
    expect(() => generateLevel({ width: 4, height: 4, boxCount: 3, scrambleDepth: 5, seed: 1 })).not.toThrow();
  });

  it('stays fast even on a board where a box can never be pulled', () => {
    // Regression: a 4x4 board's interior is only 2x2, so no pull can ever
    // move a box off its target (there's no free cell beyond it in either
    // direction to pull into) - every one of the dead-end retry loop's
    // attempts used to burn its full step budget without ever succeeding,
    // multiplying a single attempt's cost by the full retry count.
    const start = performance.now();
    generateLevel({ width: 4, height: 4, boxCount: 1, scrambleDepth: 5, seed: 1 });
    expect(performance.now() - start).toBeLessThan(250);
  });

  it('never produces a level that is already solved on spawn', () => {
    // Regression: a random pull-walk can easily wander for the whole
    // scramble without ever standing next to the lone box on the "easy"
    // preset (boxCount: 1), leaving it exactly on its target - a level
    // that looks "solved" before the player makes a single move. This
    // used to happen for the large majority of seeds.
    for (let seed = 1; seed <= 500; seed += 1) {
      const level = generateLevel({ ...DIFFICULTY_PRESETS.easy, seed });
      expect(isWon(createGameState(level))).toBe(false);
    }
  });

  it.each(Object.entries(DIFFICULTY_PRESETS))(
    'never produces an already-solved %s level either',
    (_name, preset) => {
      // Multiple boxes make an all-on-target spawn far less likely than the
      // easy preset, but the same stillSolved() guard covers them too - lock
      // that in so a future change to the guard can't silently regress it.
      for (let seed = 1; seed <= 200; seed += 1) {
        const level = generateLevel({ ...preset, seed });
        expect(isWon(createGameState(level))).toBe(false);
      }
    },
  );

  it('re-rolls a scramble that dead-ends before any box leaves its target', () => {
    // Regression: seed 4306 on the "hard" preset used to hit a player-move
    // dead end (no legal pull in any direction) on its very first scramble
    // step, before any of the 3 boxes moved off their target - shipping a
    // board that looked already solved on load.
    const level = generateLevel({ ...DIFFICULTY_PRESETS.hard, seed: 4306 });
    expect(isWon(createGameState(level))).toBe(false);
  });

  it.each(Object.entries(DIFFICULTY_PRESETS))(
    'always generates a solvable level for the %s preset',
    (_name, preset) => {
      for (const seed of [1, 2, 3, 4, 5]) {
        const level = generateLevel({ ...preset, seed });
        const path = bfsSolve(level.grid, level.player, level.boxes, { maxStates: 500000 });
        expect(path).not.toBeNull();
      }
    },
  );

  // The app itself only calls bfsSolve for boards at or below the "easy"
  // preset's cell count and routes everything larger (medium, hard) through
  // aStarSolve, so that's the path that actually needs covering here.
  it.each(Object.entries(DIFFICULTY_PRESETS).filter(([name]) => name !== 'easy'))(
    "aStarSolve's path actually wins the generated %s level",
    (_name, preset) => {
      for (const seed of [1, 2, 3]) {
        const level = generateLevel({ ...preset, seed });
        const path = aStarSolve(level.grid, level.player, level.boxes, { maxStates: 500000 });
        expect(path).not.toBeNull();

        let state = createGameState(level);
        for (const direction of path) {
          state = move(state, direction);
        }
        expect(isWon(state)).toBe(true);
      }
    },
  );
});
