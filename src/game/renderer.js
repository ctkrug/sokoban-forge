import { TILE } from './grid.js';

export const DEFAULT_TILE_SIZE = 40;

const TILE_COLORS = {
  [TILE.WALL]: '#3a3f4b',
  [TILE.FLOOR]: '#23262e',
  [TILE.TARGET]: '#2e5c46',
};

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
