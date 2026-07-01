// Tile vocabulary shared by the generator, solver, and renderer.
export const TILE = {
  WALL: 'wall',
  FLOOR: 'floor',
  TARGET: 'target',
};

/**
 * Creates a rectangular grid of floor tiles.
 * @param {number} width
 * @param {number} height
 * @returns {string[][]} grid[y][x]
 */
export function createEmptyGrid(width, height) {
  if (width <= 0 || height <= 0) {
    throw new RangeError('grid dimensions must be positive');
  }
  return Array.from({ length: height }, () => Array(width).fill(TILE.FLOOR));
}

export function inBounds(grid, x, y) {
  return y >= 0 && y < grid.length && x >= 0 && x < grid[0].length;
}
