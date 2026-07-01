import { describe, expect, it } from 'vitest';
import { TILE, createEmptyGrid } from '../src/game/grid.js';
import { countBoxesOnTarget, createGameState, move } from '../src/game/state.js';

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
