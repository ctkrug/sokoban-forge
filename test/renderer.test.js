import { describe, expect, it } from 'vitest';
import { TILE, createEmptyGrid } from '../src/game/grid.js';
import { drawState } from '../src/game/renderer.js';

function createStubContext() {
  return {
    fillStyleLog: [],
    set fillStyle(value) {
      this.fillStyleLog.push(value);
    },
    get fillStyle() {
      return this.fillStyleLog[this.fillStyleLog.length - 1];
    },
    fillRect() {},
  };
}

describe('drawState', () => {
  it('draws the grid tiles followed by boxes and the player', () => {
    const grid = createEmptyGrid(3, 3);
    grid[1][1] = TILE.TARGET;
    const state = {
      grid,
      player: { x: 0, y: 0 },
      boxes: [{ x: 1, y: 1 }],
    };
    const ctx = createStubContext();

    drawState(ctx, state);

    // 9 tile fills, then 1 box fill, then 1 player fill.
    expect(ctx.fillStyleLog).toHaveLength(11);
    expect(ctx.fillStyleLog[9]).not.toBe(ctx.fillStyleLog[0]); // box color != floor color
  });
});
