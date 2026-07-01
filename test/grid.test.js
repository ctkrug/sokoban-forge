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
