import { DIFFICULTY_PRESETS, generateLevel } from './game/generator.js';
import { MoveHistory } from './game/history.js';
import { createGameState, isWon } from './game/state.js';
import { DEFAULT_TILE_SIZE, drawState } from './game/renderer.js';
import { aStarSolve, bfsSolve } from './game/solver.js';

// Below this many reachable board cells, plain BFS explores the state
// space fast enough; larger boards switch to A* so the heuristic keeps
// the frontier small.
const BFS_CELL_THRESHOLD = 49;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const difficultySelect = document.getElementById('difficulty');
const newLevelButton = document.getElementById('new-level');
const resetButton = document.getElementById('reset');
const undoButton = document.getElementById('undo');
const moveCounter = document.getElementById('move-counter');
const statusLine = document.getElementById('status');
const solveButton = document.getElementById('solve');
const solveStepButton = document.getElementById('solve-step');
const solvePlayButton = document.getElementById('solve-play');
const solveSpeedInput = document.getElementById('solve-speed');

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
let solution = null;
let solutionIndex = 0;
let playTimer = null;

function newLevel(seed = Date.now()) {
  currentLevel = generateLevel({ ...DIFFICULTY_PRESETS[difficultySelect.value], seed });
  canvas.width = currentLevel.grid[0].length * DEFAULT_TILE_SIZE;
  canvas.height = currentLevel.grid.length * DEFAULT_TILE_SIZE;
  history = new MoveHistory(createGameState(currentLevel));
  clearSolution();
  render();
}

function resetLevel() {
  history.reset(createGameState(currentLevel));
  clearSolution();
  render();
}

function clearSolution() {
  stopPlayback();
  solution = null;
  solutionIndex = 0;
}

function stopPlayback() {
  clearInterval(playTimer);
  playTimer = null;
  solvePlayButton.textContent = 'Play';
}

function render() {
  drawState(ctx, history.state);
  moveCounter.textContent = `Moves: ${history.state.moves}`;
  undoButton.disabled = !history.canUndo();
  statusLine.textContent = isWon(history.state) ? 'Solved! 🎉' : '';

  const hasSolution = Boolean(solution);
  const solutionExhausted = hasSolution && solutionIndex >= solution.length;
  solveStepButton.disabled = !hasSolution || solutionExhausted;
  solvePlayButton.disabled = !hasSolution || solutionExhausted;
}

function tryMove(direction) {
  if (!direction || isWon(history.state)) {
    return;
  }
  if (history.move(direction)) {
    clearSolution();
    render();
  }
}

function stepSolution() {
  if (!solution || solutionIndex >= solution.length) {
    stopPlayback();
    return;
  }
  history.move(solution[solutionIndex]);
  solutionIndex += 1;
  render();
  if (solutionIndex >= solution.length) {
    stopPlayback();
  }
}

solveButton.addEventListener('click', () => {
  const { grid, player, boxes } = history.state;
  const cellCount = grid.length * grid[0].length;
  const solve = cellCount <= BFS_CELL_THRESHOLD ? bfsSolve : aStarSolve;
  const path = solve(grid, player, boxes);

  if (!path) {
    statusLine.textContent = 'No solution found from the current position.';
    return;
  }
  solution = path;
  solutionIndex = 0;
  render();
});

solveStepButton.addEventListener('click', stepSolution);

solvePlayButton.addEventListener('click', () => {
  if (playTimer) {
    stopPlayback();
    return;
  }
  solvePlayButton.textContent = 'Pause';
  playTimer = setInterval(stepSolution, Number(solveSpeedInput.value));
});

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
