import { DIFFICULTY_PRESETS, generateLevel } from './game/generator.js';
import { MoveHistory } from './game/history.js';
import { createGameState, isWon } from './game/state.js';
import { DEFAULT_TILE_SIZE, drawState } from './game/renderer.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const difficultySelect = document.getElementById('difficulty');
const newLevelButton = document.getElementById('new-level');
const resetButton = document.getElementById('reset');
const undoButton = document.getElementById('undo');
const moveCounter = document.getElementById('move-counter');
const statusLine = document.getElementById('status');

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
let currentLevel;

function newLevel(seed = Date.now()) {
  currentLevel = generateLevel({ ...DIFFICULTY_PRESETS[difficultySelect.value], seed });
  canvas.width = currentLevel.grid[0].length * DEFAULT_TILE_SIZE;
  canvas.height = currentLevel.grid.length * DEFAULT_TILE_SIZE;
  history = new MoveHistory(createGameState(currentLevel));
  render();
}

function resetLevel() {
  history.reset(createGameState(currentLevel));
  render();
}

function render() {
  drawState(ctx, history.state);
  moveCounter.textContent = `Moves: ${history.state.moves}`;
  undoButton.disabled = !history.canUndo();
  statusLine.textContent = isWon(history.state) ? 'Solved! 🎉' : '';
}

function tryMove(direction) {
  if (!direction || isWon(history.state)) {
    return;
  }
  if (history.move(direction)) {
    render();
  }
}

window.addEventListener('keydown', (event) => tryMove(KEY_TO_DIRECTION[event.key]));

/**
 * Click/tap support: a tap on one of the four tiles orthogonally adjacent
 * to the player moves in that direction, mirroring the keyboard controls
 * without requiring a virtual d-pad.
 */
canvas.addEventListener('click', (event) => {
  const rect = canvas.getBoundingClientRect();
  const tileX = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width / DEFAULT_TILE_SIZE);
  const tileY = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height / DEFAULT_TILE_SIZE);
  const { x: px, y: py } = history.state.player;

  if (tileX === px && tileY === py - 1) tryMove('up');
  else if (tileX === px && tileY === py + 1) tryMove('down');
  else if (tileY === py && tileX === px - 1) tryMove('left');
  else if (tileY === py && tileX === px + 1) tryMove('right');
});

difficultySelect.addEventListener('change', () => newLevel());
newLevelButton.addEventListener('click', () => newLevel());
resetButton.addEventListener('click', () => resetLevel());
undoButton.addEventListener('click', () => {
  if (history.undo()) {
    render();
  }
});

newLevel();
