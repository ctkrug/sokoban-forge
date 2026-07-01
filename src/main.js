import { DIFFICULTY_PRESETS, generateLevel } from './game/generator.js';
import { MoveHistory } from './game/history.js';
import { countBoxesOnTarget, createGameState, findTargets, isWon } from './game/state.js';
import { DEFAULT_TILE_SIZE, drawState } from './game/renderer.js';
import { aStarSolve, bfsSolve } from './game/solver.js';
import { decodeShareParams, encodeShareParams, parseSeed } from './game/share.js';

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
const redoButton = document.getElementById('redo');
const moveCounter = document.getElementById('move-counter');
const targetCounter = document.getElementById('target-counter');
const statusLine = document.getElementById('status');
const solveButton = document.getElementById('solve');
const solveStepButton = document.getElementById('solve-step');
const solvePlayButton = document.getElementById('solve-play');
const solveSpeedInput = document.getElementById('solve-speed');
const shareButton = document.getElementById('share');

// Keys are lowercase because the lookup below lowercases event.key first
// (see the keydown listener for why).
const KEY_TO_DIRECTION = {
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
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

  const query = encodeShareParams({ difficulty: difficultySelect.value, seed });
  window.history.replaceState(null, '', query);

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
  solvePlayButton.setAttribute('aria-pressed', 'false');
}

function render() {
  drawState(ctx, history.state);
  moveCounter.textContent = `Moves: ${history.state.moves}`;
  targetCounter.textContent = `Boxes on target: ${countBoxesOnTarget(history.state)}/${findTargets(history.state.grid).length}`;
  undoButton.disabled = !history.canUndo();
  redoButton.disabled = !history.canRedo();
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
  // Without this, re-solving while a previous solution is auto-playing swaps
  // the plan being stepped through mid-flight without the Play button ever
  // reflecting that a *new* solve happened - stop and let the player
  // explicitly press Play again on the fresh solution instead.
  stopPlayback();

  const { grid, player, boxes } = history.state;
  const cellCount = grid.length * grid[0].length;
  const usingBfs = cellCount <= BFS_CELL_THRESHOLD;
  const path = (usingBfs ? bfsSolve : aStarSolve)(grid, player, boxes);

  if (!path) {
    statusLine.textContent = 'No solution found from the current position.';
    return;
  }
  solution = path;
  solutionIndex = 0;
  render();
  // After render(), which already set statusLine from isWon() - a fresh
  // solve is never itself a win, so this can't be clobbered by it. Naming
  // the algorithm makes the BFS/A* switch (the game's actual selling
  // point) visible in the UI, not just in the README.
  const algorithm = usingBfs ? 'BFS' : 'A*';
  statusLine.textContent =
    path.length === 0
      ? 'Already solved!'
      : `Solution found via ${algorithm}: ${path.length} move${path.length === 1 ? '' : 's'}.`;
});

solveStepButton.addEventListener('click', stepSolution);

// The slider's raw value is milliseconds between steps, i.e. a delay - but
// it's labeled "Speed", so dragging it higher should play faster, not
// slower. Invert it around its own min/max so a higher value always means a
// shorter interval.
function playbackIntervalMs() {
  const min = Number(solveSpeedInput.min);
  const max = Number(solveSpeedInput.max);
  return min + max - Number(solveSpeedInput.value);
}

solvePlayButton.addEventListener('click', () => {
  if (playTimer) {
    stopPlayback();
    return;
  }
  solvePlayButton.textContent = 'Pause';
  solvePlayButton.setAttribute('aria-pressed', 'true');
  playTimer = setInterval(stepSolution, playbackIntervalMs());
});

// Without this, dragging the slider mid-playback has no visible effect until
// Pause/Play is toggled - the running interval keeps firing at whatever rate
// it was created with, even though the label reads "Speed" (implying live
// control) rather than "Speed for the next play".
solveSpeedInput.addEventListener('input', () => {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = setInterval(stepSolution, playbackIntervalMs());
  }
});

const FORM_CONTROL_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && playTimer) {
    stopPlayback();
    render();
    return;
  }
  // Skip while a form control has focus: the difficulty <select> and the
  // speed <input type="range"> both use arrow keys natively, and hijacking
  // them here would move the player instead of adjusting the control. This
  // also protects the native type-ahead behavior of <select> (pressing "r"
  // jumps to the option starting with "r") from being swallowed by Reset.
  if (FORM_CONTROL_TAGS.has(event.target.tagName)) {
    return;
  }
  if (event.key.toLowerCase() === 'r') {
    resetLevel();
    return;
  }
  // Z/Y mirror the Undo/Redo buttons, the same shortcut pairing used by most
  // desktop editors - lowercased for the same Caps-Lock/Shift reason as R.
  if (event.key.toLowerCase() === 'z') {
    undoMove();
    return;
  }
  if (event.key.toLowerCase() === 'y') {
    redoMove();
    return;
  }
  // Lowercased so Caps Lock or a Shift-held keypress (which reports "W",
  // not "w") still maps to the WASD entries below; the Arrow* keys are
  // unaffected since they have no case to begin with.
  const direction = KEY_TO_DIRECTION[event.key.toLowerCase()];
  if (!direction) {
    return;
  }
  // Otherwise ArrowUp/Down/Left/Right scroll the page underneath the canvas.
  event.preventDefault();
  tryMove(direction);
});

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
function undoMove() {
  if (history.undo()) {
    // Without this, a stale solution/autoplay from before the undo would
    // keep stepping through moves computed for a board state that no
    // longer exists.
    clearSolution();
    render();
  }
}

function redoMove() {
  if (history.redo()) {
    // Same reasoning as undo: redo also lands on a board a stale solution
    // wasn't computed for.
    clearSolution();
    render();
  }
}

undoButton.addEventListener('click', undoMove);
redoButton.addEventListener('click', redoMove);

shareButton.addEventListener('click', () => {
  if (!navigator.clipboard) {
    // Non-secure context (plain http) or an older browser: no Clipboard API
    // to call, so fall back straight to showing the link.
    statusLine.textContent = window.location.href;
    return;
  }
  navigator.clipboard
    .writeText(window.location.href)
    .then(() => {
      statusLine.textContent = 'Link copied!';
    })
    .catch(() => {
      statusLine.textContent = window.location.href;
    });
});

const shared = decodeShareParams(window.location.search);
// `in` also matches inherited Object.prototype keys (constructor, toString,
// ...), so a crafted URL like ?difficulty=constructor would pass this check
// and hand generateLevel a function instead of a preset, crashing on load.
const hasSharedDifficulty =
  shared && Object.prototype.hasOwnProperty.call(DIFFICULTY_PRESETS, shared.difficulty);
if (hasSharedDifficulty) {
  difficultySelect.value = shared.difficulty;
  newLevel(parseSeed(shared.seed));
} else {
  newLevel();
}
