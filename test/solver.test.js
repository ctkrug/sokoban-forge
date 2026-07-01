import { describe, expect, it } from 'vitest';
import { TILE, createEmptyGrid } from '../src/game/grid.js';
import { createGameState, move } from '../src/game/state.js';
import { bfsSolve } from '../src/game/solver.js';

function applyPath(grid, player, boxes, path) {
  let state = createGameState({ grid, player, boxes });
  for (const direction of path) {
    state = move(state, direction);
  }
  return state;
}

describe('bfsSolve', () => {
  it('returns an empty path for an already-solved board', () => {
    const grid = createEmptyGrid(4, 4);
    grid[1][1] = TILE.TARGET;
    const path = bfsSolve(grid, { x: 0, y: 0 }, [{ x: 1, y: 1 }]);

    expect(path).toEqual([]);
  });

  it('finds a one-move solution when the box starts beside its target', () => {
    const grid = createEmptyGrid(4, 4);
    grid[1][3] = TILE.TARGET;
    const player = { x: 1, y: 1 };
    const boxes = [{ x: 1, y: 2 }];

    const path = bfsSolve(grid, player, boxes);

    expect(path).not.toBeNull();
    const solved = applyPath(grid, player, boxes, path);
    expect(solved.boxes).toEqual([{ x: 3, y: 1 }]);
  });

  it('solves a multi-push puzzle requiring the player to reposition', () => {
    const grid = createEmptyGrid(6, 6);
    for (let x = 0; x < 6; x += 1) {
      grid[0][x] = TILE.WALL;
      grid[5][x] = TILE.WALL;
    }
    for (let y = 0; y < 6; y += 1) {
      grid[y][0] = TILE.WALL;
      grid[y][5] = TILE.WALL;
    }
    grid[3][4] = TILE.TARGET;
    const player = { x: 1, y: 3 };
    const boxes = [{ x: 2, y: 3 }];

    const path = bfsSolve(grid, player, boxes);

    expect(path).not.toBeNull();
    const solved = applyPath(grid, player, boxes, path);
    expect(solved.boxes).toEqual([{ x: 4, y: 3 }]);
  });

  it('returns null for an unsolvable puzzle (box stuck in a corner)', () => {
    const grid = createEmptyGrid(4, 4);
    for (let x = 0; x < 4; x += 1) {
      grid[0][x] = TILE.WALL;
      grid[3][x] = TILE.WALL;
    }
    for (let y = 0; y < 4; y += 1) {
      grid[y][0] = TILE.WALL;
      grid[y][3] = TILE.WALL;
    }
    grid[2][2] = TILE.TARGET;
    const player = { x: 2, y: 1 };
    const boxes = [{ x: 1, y: 1 }]; // wedged against two walls, can never reach (2,2)

    const path = bfsSolve(grid, player, boxes);

    expect(path).toBeNull();
  });
});
