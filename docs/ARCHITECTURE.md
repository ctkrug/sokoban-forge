# Architecture

A concise map of the codebase for whoever (human or agent) picks this up next. See
[`VISION.md`](VISION.md) for *why* it's built this way and [`BACKLOG.md`](BACKLOG.md) for
the story-level build history.

## Module map

```
src/
  game/
    grid.js       tile vocabulary (TILE.WALL/FLOOR/TARGET), createEmptyGrid, inBounds
    rng.js        mulberry32 (seeded PRNG) + xmur3 (string→seed hash) + createRng
    state.js      DIRECTIONS, move(), isWon/isBoardSolved, countBoxesOnTarget, createGameState
    history.js    MoveHistory — undo/redo stack wrapping state.move()
    generator.js  DIFFICULTY_PRESETS + generateLevel() — reverse-play level generation
    solver.js     bfsSolve() / aStarSolve() — search over (player, boxes) states
    renderer.js   drawGrid()/drawState(ctx, state, tileSize, visual) — pure canvas scene
                  (checkered floor, beveled walls, pulsing target pads, crates, keeper,
                  confetti); `visual` is the optional animation layer, PALETTE the colors
    motion.js     pure tween math: slidePosition/bumpOffset/popScale + MOVE/BUMP/POP_MS
    confetti.js   pure win-celebration particle sim (spawn/step/alpha, injectable rng)
    audio.js      createAudio() — WebAudio-synthesized SFX (zero assets), lazy context,
                  mute persisted to localStorage; contextFactory/storage injectable
    share.js      encodeShareParams()/decodeShareParams()/parseSeed() — URL round-trip
  main.js         DOM wiring: event listeners, DPR-aware fitCanvas(), the rAF animation
                  loop (slide/bump/pop/confetti), sound triggers, win overlay, swipe input
  style.css       all presentation (docs/DESIGN.md tokens); layout, control states,
                  win-overlay/card animation, responsive + reduced-motion rules
index.html        DOM skeleton + element ids main.js binds to; loads Fredoka/Nunito Sans
```

`main.js` is the only module that touches the DOM. Everything under `src/game/` is pure
(no globals, no side effects beyond their return values), which is what makes it unit
testable without jsdom — only `main.test.js` and `index-html.test.js` need the
`@vitest-environment jsdom` pragma.

## Data flow

1. **Boot** (`main.js`, bottom of file): read `window.location.search` via
   `decodeShareParams`; if it names a valid preset, seed a level from it, else generate a
   fresh one from `Date.now()`.
2. **Generate** (`generator.js`): `generateLevel` starts from a *solved* board (every box
   already on a target) and applies `scrambleDepth` legal reverse-pull moves via a seeded
   RNG. Because each scramble step is the literal inverse of a forward push, the resulting
   board is solvable by construction — no post-hoc solvability check exists or is needed.
3. **Play** (`state.js` + `history.js`): every player action goes through `move()`, a pure
   `(state, direction) → state` reducer; `MoveHistory` wraps it to get undo/redo for free.
   `main.js` calls `render()` after any state-changing action to sync the DOM/canvas.
4. **Solve** (`solver.js`): on demand, `bfsSolve`/`aStarSolve` search the *same*
   `neighbors()` move generator that `state.move()` encodes, from the board's current
   (possibly already-partially-played) position — not just the generator's start state.
   `main.js` picks BFS below `BFS_CELL_THRESHOLD` cells and A* above it, then steps/animates
   the returned direction array via `setInterval`.
5. **Share**: the current difficulty + seed are pushed into the URL (`share.js`,
   `window.history.replaceState`) on every new level, so "Copy link" / reload always
   reproduces the same board.

## Key invariants worth knowing before you touch this code

- `state.move()` and `solver.js`'s `neighbors()` implement the same push/walk rule
  independently (deliberately not shared as one function) — if you change one, check the
  other; `test/astar.test.js` cross-checks BFS and A* path lengths agree as a guard.
- `isBoardSolved` (state.js) is the single source of truth for "won" — both `isWon` and
  the solvers' goal check call it, so they can never disagree on what counts as solved.
- Any UI action that changes `history.state` (move, undo, redo, reset, new level, difficulty
  change) must call `clearSolution()` in `main.js` — a stale solution/autoplay computed for
  a since-changed board is a silent-corruption bug class, not just a UX nit.
- `generateLevel` validates its own inputs (`RangeError` on non-finite/non-integer/
  out-of-range dimensions) rather than trusting callers, because `DIFFICULTY_PRESETS` is
  the only caller today but the function is exported and unit-tested directly.
- Difficulty read from a shared URL is checked with
  `Object.prototype.hasOwnProperty.call(DIFFICULTY_PRESETS, shared.difficulty)`, not `in` —
  guards against a crafted `?difficulty=constructor` URL matching an inherited key.

## Running things

```sh
npm install
npm test             # vitest run — unit tests, no browser needed
npm run test:coverage
npm run lint          # eslint .
npm run dev           # vite dev server
npm run build         # static bundle to dist/, relative paths (subpath-deployable)
```

Node 20 (see `.nvmrc`) — `npm`/`npx` need `/opt/node20/bin` on `PATH` in this container if
the default `node` on `PATH` resolves to an older version without a matching `npm`.

## Test layout

One test file per `src/game/*.js` module, plus `main.test.js` (DOM wiring, by far the
largest file — event listener interactions, playback timing, keyboard shortcuts),
`index-html.test.js` (static HTML/DOM-id contract), `readme.test.js` (README's documented
npm scripts actually exist in `package.json`), and `win-condition.test.js` (cross-module
win-detection assertions that don't belong to any single module's own test file).

Coverage is maintained at 100% statements/branches/functions/lines
(`npm run test:coverage`) — treat any drop as a regression to fix, not a number to chase
back up with low-value tests.
