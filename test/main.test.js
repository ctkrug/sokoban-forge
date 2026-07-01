// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DIRECTION_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

function setUpDom() {
  document.body.innerHTML = `
    <select id="difficulty">
      <option value="easy" selected>Easy</option>
      <option value="medium">Medium</option>
      <option value="hard">Hard</option>
    </select>
    <button id="new-level" type="button">New level</button>
    <button id="reset" type="button">Reset</button>
    <button id="undo" type="button">Undo</button>
    <button id="redo" type="button">Redo</button>
    <button id="share" type="button">Copy link</button>
    <span id="move-counter">Moves: 0</span>
    <canvas id="game-canvas" width="280" height="280"></canvas>
    <button id="solve" type="button">Solve</button>
    <button id="solve-step" type="button" disabled>Step</button>
    <button id="solve-play" type="button" disabled>Play</button>
    <input id="solve-speed" type="range" min="60" max="600" step="20" value="250" />
    <p id="status"></p>
  `;

  // jsdom has no canvas backend; main.js only ever calls fillRect/sets
  // fillStyle on the context, so a minimal stub is enough to load it.
  HTMLCanvasElement.prototype.getContext = () => ({
    fillStyle: '',
    fillRect() {},
  });
}

/** Presses each arrow key until one actually moves the player, then stops. */
function makeAnyLegalMove() {
  const moveCounter = document.getElementById('move-counter');
  for (const key of DIRECTION_KEYS) {
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key }));
    if (moveCounter.textContent === 'Moves: 1') {
      return;
    }
  }
  throw new Error('no direction moved the player - level generation may have changed');
}

// vi.resetModules() only clears vitest's own mock registry - it doesn't
// bust the plain dynamic import() cache, so re-importing '../src/main.js'
// as-is would silently return the first test's already-initialized module
// (stale `history`, listeners bound to detached DOM nodes) on every
// subsequent test. A unique query string per import forces a fresh
// module instance, which re-runs main.js's top-level setup against the
// current test's fresh DOM.
let importCounter = 0;
function importMain() {
  importCounter += 1;
  return import(/* @vite-ignore */ `../src/main.js?test=${importCounter}`);
}

describe('main.js DOM wiring', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    setUpDom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clears a pending solution when the player undoes a move', async () => {
    // Fixed seed known to need multiple moves to solve (verified directly
    // against the generator/solver), so an arbitrary first move can't
    // coincidentally finish the puzzle and make "has a pending solution"
    // vacuously false before we ever get to test undo.
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    makeAnyLegalMove();

    document.getElementById('solve').click();
    const solveStep = document.getElementById('solve-step');
    const solvePlay = document.getElementById('solve-play');
    expect(solveStep.disabled).toBe(false);
    expect(solvePlay.disabled).toBe(false);

    document.getElementById('undo').click();

    // Regression: undo used to leave the stale solution/autoplay state
    // intact, so Step/Play kept referencing a board that no longer existed.
    expect(solveStep.disabled).toBe(true);
    expect(solvePlay.disabled).toBe(true);
  });

  it('redoes an undone move and re-disables once the redo stack is empty', async () => {
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    makeAnyLegalMove();
    const redo = document.getElementById('redo');
    expect(redo.disabled).toBe(true);

    document.getElementById('undo').click();
    expect(redo.disabled).toBe(false);
    expect(document.getElementById('move-counter').textContent).toBe('Moves: 0');

    redo.click();
    expect(document.getElementById('move-counter').textContent).toBe('Moves: 1');
    expect(redo.disabled).toBe(true);
  });

  it('clears a pending solution when the player redoes a move', async () => {
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    makeAnyLegalMove();
    document.getElementById('undo').click();

    document.getElementById('solve').click();
    const solveStep = document.getElementById('solve-step');
    expect(solveStep.disabled).toBe(false);

    document.getElementById('redo').click();

    expect(solveStep.disabled).toBe(true);
  });

  it('falls back to showing the link when the Clipboard API is unavailable', async () => {
    Object.defineProperty(window.navigator, 'clipboard', { value: undefined, configurable: true });

    await importMain();

    expect(() => document.getElementById('share').click()).not.toThrow();
    expect(document.getElementById('status').textContent).toBe(window.location.href);
  });

  it('ignores arrow keys while a form control has focus', async () => {
    // Regression: the game's window-level keydown listener used to fire
    // regardless of focus, so arrow keys aimed at the speed slider (or the
    // difficulty dropdown) also moved the player underneath it.
    await importMain();

    // Dispatched on the focused element (not window) so it bubbles with
    // target set to that element, matching how a real keypress reaches the
    // window-level listener.
    const speedInput = document.getElementById('solve-speed');
    speedInput.focus();
    speedInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

    expect(document.getElementById('move-counter').textContent).toBe('Moves: 0');
  });

  it('preventDefaults arrow keys so they do not scroll the page', async () => {
    await importMain();

    const event = new window.KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
