import { describe, expect, it } from 'vitest';
import { TILE, createEmptyGrid } from '../src/game/grid.js';
import { createGameState, move } from '../src/game/state.js';

function gridWithWalls(width, height, walls = []) {
  const grid = createEmptyGrid(width, height);
  for (const { x, y } of walls) {
    grid[y][x] = TILE.WALL;
  }
  return grid;
}

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
