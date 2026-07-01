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
    <span id="target-counter">Boxes on target: 0/0</span>
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

  it('loads a level from a crafted URL with a non-numeric extreme seed', async () => {
    // parseSeed('Infinity') -> Number('Infinity') = Infinity, a "numeric"
    // seed that isn't NaN, so it's handed straight to createRng instead of
    // being treated as a string seed. mulberry32 coerces it with `>>> 0`,
    // which maps Infinity to 0 rather than throwing - confirm that holds
    // all the way through a real page load, not just at the rng layer.
    window.history.replaceState(null, '', '?difficulty=hard&seed=Infinity');

    await expect(importMain()).resolves.toBeTruthy();

    expect(document.getElementById('move-counter').textContent).toBe('Moves: 0');
    expect(document.getElementById('target-counter').textContent).toMatch(/^Boxes on target: [0-2]\/3$/);
  });

  it('loads a shared level whose seed is literally 0', async () => {
    // newLevel(seed = Date.now()) only falls back to Date.now() when called
    // with no argument at all - JS default parameters trigger on `undefined`,
    // not on falsy values. seed=0 is exactly the case that would break if
    // that call were ever changed to something like `newLevel(seed || ...)`,
    // so lock in that a literal 0 seed is honored rather than replaced.
    window.history.replaceState(null, '', '?difficulty=easy&seed=0');
    await importMain();

    expect(window.location.search).toBe('?difficulty=easy&seed=0');

    setUpDom();
    window.history.replaceState(null, '', '?difficulty=easy&seed=0');
    await importMain();

    expect(window.location.search).toBe('?difficulty=easy&seed=0');
  });

  it('reproduces the same level from a crafted URL with a fractional seed', async () => {
    // parseSeed('3.5') -> Number('3.5') = 3.5, a "numeric" seed that isn't
    // NaN, so it reaches mulberry32 as a float rather than a string seed.
    // mulberry32 coerces it with `>>> 0`, which truncates to 3 rather than
    // throwing - still deterministic, just confirm the whole URL -> level
    // path reproduces identically across two loads of the same link.
    window.history.replaceState(null, '', '?difficulty=easy&seed=3.5');
    await importMain();
    document.getElementById('solve').click();
    const firstSolveStatus = document.getElementById('status').textContent;
    expect(firstSolveStatus).toMatch(/^Solution found via BFS: \d+ moves?\.$/);

    setUpDom();
    window.history.replaceState(null, '', '?difficulty=easy&seed=3.5');
    await importMain();
    document.getElementById('solve').click();

    expect(document.getElementById('status').textContent).toBe(firstSolveStatus);
  });

  it('reproduces the same level from a crafted URL with a URL-reserved string seed', async () => {
    // A non-numeric seed containing characters like & and = is exactly the
    // case test/share.test.js pins at the encode/decode-function level - this
    // confirms the same round-trip holds through an actual page load, not
    // just the pure functions in isolation.
    const seed = encodeURIComponent('a&b=c d');
    window.history.replaceState(null, '', `?difficulty=easy&seed=${seed}`);
    await importMain();
    document.getElementById('solve').click();
    const firstSolveStatus = document.getElementById('status').textContent;
    expect(firstSolveStatus).toMatch(/^Solution found via BFS: \d+ moves?\.$/);

    setUpDom();
    window.history.replaceState(null, '', `?difficulty=easy&seed=${seed}`);
    await importMain();
    document.getElementById('solve').click();

    expect(document.getElementById('status').textContent).toBe(firstSolveStatus);
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

  it('still moves the player on an arrow key while a <button> has focus', async () => {
    // BUTTON is deliberately not in FORM_CONTROL_TAGS: buttons don't use
    // arrow keys natively, and clicking any button (New level, Reset, ...)
    // is exactly what leaves one focused right before the player's next
    // keypress in normal play - if this regressed to blocking movement too,
    // it'd be very easy to hit and easy to miss in manual testing.
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    const newLevelButton = document.getElementById('new-level');
    newLevelButton.focus();
    newLevelButton.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

    expect(document.getElementById('move-counter').textContent).toBe('Moves: 1');
  });

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

  it('does not move the player on a tap of the player\'s own tile', async () => {
    // A click on (px, py) itself matches none of the four directional
    // branches (each requires an offset of exactly ±1 on one axis) - a
    // distinct case from a tap that's merely far away, since tapping your
    // own token is a realistic stray/double tap rather than a wild miss.
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    const canvas = document.getElementById('game-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: canvas.width, height: canvas.height });

    // Player starts at (5, 5); tile (5, 5) itself is 220,220 at a 40px tile.
    canvas.dispatchEvent(new window.MouseEvent('click', { clientX: 220, clientY: 220 }));

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

  it('stops an in-progress auto-play when Reset is clicked', async () => {
    // Same underlying risk as New level/difficulty change: resetLevel()
    // reassigns `history` back to the level's start, so a stale solution
    // still being auto-played must be cleared rather than kept stepping.
    vi.useFakeTimers();
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    document.getElementById('solve').click();
    document.getElementById('solve-play').click();
    expect(document.getElementById('solve-play').textContent).toBe('Pause');

    document.getElementById('reset').click();

    expect(document.getElementById('solve-play').textContent).toBe('Play');
    const movesAfterReset = document.getElementById('move-counter').textContent;
    await vi.advanceTimersByTimeAsync(1000);
    expect(document.getElementById('move-counter').textContent).toBe(movesAfterReset);

    vi.useRealTimers();
  });

  it('resets the level on the "r" key, same as clicking Reset', async () => {
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    makeAnyLegalMove();
    expect(document.getElementById('move-counter').textContent).toBe('Moves: 1');

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'r' }));

    expect(document.getElementById('move-counter').textContent).toBe('Moves: 0');
    expect(window.location.search).toBe('?difficulty=easy&seed=11');
  });

  it('resets on an uppercase "R" too (Caps Lock/Shift held)', async () => {
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    makeAnyLegalMove();
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'R' }));

    expect(document.getElementById('move-counter').textContent).toBe('Moves: 0');
  });

  it('undoes on the "z" key and redoes on the "y" key, same as their buttons', async () => {
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    makeAnyLegalMove();
    expect(document.getElementById('move-counter').textContent).toBe('Moves: 1');

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'z' }));
    expect(document.getElementById('move-counter').textContent).toBe('Moves: 0');

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'y' }));
    expect(document.getElementById('move-counter').textContent).toBe('Moves: 1');
  });

  it('undoes on an uppercase "Z" and redoes on an uppercase "Y" (Caps Lock/Shift held)', async () => {
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    makeAnyLegalMove();
    expect(document.getElementById('move-counter').textContent).toBe('Moves: 1');

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Z' }));
    expect(document.getElementById('move-counter').textContent).toBe('Moves: 0');

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Y' }));
    expect(document.getElementById('move-counter').textContent).toBe('Moves: 1');
  });

  it('ignores the "z"/"y" keys while a form control has focus', async () => {
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    makeAnyLegalMove();
    const difficultySelect = document.getElementById('difficulty');
    difficultySelect.focus();
    difficultySelect.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'z', bubbles: true }));

    expect(document.getElementById('move-counter').textContent).toBe('Moves: 1');
  });

  it('ignores the "r" key while a form control has focus', async () => {
    // Otherwise typing "r" to jump the native <select>'s type-ahead to a
    // difficulty option would also blow away the player's progress.
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    makeAnyLegalMove();
    const difficultySelect = document.getElementById('difficulty');
    difficultySelect.focus();
    difficultySelect.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'r', bubbles: true }));

    expect(document.getElementById('move-counter').textContent).toBe('Moves: 1');
  });

  it('generates a fresh level and resets the move counter on New level', async () => {
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    makeAnyLegalMove();

    document.getElementById('new-level').click();

    expect(document.getElementById('move-counter').textContent).toBe('Moves: 0');
    expect(document.getElementById('undo').disabled).toBe(true);
  });

  it('stops an in-progress auto-play when New level is clicked', async () => {
    // Regression risk: newLevel() reassigns `history` to a fresh
    // MoveHistory for the new board, but the old `solution` array (a list
    // of directions computed against the *previous* board) would otherwise
    // keep being stepped through by the running interval and applied to
    // the wrong level entirely.
    vi.useFakeTimers();
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    document.getElementById('solve').click();
    document.getElementById('solve-play').click();
    expect(document.getElementById('solve-play').textContent).toBe('Pause');

    document.getElementById('new-level').click();

    expect(document.getElementById('solve-play').textContent).toBe('Play');
    const movesAfterNewLevel = document.getElementById('move-counter').textContent;
    await vi.advanceTimersByTimeAsync(1000);
    expect(document.getElementById('move-counter').textContent).toBe(movesAfterNewLevel);

    vi.useRealTimers();
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

  it('stops an in-progress auto-play when the difficulty is changed', async () => {
    // Same risk as New level: a difficulty change also routes through
    // newLevel(), reassigning `history` while a stale solution/interval
    // from the old board could otherwise keep running against it.
    vi.useFakeTimers();
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    document.getElementById('solve').click();
    document.getElementById('solve-play').click();
    expect(document.getElementById('solve-play').textContent).toBe('Pause');

    const difficultySelect = document.getElementById('difficulty');
    difficultySelect.value = 'hard';
    difficultySelect.dispatchEvent(new window.Event('change'));

    expect(document.getElementById('solve-play').textContent).toBe('Play');
    const movesAfterChange = document.getElementById('move-counter').textContent;
    await vi.advanceTimersByTimeAsync(1000);
    expect(document.getElementById('move-counter').textContent).toBe(movesAfterChange);

    vi.useRealTimers();
  });

  it('reproduces the exact same level after reloading a shared link', async () => {
    // The whole point of "Copy link" (README: "Level sharing") is that
    // reopening the URL regenerates the identical board. generateLevel's
    // own determinism is covered at the unit level elsewhere - this checks
    // it end-to-end through the URL -> main.js -> UI path, which a bug in
    // the query decoding/re-encoding around it wouldn't otherwise catch.
    window.history.replaceState(null, '', '?difficulty=medium&seed=7');
    await importMain();

    document.getElementById('solve').click();
    const firstSolveStatus = document.getElementById('status').textContent;
    const firstTargetCounter = document.getElementById('target-counter').textContent;
    expect(firstSolveStatus).toMatch(/^Solution found via A\*: \d+ moves?\.$/);

    // Simulate reopening the copied link in a fresh tab/session.
    setUpDom();
    window.history.replaceState(null, '', '?difficulty=medium&seed=7');
    await importMain();

    expect(document.getElementById('target-counter').textContent).toBe(firstTargetCounter);
    document.getElementById('solve').click();
    expect(document.getElementById('status').textContent).toBe(firstSolveStatus);
  });

  it('solves a board above the BFS cell threshold via aStarSolve', async () => {
    // The hard preset is 9x9 = 81 cells, above BFS_CELL_THRESHOLD (49), so
    // this is the only path in main.js that actually exercises aStarSolve -
    // every other Solve test here uses the easy preset, which stays on BFS.
    window.history.replaceState(null, '', '?difficulty=hard&seed=1');
    await importMain();

    document.getElementById('solve').click();

    expect(document.getElementById('solve-step').disabled).toBe(false);
    expect(document.getElementById('status').textContent).toMatch(/^Solution found via A\*: \d+ moves?\.$/);
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

  it('is a no-op to force another step after the solution is already exhausted', async () => {
    // stepSolution()'s guard is `!solution || solutionIndex >= solution.length`
    // - the "no solution" test above only exercises the first half (solution
    // is null); this is the other half, reachable only once a real solution
    // has already been fully stepped through and the button force-re-enabled.
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    document.getElementById('solve').click();
    const solveStep = document.getElementById('solve-step');
    while (!solveStep.disabled) {
      solveStep.click();
    }
    const movesAtWin = document.getElementById('move-counter').textContent;
    solveStep.disabled = false;

    expect(() => solveStep.click()).not.toThrow();
    expect(document.getElementById('move-counter').textContent).toBe(movesAtWin);
    expect(document.getElementById('status').textContent).toBe('Solved! 🎉');
  });

  it('ignores further keyboard moves once the board is won', async () => {
    // tryMove's `isWon(history.state)` guard is otherwise never exercised -
    // every other movement test plays on an unsolved board. Without it, a
    // player could keep pushing the box(es) around a "solved" board, which
    // would desync the visible "Solved!" status from the board underneath.
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    document.getElementById('solve').click();
    const solveStep = document.getElementById('solve-step');
    while (!solveStep.disabled) {
      solveStep.click();
    }
    expect(document.getElementById('status').textContent).toBe('Solved! 🎉');
    const movesAtWin = document.getElementById('move-counter').textContent;

    for (const key of DIRECTION_KEYS) {
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key }));
    }

    expect(document.getElementById('move-counter').textContent).toBe(movesAtWin);
    expect(document.getElementById('status').textContent).toBe('Solved! 🎉');
  });

  it('updates the boxes-on-target counter as the solver steps toward the win', async () => {
    // The easy preset always has exactly one box, so solving it fully must
    // walk the counter from 0/1 to 1/1.
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    const targetCounter = document.getElementById('target-counter');
    expect(targetCounter.textContent).toBe('Boxes on target: 0/1');

    document.getElementById('solve').click();
    const solveStep = document.getElementById('solve-step');
    while (!solveStep.disabled) {
      solveStep.click();
    }

    expect(targetCounter.textContent).toBe('Boxes on target: 1/1');
  });

  it('auto-plays a found solution through to completion', async () => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    document.getElementById('solve').click();
    const solvePlay = document.getElementById('solve-play');

    solvePlay.click();
    expect(solvePlay.textContent).toBe('Pause');
    expect(solvePlay.getAttribute('aria-pressed')).toBe('true');

    await vi.runAllTimersAsync();

    expect(document.getElementById('status').textContent).toBe('Solved! 🎉');
    expect(solvePlay.textContent).toBe('Play');
    expect(solvePlay.getAttribute('aria-pressed')).toBe('false');
    expect(solvePlay.disabled).toBe(true);

    vi.useRealTimers();
  });

  it('stops an in-progress auto-play when Solve is clicked again', async () => {
    // Regression: re-solving mid-playback used to swap the solution/index
    // being stepped through without ever stopping the running interval, so
    // the "Pause" label kept describing playback the click didn't ask for.
    vi.useFakeTimers();
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    document.getElementById('solve').click();
    document.getElementById('solve-play').click();
    expect(document.getElementById('solve-play').textContent).toBe('Pause');

    document.getElementById('solve').click();

    expect(document.getElementById('solve-play').textContent).toBe('Play');
    const movesAfterResolve = document.getElementById('move-counter').textContent;
    await vi.advanceTimersByTimeAsync(1000);
    expect(document.getElementById('move-counter').textContent).toBe(movesAfterResolve);

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

  it('updates a running interval live when the speed slider changes mid-playback', async () => {
    // Regression: the running setInterval was created once with whatever
    // rate the slider read at Play-click time and never re-read it, so
    // dragging the slider mid-playback silently did nothing until the user
    // toggled Pause/Play to pick up the new value.
    vi.useFakeTimers();
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    const speedInput = document.getElementById('solve-speed');
    document.getElementById('solve').click();
    speedInput.value = speedInput.min; // slowest: inverts to a 600ms interval
    document.getElementById('solve-play').click();

    await vi.advanceTimersByTimeAsync(100);
    expect(document.getElementById('move-counter').textContent).toBe('Moves: 0');

    speedInput.value = speedInput.max; // fastest: inverts to a 60ms interval
    speedInput.dispatchEvent(new window.Event('input'));

    await vi.advanceTimersByTimeAsync(100);
    expect(document.getElementById('move-counter').textContent).toBe('Moves: 1');

    vi.useRealTimers();
  });

  it('leaves nothing running for the speed slider to restart once playback is not active', async () => {
    // The live-update listener above only makes sense while playTimer is
    // set; dragging the slider before Play (or after it naturally finishes)
    // must be a no-op rather than starting playback as a side effect.
    vi.useFakeTimers();
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    const speedInput = document.getElementById('solve-speed');
    document.getElementById('solve').click();
    speedInput.value = speedInput.max;
    speedInput.dispatchEvent(new window.Event('input'));

    await vi.advanceTimersByTimeAsync(200);

    expect(document.getElementById('move-counter').textContent).toBe('Moves: 0');
    expect(document.getElementById('solve-play').textContent).toBe('Play');

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
    expect(solvePlay.getAttribute('aria-pressed')).toBe('false');
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
    expect(solvePlay.getAttribute('aria-pressed')).toBe('false');
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

    expect(document.getElementById('status').textContent).toMatch(/^Solution found via BFS: \d+ moves?\.$/);
  });

  it('uses singular "move" for a one-move solution', async () => {
    // Seed 1 on the easy preset is a known one-move solve, the only way to
    // reach the `path.length === 1` branch of the pluralization ternary.
    window.history.replaceState(null, '', '?difficulty=easy&seed=1');
    await importMain();

    document.getElementById('solve').click();

    expect(document.getElementById('status').textContent).toBe('Solution found via BFS: 1 move.');
  });

  it('reports "Already solved!" when solving a board that is already won', async () => {
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');
    await importMain();

    document.getElementById('solve').click();
    const solveStep = document.getElementById('solve-step');
    while (!solveStep.disabled) {
      solveStep.click();
    }
    expect(document.getElementById('status').textContent).toBe('Solved! 🎉');

    document.getElementById('solve').click();

    expect(document.getElementById('status').textContent).toBe('Already solved!');
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
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    window.history.replaceState(null, '', '?difficulty=easy&seed=11');

    await importMain();
    document.getElementById('share').click();
    await Promise.resolve().then(() => {});
    await Promise.resolve().then(() => {});

    // Not just that *a* write succeeded - that the actual current page URL
    // was what got copied, not a stale or empty string.
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(document.getElementById('status').textContent).toBe('Link copied!');
  });
});
