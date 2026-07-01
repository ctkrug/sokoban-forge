import { describe, expect, it } from 'vitest';
import { TILE, createEmptyGrid } from '../src/game/grid.js';
import {
  boxIndexAt,
  countBoxesOnTarget,
  createGameState,
  findTargets,
  isBoardSolved,
  move,
} from '../src/game/state.js';

function gridWithWalls(width, height, walls = []) {
  const grid = createEmptyGrid(width, height);
  for (const { x, y } of walls) {
    grid[y][x] = TILE.WALL;
  }
  return grid;
}

describe('createGameState', () => {
  it('copies player and boxes so the caller cannot mutate the state through them', () => {
    // Reset relies on this: it calls createGameState(currentLevel) again on
    // every reset, reusing the same level.player/level.boxes objects each
    // time - if they weren't copied, playing a move on one "reset" of the
    // level would silently corrupt every other reset sharing those objects.
    const player = { x: 1, y: 1 };
    const boxes = [{ x: 2, y: 2 }];
    const state = createGameState({ grid: gridWithWalls(5, 5), player, boxes });

    player.x = 99;
    boxes[0].x = 99;

    expect(state.player).toEqual({ x: 1, y: 1 });
    expect(state.boxes).toEqual([{ x: 2, y: 2 }]);
  });
});

describe('move', () => {
  it('walks the player into an open floor tile', () => {
    const state = createGameState({
      grid: gridWithWalls(5, 5),
      player: { x: 2, y: 2 },
      boxes: [],
    });

    const next = move(state, 'right');

    expect(next.player).toEqual({ x: 3, y: 2 });
    expect(next.moves).toBe(1);
  });

  it('is a no-op when walking into a wall', () => {
    const state = createGameState({
      grid: gridWithWalls(5, 5, [{ x: 3, y: 2 }]),
      player: { x: 2, y: 2 },
      boxes: [],
    });

    const next = move(state, 'right');

    expect(next).toBe(state);
  });

  it('is a no-op when walking off the edge of the board', () => {
    const state = createGameState({
      grid: gridWithWalls(5, 5),
      player: { x: 0, y: 0 },
      boxes: [],
    });

    const next = move(state, 'left');

    expect(next).toBe(state);
  });

  it('pushes a box one cell further in the move direction', () => {
    const state = createGameState({
      grid: gridWithWalls(5, 5),
      player: { x: 2, y: 2 },
      boxes: [{ x: 3, y: 2 }],
    });

    const next = move(state, 'right');

    expect(next.player).toEqual({ x: 3, y: 2 });
    expect(next.boxes).toEqual([{ x: 4, y: 2 }]);
  });

  it('refuses to push a box into a wall', () => {
    const state = createGameState({
      grid: gridWithWalls(5, 5, [{ x: 4, y: 2 }]),
      player: { x: 2, y: 2 },
      boxes: [{ x: 3, y: 2 }],
    });

    const next = move(state, 'right');

    expect(next).toBe(state);
  });

  it('refuses to push a box into another box', () => {
    const state = createGameState({
      grid: gridWithWalls(5, 5),
      player: { x: 2, y: 2 },
      boxes: [
        { x: 3, y: 2 },
        { x: 4, y: 2 },
      ],
    });

    const next = move(state, 'right');

    expect(next).toBe(state);
  });

  it('throws for an unrecognized direction', () => {
    const state = createGameState({
      grid: gridWithWalls(3, 3),
      player: { x: 1, y: 1 },
      boxes: [],
    });

    expect(() => move(state, 'diagonal')).toThrow(RangeError);
  });
});

describe('countBoxesOnTarget', () => {
  it('counts only the boxes actually sitting on a target tile', () => {
    const grid = gridWithWalls(5, 5);
    grid[1][1] = TILE.TARGET;
    grid[2][2] = TILE.TARGET;
    const state = createGameState({
      grid,
      player: { x: 0, y: 0 },
      boxes: [
        { x: 1, y: 1 }, // on target
        { x: 3, y: 3 }, // off target
      ],
    });

    expect(countBoxesOnTarget(state)).toBe(1);
  });

  it('is 0 for a board with no boxes', () => {
    const state = createGameState({ grid: gridWithWalls(4, 4), player: { x: 0, y: 0 }, boxes: [] });

    expect(countBoxesOnTarget(state)).toBe(0);
  });
});

describe('isBoardSolved', () => {
  // isWon and the solver's goal check both delegate to this directly, so
  // its own behavior is exercised indirectly all over the suite already -
  // these pin down the function's contract in isolation, independent of
  // either caller.
  it('is true when every target has a box on it', () => {
    const grid = gridWithWalls(4, 4);
    grid[1][1] = TILE.TARGET;

    expect(isBoardSolved(grid, [{ x: 1, y: 1 }])).toBe(true);
  });

  it('is false for a boxless board, even with targets present', () => {
    const grid = gridWithWalls(4, 4);
    grid[1][1] = TILE.TARGET;

    expect(isBoardSolved(grid, [])).toBe(false);
  });

  it('is false for a board with no targets at all', () => {
    expect(isBoardSolved(gridWithWalls(4, 4), [])).toBe(false);
  });
});

describe('boxIndexAt', () => {
  const boxes = [
    { x: 1, y: 1 },
    { x: 2, y: 2 },
  ];

  it('returns the index of the box at the given coordinates', () => {
    expect(boxIndexAt(boxes, 2, 2)).toBe(1);
  });

  it('returns -1 when no box is at the given coordinates', () => {
    expect(boxIndexAt(boxes, 5, 5)).toBe(-1);
  });

  it('returns -1 for an empty boxes array', () => {
    expect(boxIndexAt([], 0, 0)).toBe(-1);
  });
});

describe('findTargets', () => {
  it('collects every target tile in row-major order', () => {
    const grid = gridWithWalls(3, 3);
    grid[0][2] = TILE.TARGET;
    grid[2][0] = TILE.TARGET;

    expect(findTargets(grid)).toEqual([
      { x: 2, y: 0 },
      { x: 0, y: 2 },
    ]);
  });

  it('returns an empty array when there are no targets', () => {
    expect(findTargets(gridWithWalls(3, 3))).toEqual([]);
  });
});
