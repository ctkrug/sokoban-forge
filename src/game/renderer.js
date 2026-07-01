import { TILE } from './grid.js';

export const DEFAULT_TILE_SIZE = 40;

const TILE_COLORS = {
  [TILE.WALL]: '#3a3f4b',
  [TILE.FLOOR]: '#23262e',
  [TILE.TARGET]: '#2e5c46',
};

const PLAYER_COLOR = '#e8c547';
const BOX_COLOR = '#8a6fd6';
const BOX_ON_TARGET_COLOR = '#4caf7d';

/**
 * Draws a grid of tiles onto a 2D canvas context. Pure rendering — takes no
 * game state beyond the grid itself, so it can be unit tested against a
 * stub context.
 */
export function drawGrid(ctx, grid, tileSize = DEFAULT_TILE_SIZE) {
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      ctx.fillStyle = TILE_COLORS[grid[y][x]] ?? TILE_COLORS[TILE.FLOOR];
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }
}

function drawEntity(ctx, x, y, color, tileSize, inset) {
  ctx.fillStyle = color;
  ctx.fillRect(x * tileSize + inset, y * tileSize + inset, tileSize - inset * 2, tileSize - inset * 2);
}

/** Draws the grid, then the boxes (colored by on/off target) and player on top. */
export function drawState(ctx, state, tileSize = DEFAULT_TILE_SIZE) {
  drawGrid(ctx, state.grid, tileSize);

  for (const box of state.boxes) {
    const onTarget = state.grid[box.y][box.x] === TILE.TARGET;
    drawEntity(ctx, box.x, box.y, onTarget ? BOX_ON_TARGET_COLOR : BOX_COLOR, tileSize, 6);
  }

  drawEntity(ctx, state.player.x, state.player.y, PLAYER_COLOR, tileSize, 10);
}
