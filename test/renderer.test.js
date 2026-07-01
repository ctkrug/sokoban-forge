import { describe, expect, it } from 'vitest';
import { TILE, createEmptyGrid } from '../src/game/grid.js';
import { drawGrid, drawState } from '../src/game/renderer.js';

function createStubContext() {
  return {
    fillStyleLog: [],
    fillRectLog: [],
    set fillStyle(value) {
      this.fillStyleLog.push(value);
    },
    get fillStyle() {
      return this.fillStyleLog[this.fillStyleLog.length - 1];
    },
    fillRect(x, y, width, height) {
      this.fillRectLog.push([x, y, width, height]);
    },
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

  it('fills each tile at its scaled pixel offset for a custom tile size', () => {
    // No prior test asserted fillRect's actual arguments - only fillStyle
    // (color) and call count were checked, leaving the x*tileSize/y*tileSize
    // pixel math itself unverified.
    const grid = createEmptyGrid(2, 2);
    const ctx = createStubContext();

    drawGrid(ctx, grid, 25);

    expect(ctx.fillRectLog).toEqual([
      [0, 0, 25, 25],
      [25, 0, 25, 25],
      [0, 25, 25, 25],
      [25, 25, 25, 25],
    ]);
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

  it('insets the box and player rects within their tile, player more than a box', () => {
    // Boxes and the player are drawn smaller than a full tile so grid lines
    // stay visible underneath; pin down the actual inset math (which one of
    // the two calls into drawEntity uses which inset) rather than just the
    // fillStyle color sequence checked elsewhere.
    const grid = createEmptyGrid(3, 3);
    const state = {
      grid,
      player: { x: 2, y: 0 },
      boxes: [{ x: 1, y: 1 }],
    };
    const ctx = createStubContext();

    drawState(ctx, state, 40);

    const boxRect = ctx.fillRectLog[9]; // after the 9 tile fills
    const playerRect = ctx.fillRectLog[10];
    expect(boxRect).toEqual([1 * 40 + 6, 1 * 40 + 6, 40 - 12, 40 - 12]);
    expect(playerRect).toEqual([2 * 40 + 10, 0 * 40 + 10, 40 - 20, 40 - 20]);
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
