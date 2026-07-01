# Backlog

Epic/story breakdown for the build phase. High-level by design — each story should be
small enough for one focused build session. Check items off as they land.

## Epic 1 — Core game engine & rules

The grid model, movement rules, and win condition the generator and solver both depend on.

- [x] Extend the grid model with player/box/target entity state (beyond static tiles)
- [x] Implement player movement and box-push rules, including wall/box collision checks
- [x] Implement win-condition detection and move history with undo/redo

## Epic 2 — Procedural level generation

Reverse-play generation so every level that reaches the player is solvable by construction.

- [x] Implement the reverse-play generator core (start solved, apply legal reverse moves)
- [x] Add difficulty parameters: grid size, box count, and scramble depth
- [x] Add seeded generation so a given seed always reproduces the same level
- [x] Add automated tests that assert generator output is always solvable

## Epic 3 — Solver and visualization

The search algorithms and the animation that makes the solve visible to the player.

- [x] Implement a BFS solver for small boards
- [x] Implement an A* solver with a box-to-target distance heuristic for larger boards
- [x] Animate the found solution path move-by-move on the canvas
- [x] Add solver playback controls (play/pause/step, speed)

## Epic 4 — Playable UI and deployment

Turning the engine into something a visitor can actually play and share.

- [x] Add keyboard and touch/click input handling for movement
- [x] Add UI chrome: move counter, reset button, difficulty selector
- [x] Add level sharing via a URL-encoded seed/state, and verify the production
      build is fully relative-path and deploys cleanly under a subpath
