import { TILE, inBounds } from './grid.js';

// Cardinal directions the player can move in. Kept as a plain map (rather
// than an enum) so callers can do DIRECTIONS[input] without a lookup helper.
export const DIRECTIONS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export function isWalkable(grid, x, y) {
  return inBounds(grid, x, y) && grid[y][x] !== TILE.WALL;
}

export function boxIndexAt(boxes, x, y) {
  return boxes.findIndex((box) => box.x === x && box.y === y);
}

/**
 * Builds a fresh game state from a grid and starting entity positions.
 * `player`/`boxes` are copied so the caller's objects can't be mutated
 * through the returned state.
 */
export function createGameState({ grid, player, boxes }) {
  return {
    grid,
    player: { ...player },
    boxes: boxes.map((box) => ({ ...box })),
    moves: 0,
  };
}
