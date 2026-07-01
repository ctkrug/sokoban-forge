import { describe, expect, it } from 'vitest';
import { TILE, createEmptyGrid } from '../src/game/grid.js';
import { createGameState, move } from '../src/game/state.js';
import { aStarSolve, bfsSolve } from '../src/game/solver.js';
import { DIFFICULTY_PRESETS, generateLevel } from '../src/game/generator.js';

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

  it('gives up and returns null when maxStates is exhausted before a solution is found', () => {
    // A solution genuinely exists here, but capping maxStates at 1 forces
    // aStarSolve to stop after expanding only the start state.
    const grid = borderedGrid(6);
    grid[3][4] = TILE.TARGET;
    const player = { x: 1, y: 3 };
    const boxes = [{ x: 2, y: 3 }];

    expect(aStarSolve(grid, player, boxes, { maxStates: 1 })).toBeNull();
  });

  it('solves an open room with several boxes where push order is interchangeable', () => {
    // Regression/coverage: with multiple boxes free to be pushed in any
    // order, the frontier can rediscover the same (player, boxes) state via
    // a cheaper path after a costlier one is already queued. This exercises
    // the stale-entry skip that keeps A* from expanding an outdated node.
    const grid = borderedGrid(9);
    grid[1][3] = TILE.TARGET;
    grid[4][1] = TILE.TARGET;
    grid[4][2] = TILE.TARGET;
    grid[4][6] = TILE.TARGET;
    const player = { x: 7, y: 3 };
    const boxes = [
      { x: 5, y: 4 },
      { x: 1, y: 4 },
      { x: 6, y: 3 },
      { x: 3, y: 6 },
    ];

    const path = aStarSolve(grid, player, boxes);

    expect(path).not.toBeNull();
    const solved = applyPath(grid, player, boxes, path);
    expect(
      solved.boxes.every((box) => grid[box.y][box.x] === TILE.TARGET),
    ).toBe(true);
  });

  it.each(Object.entries(DIFFICULTY_PRESETS))(
    "always agrees with BFS's optimal path length on generated %s levels",
    (_name, preset) => {
      // A* trades BFS's exhaustive frontier for a heuristic-guided one - if
      // the heuristic were ever non-admissible (overestimating the true
      // cost), A* could return a *longer* path than BFS's guaranteed-optimal
      // one without either solver reporting an error. Check agreement across
      // many seeds per preset, not just the one or two hand-picked boards
      // covered elsewhere in this file.
      for (let seed = 1; seed <= 15; seed += 1) {
        const level = generateLevel({ ...preset, seed });
        const bfsPath = bfsSolve(level.grid, level.player, level.boxes, { maxStates: 500000 });
        const aStarPath = aStarSolve(level.grid, level.player, level.boxes, { maxStates: 500000 });

        expect(bfsPath).not.toBeNull();
        expect(aStarPath).not.toBeNull();
        expect(aStarPath.length).toBe(bfsPath.length);
      }
    },
  );
});
