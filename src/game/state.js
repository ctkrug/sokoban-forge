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

/**
 * Attempts to move the player one step in `direction`. Handles both plain
 * walks and box pushes (a box ahead of the player slides one cell further
 * in the same direction, provided that cell is clear).
 *
 * Returns the same `state` reference, unchanged, when the move is illegal
 * (wall, board edge, or a push blocked by another wall/box) so callers can
 * detect a no-op with `===` instead of diffing state.
 */
export function move(state, direction) {
  const delta = DIRECTIONS[direction];
  if (!delta) {
    throw new RangeError(`unknown direction: ${direction}`);
  }

  const nx = state.player.x + delta.dx;
  const ny = state.player.y + delta.dy;
  if (!isWalkable(state.grid, nx, ny)) {
    return state;
  }

  const pushedIdx = boxIndexAt(state.boxes, nx, ny);
  let boxes = state.boxes;
  if (pushedIdx !== -1) {
    const bx = nx + delta.dx;
    const by = ny + delta.dy;
    if (!isWalkable(state.grid, bx, by) || boxIndexAt(state.boxes, bx, by) !== -1) {
      return state;
    }
    boxes = state.boxes.map((box, i) => (i === pushedIdx ? { x: bx, y: by } : box));
  }

  return {
    ...state,
    player: { x: nx, y: ny },
    boxes,
    moves: state.moves + 1,
  };
}
