import { describe, expect, it } from 'vitest';
import { TILE, createEmptyGrid } from '../src/game/grid.js';
import { createGameState, isWon } from '../src/game/state.js';

function gridWithTargets(width, height, targets) {
  const grid = createEmptyGrid(width, height);
  for (const { x, y } of targets) {
    grid[y][x] = TILE.TARGET;
  }
  return grid;
}

describe('isWon', () => {
  it('is false when a target has no box on it', () => {
    const state = createGameState({
      grid: gridWithTargets(4, 4, [{ x: 2, y: 2 }]),
      player: { x: 0, y: 0 },
      boxes: [{ x: 1, y: 1 }],
    });

    expect(isWon(state)).toBe(false);
  });

  it('is true when every target has a box on it', () => {
    const state = createGameState({
      grid: gridWithTargets(4, 4, [
        { x: 2, y: 2 },
        { x: 3, y: 1 },
      ]),
      player: { x: 0, y: 0 },
      boxes: [
        { x: 2, y: 2 },
        { x: 3, y: 1 },
      ],
    });

    expect(isWon(state)).toBe(true);
  });

  it('is false for a level with no targets at all', () => {
    const state = createGameState({
      grid: gridWithTargets(4, 4, []),
      player: { x: 0, y: 0 },
      boxes: [],
    });

    expect(isWon(state)).toBe(false);
  });
});
