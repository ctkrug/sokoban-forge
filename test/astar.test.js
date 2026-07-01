import { describe, expect, it } from 'vitest';
import { TILE, createEmptyGrid } from '../src/game/grid.js';
import { createGameState, move } from '../src/game/state.js';
import { aStarSolve, bfsSolve } from '../src/game/solver.js';

function applyPath(grid, player, boxes, path) {
  let state = createGameState({ grid, player, boxes });
  for (const direction of path) {
    state = move(state, direction);
  }
  return state;
}

function borderedGrid(size) {
  const grid = createEmptyGrid(size, size);
  for (let i = 0; i < size; i += 1) {
    grid[0][i] = TILE.WALL;
    grid[size - 1][i] = TILE.WALL;
    grid[i][0] = TILE.WALL;
    grid[i][size - 1] = TILE.WALL;
  }
  return grid;
}

describe('aStarSolve', () => {
  it('returns an empty path for an already-solved board', () => {
    const grid = createEmptyGrid(4, 4);
    grid[1][1] = TILE.TARGET;

    expect(aStarSolve(grid, { x: 0, y: 0 }, [{ x: 1, y: 1 }])).toEqual([]);
  });

  it('finds a solution that actually solves the board', () => {
    const grid = borderedGrid(6);
    grid[3][4] = TILE.TARGET;
    const player = { x: 1, y: 3 };
    const boxes = [{ x: 2, y: 3 }];

    const path = aStarSolve(grid, player, boxes);

    expect(path).not.toBeNull();
    const solved = applyPath(grid, player, boxes, path);
    expect(solved.boxes).toEqual([{ x: 4, y: 3 }]);
  });

  it('finds a solution of the same optimal length as BFS', () => {
    const grid = borderedGrid(7);
    grid[2][5] = TILE.TARGET;
    grid[4][5] = TILE.TARGET;
    const player = { x: 1, y: 1 };
    const boxes = [
      { x: 2, y: 2 },
      { x: 2, y: 4 },
    ];

    const bfsPath = bfsSolve(grid, player, boxes);
    const aStarPath = aStarSolve(grid, player, boxes);

    expect(bfsPath).not.toBeNull();
    expect(aStarPath).not.toBeNull();
    expect(aStarPath.length).toBe(bfsPath.length);
  });

  it('returns null for an unsolvable puzzle', () => {
    const grid = borderedGrid(4);
    grid[2][2] = TILE.TARGET;
    const player = { x: 2, y: 1 };
    const boxes = [{ x: 1, y: 1 }];

    expect(aStarSolve(grid, player, boxes)).toBeNull();
  });
});
