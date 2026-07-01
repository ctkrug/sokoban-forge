import { DIFFICULTY_PRESETS, generateLevel } from './game/generator.js';
import { MoveHistory } from './game/history.js';
import {
  DIRECTIONS,
  countBoxesOnTarget,
  createGameState,
  findTargets,
  isWon,
} from './game/state.js';
import { DEFAULT_TILE_SIZE, drawState } from './game/renderer.js';
import { aStarSolve, bfsSolve } from './game/solver.js';
import { decodeShareParams, encodeShareParams, parseSeed } from './game/share.js';
import { createAudio } from './game/audio.js';
import { BUMP_MS, MOVE_MS, POP_MS, bumpOffset, popScale, slidePosition } from './game/motion.js';
import { spawnConfetti, stepConfetti } from './game/confetti.js';
import { TILE } from './game/grid.js';

// Below this many reachable board cells, plain BFS explores the state
// space fast enough; larger boards switch to A* so the heuristic keeps
// the frontier small.
const BFS_CELL_THRESHOLD = 49;

// A pointer that travels at least this many CSS pixels between down and up
// is a swipe (one move in the dominant direction); anything shorter falls
// through to the tap-adjacent-tile handler.
const SWIPE_MIN_PX = 24;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const boardFrame = document.getElementById('board-frame');
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
const muteButton = document.getElementById('mute');
const winOverlay = document.getElementById('win-overlay');
const winMoves = document.getElementById('win-moves');
const winNextButton = document.getElementById('win-next');
const winReplayButton = document.getElementById('win-replay');

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

const audio = createAudio();

let history;
let currentLevel;
let solution = null;
let solutionIndex = 0;
let playTimer = null;
let tileSize = DEFAULT_TILE_SIZE; // backing-store pixels per tile (includes DPR)

// --- animation layer (visual only; game state is always synchronous) ------
let slideAnim = null; // { fromPlayer, fromBoxes, start }
let bumpAnim = null; // { direction, start }
let popAnims = []; // [{ boxIndex, start }]
let confetti = [];
let rafId = null;
let swipeStart = null;
let suppressNextClick = false;

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

function canAnimate() {
  return typeof window.requestAnimationFrame === 'function' && !prefersReducedMotion();
}

function animationsActive(now) {
  if (confetti.length > 0) {
    return true;
  }
  if (slideAnim && now - slideAnim.start < MOVE_MS) {
    return true;
  }
  if (bumpAnim && now - bumpAnim.start < BUMP_MS) {
    return true;
  }
  return popAnims.some((pop) => now - pop.start < POP_MS);
}

function startAnimationLoop() {
  if (!canAnimate() || rafId !== null) {
    return;
  }
  let last = performance.now();
  const tick = (now) => {
    const dt = Math.max(0, (now - last) / 1000);
    last = now;
    if (confetti.length > 0) {
      confetti = stepConfetti(confetti, dt);
    }
    render(now);
    if (animationsActive(now)) {
      rafId = window.requestAnimationFrame(tick);
    } else {
      rafId = null;
      slideAnim = null;
      bumpAnim = null;
      popAnims = [];
      render(now); // settle on the final static frame
    }
  };
  rafId = window.requestAnimationFrame(tick);
}

/**
 * Sizes the canvas to fill the board frame (docs/DESIGN.md: the board is the
 * hero, ≥60vh on desktop) and renders at devicePixelRatio for crisp tiles.
 * Falls back to DEFAULT_TILE_SIZE-based dimensions when layout hasn't
 * happened (first paint, non-visual test environments).
 */
function fitCanvas() {
  const cols = currentLevel.grid[0].length;
  const rows = currentLevel.grid.length;
  const availableWidth = boardFrame?.clientWidth
    ? boardFrame.clientWidth - 24
    : cols * DEFAULT_TILE_SIZE;
  const availableHeight = window.innerHeight
    ? Math.max(320, window.innerHeight * 0.62)
    : rows * DEFAULT_TILE_SIZE;
  const cssTile = Math.max(
    24,
    Math.min(Math.floor(availableWidth / cols), Math.floor(availableHeight / rows), 84),
  );
  const dpr = window.devicePixelRatio || 1;

  canvas.style.width = `${cols * cssTile}px`;
  canvas.style.height = `${rows * cssTile}px`;
  canvas.width = Math.round(cols * cssTile * dpr);
  canvas.height = Math.round(rows * cssTile * dpr);
  tileSize = canvas.width / cols;
}

function newLevel(seed = Date.now()) {
  currentLevel = generateLevel({ ...DIFFICULTY_PRESETS[difficultySelect.value], seed });
  history = new MoveHistory(createGameState(currentLevel));
  clearSolution();
  clearCelebration();
  fitCanvas();

  const query = encodeShareParams({ difficulty: difficultySelect.value, seed });
  window.history.replaceState(null, '', query);

  render();
}

