import { DIFFICULTY_PRESETS, generateLevel } from './game/generator.js';
import { MoveHistory } from './game/history.js';
import { createGameState, isWon } from './game/state.js';
import { DEFAULT_TILE_SIZE, drawState } from './game/renderer.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const KEY_TO_DIRECTION = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

let history;

function newLevel(seed = Date.now()) {
  const level = generateLevel({ ...DIFFICULTY_PRESETS.medium, seed });
  canvas.width = level.grid[0].length * DEFAULT_TILE_SIZE;
  canvas.height = level.grid.length * DEFAULT_TILE_SIZE;
  history = new MoveHistory(createGameState(level));
  render();
}

function render() {
  drawState(ctx, history.state);
}

window.addEventListener('keydown', (event) => {
  const direction = KEY_TO_DIRECTION[event.key];
  if (!direction || isWon(history.state)) {
    return;
  }
  if (history.move(direction)) {
    render();
  }
});

newLevel();
