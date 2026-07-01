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

- [ ] Implement the reverse-play generator core (start solved, apply legal reverse moves)
- [ ] Add difficulty parameters: grid size, box count, and scramble depth
- [ ] Add seeded generation so a given seed always reproduces the same level
- [ ] Add automated tests that assert generator output is always solvable

## Epic 3 — Solver and visualization

The search algorithms and the animation that makes the solve visible to the player.

- [ ] Implement a BFS solver for small boards
- [ ] Implement an A* solver with a box-to-target distance heuristic for larger boards
- [ ] Animate the found solution path move-by-move on the canvas
- [ ] Add solver playback controls (play/pause/step, speed)

## Epic 4 — Playable UI and deployment

Turning the engine into something a visitor can actually play and share.

- [ ] Add keyboard and touch/click input handling for movement
- [ ] Add UI chrome: move counter, reset button, difficulty selector
- [ ] Add level sharing via a URL-encoded seed/state, and verify the production
      build is fully relative-path and deploys cleanly under a subpath
