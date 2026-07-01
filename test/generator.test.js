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

  it('rejects a boxCount that leaves no room for the player', () => {
    // 4x4 board has a 2x2 = 4-cell interior; 4 boxes leaves nowhere to stand.
    expect(() => generateLevel({ width: 4, height: 4, boxCount: 4, scrambleDepth: 5, seed: 1 })).toThrow(
      RangeError,
    );
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
