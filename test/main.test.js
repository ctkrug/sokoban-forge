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

  it.each(['undo', 'redo'])(
    'is a no-op to click %s with an empty history/future stack, even if invoked directly',
    async (buttonId) => {
      // Both buttons start (and normally stay) disabled until there's
      // something to undo/redo, so MoveHistory#undo/#redo returning false is
      // only reachable by forcing a click past that disabled state.
      await importMain();

      const moveCounter = document.getElementById('move-counter').textContent;
      const button = document.getElementById(buttonId);
      expect(button.disabled).toBe(true);
      button.disabled = false;

      expect(() => button.click()).not.toThrow();
      expect(document.getElementById('move-counter').textContent).toBe(moveCounter);
    },
  );

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

  it('ignores an inherited Object.prototype key as a shared difficulty', async () => {
    // Regression: `shared.difficulty in DIFFICULTY_PRESETS` also matches
    // inherited keys like "constructor" or "toString", handing generateLevel
    // a function instead of a preset and crashing on load.
    window.history.replaceState(null, '', '?difficulty=constructor&seed=1');

    await expect(importMain()).resolves.toBeTruthy();

    expect(document.getElementById('difficulty').value).toBe('easy');
    expect(document.getElementById('move-counter').textContent).toBe('Moves: 0');
  });

  it('falls back to showing the link when the Clipboard API is unavailable', async () => {
    Object.defineProperty(window.navigator, 'clipboard', { value: undefined, configurable: true });

    await importMain();

    expect(() => document.getElementById('share').click()).not.toThrow();
    expect(document.getElementById('status').textContent).toBe(window.location.href);
  });

  it.each(['solve-speed', 'difficulty'])(
    'ignores arrow keys while #%s has focus',
    async (elementId) => {
      // Regression: the game's window-level keydown listener used to fire
      // regardless of focus, so arrow keys aimed at the speed slider or the
      // difficulty dropdown also moved the player underneath it.
      await importMain();

      // Dispatched on the focused element (not window) so it bubbles with
      // target set to that element, matching how a real keypress reaches the
      // window-level listener.
      const control = document.getElementById(elementId);
      control.focus();
      control.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

      expect(document.getElementById('move-counter').textContent).toBe('Moves: 0');
    },
  );

  it('ignores keys that are not a movement key', async () => {
    await importMain();

    const event = new window.KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    window.dispatchEvent(event);

    expect(document.getElementById('move-counter').textContent).toBe('Moves: 0');
    expect(event.defaultPrevented).toBe(false);
  });

  it('preventDefaults arrow keys so they do not scroll the page', async () => {
    await importMain();

    const event = new window.KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('moves the player on an uppercase WASD key (Caps Lock/Shift held)', async () => {
    // Regression: KEY_TO_DIRECTION only had lowercase w/a/s/d entries, so a
    // keydown reporting "W" (Caps Lock on, or Shift held) silently did
    // nothing even though the intent was clearly to move up.
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'W' }));

    expect(document.getElementById('move-counter').textContent).toBe('Moves: 1');
  });

  it('moves the player on a tap/click of an adjacent tile', async () => {
    // Fixed seed known to start the player at (5, 5) on the easy preset, so
    // a click on tile (5, 4) is a deterministic "tap above the player".
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    const canvas = document.getElementById('game-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: canvas.width, height: canvas.height });

    canvas.dispatchEvent(new window.MouseEvent('click', { clientX: 220, clientY: 180 }));

    expect(document.getElementById('move-counter').textContent).toBe('Moves: 1');
  });

  it.each([
    ['down', 140, 220],
    ['left', 100, 180],
    ['right', 180, 180],
  ])('moves the player %s on a tap of the tile in that direction', async (_direction, clientX, clientY) => {
    // Fixed seed known to start the player at (3, 4) with all four
    // orthogonal neighbors open, so each click deterministically exercises
    // one branch of the four-way tap-direction check.
    window.history.replaceState(null, '', '?difficulty=easy&seed=1');
    await importMain();

    const canvas = document.getElementById('game-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: canvas.width, height: canvas.height });

    canvas.dispatchEvent(new window.MouseEvent('click', { clientX, clientY }));

    expect(document.getElementById('move-counter').textContent).toBe('Moves: 1');
  });

  it('does not move the player on a tap that is not orthogonally adjacent', async () => {
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    const canvas = document.getElementById('game-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: canvas.width, height: canvas.height });

    // Tile (0, 0): a wall, and nowhere near the player at (5, 5).
    canvas.dispatchEvent(new window.MouseEvent('click', { clientX: 20, clientY: 20 }));

    expect(document.getElementById('move-counter').textContent).toBe('Moves: 0');
  });

  it('resets the move counter but keeps the same level on Reset', async () => {
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    makeAnyLegalMove();
    expect(document.getElementById('move-counter').textContent).toBe('Moves: 1');

    document.getElementById('reset').click();

    expect(document.getElementById('move-counter').textContent).toBe('Moves: 0');
    expect(window.location.search).toBe('?difficulty=easy&seed=11');
  });

  it('generates a fresh level and resets the move counter on New level', async () => {
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    makeAnyLegalMove();

    document.getElementById('new-level').click();

    expect(document.getElementById('move-counter').textContent).toBe('Moves: 0');
    expect(document.getElementById('undo').disabled).toBe(true);
  });

  it('regenerates the level at the new size when the difficulty changes', async () => {
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    const difficultySelect = document.getElementById('difficulty');
    difficultySelect.value = 'hard';
    difficultySelect.dispatchEvent(new window.Event('change'));

    // hard preset is a 9x9 grid at the renderer's 40px tile size.
    expect(document.getElementById('game-canvas').width).toBe(360);
    expect(window.location.search).toContain('difficulty=hard');
  });

  it('solves a board above the BFS cell threshold via aStarSolve', async () => {
    // The hard preset is 9x9 = 81 cells, above BFS_CELL_THRESHOLD (49), so
    // this is the only path in main.js that actually exercises aStarSolve -
    // every other Solve test here uses the easy preset, which stays on BFS.
    window.history.replaceState(null, '', '?difficulty=hard&seed=1');
    await importMain();

    document.getElementById('solve').click();

    expect(document.getElementById('solve-step').disabled).toBe(false);
    expect(document.getElementById('status').textContent).toMatch(/^Solution found: \d+ moves?\.$/);
  });

  it('is a no-op to step when there is no solution, even if invoked directly', async () => {
    // The Step button starts (and normally stays) disabled without a
    // solution, so this guard is never reachable through a real click - it
    // exists purely so a future change that forgets to keep the disabled
    // state in sync can't step through a non-existent solution and crash.
    await importMain();

    const solveStep = document.getElementById('solve-step');
    expect(solveStep.disabled).toBe(true);
    solveStep.disabled = false;

    expect(() => solveStep.click()).not.toThrow();
    expect(document.getElementById('move-counter').textContent).toBe('Moves: 0');
  });

  it('steps through a found solution one move at a time until solved', async () => {
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    document.getElementById('solve').click();
    const solveStep = document.getElementById('solve-step');
    const moveCounter = document.getElementById('move-counter');

    let previousMoves = moveCounter.textContent;
    while (!solveStep.disabled) {
      solveStep.click();
      expect(moveCounter.textContent).not.toBe(previousMoves);
      previousMoves = moveCounter.textContent;
    }

    expect(document.getElementById('status').textContent).toBe('Solved! 🎉');
  });

  it('auto-plays a found solution through to completion', async () => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    document.getElementById('solve').click();
    const solvePlay = document.getElementById('solve-play');

    solvePlay.click();
    expect(solvePlay.textContent).toBe('Pause');

    await vi.runAllTimersAsync();

    expect(document.getElementById('status').textContent).toBe('Solved! 🎉');
    expect(solvePlay.textContent).toBe('Play');
    expect(solvePlay.disabled).toBe(true);

    vi.useRealTimers();
  });

  it('plays faster when the speed slider is set higher', async () => {
    // Regression: the slider's raw value is the millisecond delay between
    // steps, so wiring it straight into setInterval meant dragging "Speed"
    // up actually made playback slower, not faster.
    vi.useFakeTimers();
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    document.getElementById('solve').click();
    document.getElementById('solve-speed').value = document.getElementById('solve-speed').max;
    document.getElementById('solve-play').click();

    // Max slider value must invert to the shortest interval (the slider's
    // own min), so a single step fires well before the slider's raw value
    // (600ms) would have.
    await vi.advanceTimersByTimeAsync(100);

    expect(document.getElementById('move-counter').textContent).toBe('Moves: 1');

    vi.useRealTimers();
  });

  it('pauses an in-progress auto-play when clicked again', async () => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    document.getElementById('solve').click();
    const solvePlay = document.getElementById('solve-play');

    solvePlay.click();
    solvePlay.click();

    expect(solvePlay.textContent).toBe('Play');
    const movesWhilePaused = document.getElementById('move-counter').textContent;
    await vi.advanceTimersByTimeAsync(1000);
    expect(document.getElementById('move-counter').textContent).toBe(movesWhilePaused);

    vi.useRealTimers();
  });

  it('stops an in-progress auto-play on Escape', async () => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    document.getElementById('solve').click();
    const solvePlay = document.getElementById('solve-play');
    solvePlay.click();
    expect(solvePlay.textContent).toBe('Pause');

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));

    expect(solvePlay.textContent).toBe('Play');
    const movesAfterEscape = document.getElementById('move-counter').textContent;
    await vi.advanceTimersByTimeAsync(1000);
    expect(document.getElementById('move-counter').textContent).toBe(movesAfterEscape);

    vi.useRealTimers();
  });

  it('ignores Escape when auto-play is not running', async () => {
    await importMain();

    expect(() =>
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' })),
    ).not.toThrow();
  });

  it('reports the move count when a solution is found', async () => {
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    document.getElementById('solve').click();

    expect(document.getElementById('status').textContent).toMatch(/^Solution found: \d+ moves?\.$/);
  });

  it('uses singular "move" for a one-move solution', async () => {
    // Seed 1 on the easy preset is a known one-move solve, the only way to
    // reach the `path.length === 1` branch of the pluralization ternary.
    window.history.replaceState(null, '', '?difficulty=easy&seed=1');
    await importMain();

    document.getElementById('solve').click();

    expect(document.getElementById('status').textContent).toBe('Solution found: 1 move.');
  });

  it('reports when no solution exists from the current position', async () => {
    // Deadlocks the lone box against the left wall (x=1) - it can never be
    // pushed sideways again since that requires standing in the wall at
    // x=0, so the puzzle becomes permanently unsolvable from here on.
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    for (const key of ['ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft']) {
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key }));
    }

    document.getElementById('solve').click();

    expect(document.getElementById('status').textContent).toBe('No solution found from the current position.');
    expect(document.getElementById('solve-step').disabled).toBe(true);
  });

  it('falls back to showing the link when the clipboard write itself rejects', async () => {
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });

    await importMain();
    document.getElementById('share').click();
    await vi.waitFor(() => {
      expect(document.getElementById('status').textContent).toBe(window.location.href);
    });
  });

  it('reports a successful clipboard write', async () => {
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });

    await importMain();
    document.getElementById('share').click();
    await Promise.resolve().then(() => {});
    await Promise.resolve().then(() => {});

    expect(document.getElementById('status').textContent).toBe('Link copied!');
  });
});
