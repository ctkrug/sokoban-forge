import { describe, expect, it } from 'vitest';
import { createEmptyGrid, inBounds, TILE } from '../src/game/grid.js';

describe('createEmptyGrid', () => {
  it('creates a grid with the requested dimensions filled with floor tiles', () => {
    const grid = createEmptyGrid(4, 3);
    expect(grid).toHaveLength(3);
    expect(grid[0]).toHaveLength(4);
    expect(grid.flat().every((tile) => tile === TILE.FLOOR)).toBe(true);
  });

  it('rejects non-positive dimensions', () => {
    expect(() => createEmptyGrid(0, 3)).toThrow(RangeError);
    expect(() => createEmptyGrid(3, -1)).toThrow(RangeError);
  });

  it('rejects a non-finite height instead of silently returning a 0-row grid', () => {
    // Regression: `NaN <= 0` is false, so the old positivity-only check let
    // NaN through to Array.from({ length: NaN }, ...), which coerces to
    // length 0 rather than throwing - a caller would get an empty grid back
    // with no indication anything went wrong.
    expect(() => createEmptyGrid(4, NaN)).toThrow(/positive integers/);
  });

  it('rejects a non-integer width', () => {
    expect(() => createEmptyGrid(4.5, 4)).toThrow(/positive integers/);
  });

  it('gives each row its own array, not shared references to one row', () => {
    // Classic footgun: `Array(height).fill(Array(width).fill(FLOOR))` would
    // fill every row with references to the *same* inner array, so writing
    // to one row's cell would silently corrupt every other row. Pin down
    // that mutating one row leaves the rest of the grid untouched.
    const grid = createEmptyGrid(3, 3);

    grid[0][0] = TILE.WALL;

    expect(grid[1][0]).toBe(TILE.FLOOR);
    expect(grid[2][0]).toBe(TILE.FLOOR);
    expect(grid[0]).not.toBe(grid[1]);
  });
});

describe('inBounds', () => {
  const grid = createEmptyGrid(4, 3);

  it('accepts coordinates inside the grid', () => {
    expect(inBounds(grid, 0, 0)).toBe(true);
    expect(inBounds(grid, 3, 2)).toBe(true);
  });

  it('rejects coordinates outside the grid', () => {
    expect(inBounds(grid, -1, 0)).toBe(false);
    expect(inBounds(grid, 4, 0)).toBe(false);
    expect(inBounds(grid, 0, 3)).toBe(false);
  });
});
