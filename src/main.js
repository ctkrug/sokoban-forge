import { createEmptyGrid } from './game/grid.js';
import { drawGrid, DEFAULT_TILE_SIZE } from './game/renderer.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Placeholder board until the procedural generator (see docs/BACKLOG.md) lands.
const grid = createEmptyGrid(
  canvas.width / DEFAULT_TILE_SIZE,
  canvas.height / DEFAULT_TILE_SIZE,
);

drawGrid(ctx, grid);
