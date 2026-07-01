import { describe, expect, it } from 'vitest';
import { DIFFICULTY_PRESETS, generateLevel } from '../src/game/generator.js';
import { bfsSolve } from '../src/game/solver.js';

describe('generateLevel', () => {
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
});
