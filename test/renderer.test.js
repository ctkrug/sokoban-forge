import { describe, expect, it } from 'vitest';
import { TILE, createEmptyGrid } from '../src/game/grid.js';
import { drawGrid, drawState } from '../src/game/renderer.js';

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

describe('drawGrid', () => {
  it('falls back to the floor color for an unrecognized tile value', () => {
    const grid = createEmptyGrid(2, 1);
    grid[0][1] = 'lava'; // not a value TILE_COLORS knows about
    const ctx = createStubContext();

    drawGrid(ctx, grid);

    expect(ctx.fillStyleLog[1]).toBe(ctx.fillStyleLog[0]); // same as a plain floor tile
  });
});

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

  it('colors a box on its target differently from a box off target', () => {
    const grid = createEmptyGrid(4, 1);
    grid[0][1] = TILE.TARGET;
    const state = {
      grid,
      player: { x: 0, y: 0 },
      boxes: [
        { x: 1, y: 0 }, // on target
        { x: 3, y: 0 }, // off target
      ],
    };
    const ctx = createStubContext();

    drawState(ctx, state);

    // 4 tile fills, then the on-target box, then the off-target box.
    const [onTargetColor, offTargetColor] = ctx.fillStyleLog.slice(4, 6);
    expect(onTargetColor).not.toBe(offTargetColor);
  });
});
