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

## Features (planned)

- **Procedural level generation** — reverse-play generation (pull moves from a solved
  state) guarantees every generated level has at least one solution.
- **Difficulty tuning** — grid size, box count, and reverse-play depth scale difficulty
  up or down.
- **Playable Canvas UI** — keyboard/touch controls, move counter, undo, level reset.
- **On-demand solver visualization** — BFS for small boards, A* with a
  Sokoban-specific heuristic (e.g. box-to-target assignment distance) for larger ones;
  animates the solution path move by move.
- **Level sharing** — encode a level's seed/state into a shareable URL.
- **No dependencies at runtime** — plain HTML/CSS/JS + Canvas, deployable as a static
  site.

## Stack

- **Language:** JavaScript (ES modules), no framework.
- **Rendering:** HTML5 Canvas 2D.
- **Tooling:** [Vitest](https://vitest.dev/) for unit tests (generator + solver logic),
  [ESLint](https://eslint.org/) for linting.
- **Deployment:** static site, buildable to a single output directory, relative asset
  paths only — servable from any subpath.

## Status

Early scope/scaffold stage. See [`docs/VISION.md`](docs/VISION.md) for the design and
[`docs/BACKLOG.md`](docs/BACKLOG.md) for the build plan.

## Development

```sh
npm install
npm test        # run unit tests
npm run lint     # lint source
npm run dev       # local dev server
```

## License

MIT — see [`LICENSE`](LICENSE).