function resetLevel() {
  history.reset(createGameState(currentLevel));
  clearSolution();
  clearCelebration();
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

function clearCelebration() {
  winOverlay.hidden = true;
  confetti = [];
}

function celebrateWin() {
  audio.play('win');
  winMoves.textContent = `All crates home in ${history.state.moves} move${
    history.state.moves === 1 ? '' : 's'
  }.`;
  winOverlay.hidden = false;
  if (canAnimate()) {
    confetti = spawnConfetti(currentLevel.grid[0].length);
    startAnimationLoop();
  }
}

function render(now = 0) {
  const state = history.state;
  const visual = { timeMs: now };

  if (slideAnim) {
    const elapsed = now - slideAnim.start;
    // fromBoxes is captured from the same level one move earlier, so it is
    // always parallel to state.boxes - no per-index existence check needed.
    visual.playerPos = slidePosition(slideAnim.fromPlayer, state.player, elapsed);
    visual.boxPositions = state.boxes.map((box, i) =>
      slidePosition(slideAnim.fromBoxes[i], box, elapsed),
    );
  }
  if (bumpAnim) {
    visual.bump = bumpOffset(DIRECTIONS[bumpAnim.direction], now - bumpAnim.start);
  }
  if (popAnims.length > 0) {
    visual.boxScales = state.boxes.map(() => 1);
    for (const pop of popAnims) {
      visual.boxScales[pop.boxIndex] = popScale(now - pop.start);
    }
  }
  if (confetti.length > 0) {
    visual.confetti = confetti;
  }

  drawState(ctx, state, tileSize, visual);
  moveCounter.textContent = `Moves: ${state.moves}`;
  targetCounter.textContent = `Boxes on target: ${countBoxesOnTarget(state)}/${findTargets(state.grid).length}`;
  undoButton.disabled = !history.canUndo();
  redoButton.disabled = !history.canRedo();
  statusLine.textContent = isWon(state) ? 'Solved! 🎉' : '';

  const hasSolution = Boolean(solution);
  const solutionExhausted = hasSolution && solutionIndex >= solution.length;
  solveStepButton.disabled = !hasSolution || solutionExhausted;
  solvePlayButton.disabled = !hasSolution || solutionExhausted;
}

/**
 * Applies one move to the game state and drives every piece of feedback the
 * design brief asks for: slide tween, push/step/bump sounds, the on-target
 * pop + chime, and the win celebration. Both player input and solver
 * playback route through here so they feel identical.
 */
function applyMove(direction) {
  const prev = history.state;
  const moved = history.move(direction);

  if (!moved) {
    audio.play('bump');
    if (canAnimate()) {
      bumpAnim = { direction, start: performance.now() };
      startAnimationLoop();
    }
    return false;
  }

  const state = history.state;
  const pushedIndex = state.boxes.findIndex(
    (box, i) => box.x !== prev.boxes[i].x || box.y !== prev.boxes[i].y,
  );
  const pushedOntoTarget =
    pushedIndex !== -1 &&
    state.grid[state.boxes[pushedIndex].y][state.boxes[pushedIndex].x] === TILE.TARGET;

  audio.play(pushedIndex !== -1 ? 'push' : 'step');
  if (pushedOntoTarget) {
    audio.play('target');
  }

  if (canAnimate()) {
    const start = performance.now();
    slideAnim = { fromPlayer: prev.player, fromBoxes: prev.boxes, start };
    if (pushedOntoTarget) {
      popAnims.push({ boxIndex: pushedIndex, start: start + MOVE_MS / 2 });
    }
    startAnimationLoop();
  }

  if (isWon(state)) {
    celebrateWin();
  }
  return true;
}

function tryMove(direction) {
  if (!direction || isWon(history.state)) {
    return;
  }
  if (applyMove(direction)) {
    clearSolution();
    render();
  }
}

function stepSolution() {
  if (!solution || solutionIndex >= solution.length) {
    stopPlayback();
    return;
  }
  applyMove(solution[solutionIndex]);
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
  // A swipe already moved the player on pointerup; the click that follows
  // the same gesture must not also count as a tap.
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  const cols = history.state.grid[0].length;
  const rows = history.state.grid.length;
  const rect = canvas.getBoundingClientRect();
  const tileX = Math.floor(((event.clientX - rect.left) / rect.width) * cols);
  const tileY = Math.floor(((event.clientY - rect.top) / rect.height) * rows);
  const { x: px, y: py } = history.state.player;

  if (tileX === px && tileY === py - 1) tryMove('up');
  else if (tileX === px && tileY === py + 1) tryMove('down');
  else if (tileY === py && tileX === px - 1) tryMove('left');
  else if (tileY === py && tileX === px + 1) tryMove('right');
});

// Swipe support (docs/DESIGN.md: "swipe anywhere on the board"): one move in
// the dominant axis of the gesture. Uses pointer events so mouse drags and
// touch swipes share one code path.
canvas.addEventListener('pointerdown', (event) => {
  swipeStart = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener('pointerup', (event) => {
  if (!swipeStart) {
    return;
  }
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_PX) {
    return; // a tap - the click handler owns it
  }
  suppressNextClick = true;
  if (Math.abs(dx) > Math.abs(dy)) {
    tryMove(dx > 0 ? 'right' : 'left');
  } else {
    tryMove(dy > 0 ? 'down' : 'up');
  }
});

difficultySelect.addEventListener('change', () => newLevel());
newLevelButton.addEventListener('click', () => newLevel());
resetButton.addEventListener('click', () => resetLevel());
winNextButton.addEventListener('click', () => newLevel());
winReplayButton.addEventListener('click', () => resetLevel());

function undoMove() {
  if (history.undo()) {
    // Without this, a stale solution/autoplay from before the undo would
    // keep stepping through moves computed for a board state that no
    // longer exists.
    clearSolution();
    clearCelebration();
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

function syncMuteButton() {
  muteButton.setAttribute('aria-pressed', String(audio.muted));
  muteButton.setAttribute('aria-label', audio.muted ? 'Unmute sound' : 'Mute sound');
  muteButton.textContent = audio.muted ? 'Sound off' : 'Sound on';
}

muteButton.addEventListener('click', () => {
  audio.toggleMuted();
  syncMuteButton();
});
syncMuteButton();

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

window.addEventListener('resize', () => {
  fitCanvas();
  render();
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
