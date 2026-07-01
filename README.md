# Sokoban Forge

A browser puzzle game that procedurally generates **guaranteed-solvable** Sokoban levels
and can animate its own search-based solver on demand.

Play in any modern browser — no build step, no backend, no accounts. Push boxes onto
targets, or hit "Solve" and watch a BFS/A* search find the shortest path through the
same puzzle you're stuck on.

## Why

Most puzzle-game demos are either hand-authored levels (finite, curator-bound) or
random-but-unverified generators that produce unsolvable boards. Sokoban Forge does
neither: it generates levels by playing them *backwards* from a solved state, so every
board that reaches the player is provably solvable, and it keeps the solver that proved
it around so it can replay the proof as an animation. It's a small, self-contained
demonstration of procedural content generation and heuristic search sharing one
codebase instead of living in separate toy projects.

## Features

- **Procedural level generation** — reverse-play generation (pull moves from a solved
  state) guarantees every generated level has at least one solution.
- **Difficulty tuning** — easy/medium/hard presets scale grid size, box count, and
  reverse-play depth.
- **Playable Canvas UI** — keyboard (arrows/WASD) and click/tap controls, move counter,
  undo/redo, reset, and a difficulty selector.
- **On-demand solver visualization** — BFS for small boards, A* with a box-to-target
  Manhattan heuristic for larger ones; step or auto-play the solution move by move.
- **Level sharing** — a level's difficulty and seed live in the URL, so "Copy link"
  reproduces the exact same board for whoever opens it.
- **No dependencies at runtime** — plain HTML/CSS/JS + Canvas, deployable as a static
  site.

## How to play

- **Move:** arrow keys or WASD, or click/tap a tile directly next to the player.
- **Push a box** by walking into it — it slides one tile further, if that tile is clear.
- **Undo** the last move (or **Redo** it back), **Reset** the level back to its start
  (or press **R**), or **New level** to generate another one at the selected difficulty.
- **Solve** runs the solver from the current position; **Step** advances the found
  solution one move, **Play** animates it automatically (speed adjustable, or press
  **Escape** to stop early).
- **Copy link** puts a URL encoding the current level's difficulty and seed on your
  clipboard — opening it regenerates the identical board.

## Stack

- **Language:** JavaScript (ES modules), no framework.
- **Rendering:** HTML5 Canvas 2D.
- **Tooling:** [Vitest](https://vitest.dev/) for unit tests (generator + solver logic),
  [ESLint](https://eslint.org/) for linting.
- **Deployment:** static site, buildable to a single output directory, relative asset
  paths only — servable from any subpath.

## Status

Core gameplay, generation, and solving are functionally complete. See
[`docs/VISION.md`](docs/VISION.md) for the design and [`docs/BACKLOG.md`](docs/BACKLOG.md)
for the build plan.

## Development

```sh
npm install
npm test        # run unit tests
npm run lint     # lint source
npm run dev      # local dev server
npm run build    # production build to dist/
```

## License

MIT — see [`LICENSE`](LICENSE).
