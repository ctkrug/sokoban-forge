# Vision

## The problem

Sokoban is a great puzzle format — simple rules, deep combinatorics — but almost every
browser implementation of it falls into one of two traps:

1. **Hand-authored level packs.** Finite, requires a human to design and playtest every
   board, and offers no insight into *how* a puzzle could be solved beyond trial and error.
2. **Naive random generation.** Scatter walls, boxes, and targets on a grid and hope it's
   solvable. Most random boards aren't, and the ones that are aren't difficulty-controlled.

Neither approach demonstrates the two things that make Sokoban interesting as a piece of
software: generating content procedurally *with a correctness guarantee*, and searching a
huge state space efficiently to find a solution.

## Who it's for

Anyone who lands on the page wanting a quick, well-made puzzle to play — and, for the
subset of visitors who are curious how it works, a live demonstration of procedural
generation and heuristic search rather than a black box. It's a portfolio piece as much
as a game: it should read cleanly to another engineer skimming the source.

## The core idea

Generate levels **backwards**. Start from a solved state (boxes on targets) and simulate
a sequence of legal *reverse* pushes/pulls to scramble the boxes and player away from
their targets. Because every move made during generation is a valid reverse-move, replaying
the recorded sequence forward from the scrambled state is guaranteed to solve the puzzle —
solvability is a byproduct of *how* the level is built, not something checked after the
fact.

The same puzzle can then be handed to a forward solver (BFS for small/shallow boards, A*
with a box-to-target distance heuristic for larger ones) so the player can ask "show me
the answer" and watch the solver's own search reach the same goal, animated move by move.
Generation and solving share the same grid/state representation, so the codebase has one
source of truth for what a "valid move" is.

## Key design decisions

- **Reverse-play generation over post-hoc validation.** Guarantees solvability by
  construction; no reject-and-retry loop, no risk of shipping an unsolvable board.
- **Difficulty as generation parameters**, not solver tuning: grid size, box count, and
  reverse-play depth (how many scrambling moves are applied) are the knobs. More depth and
  more boxes produce puzzles that are harder both to play *and* to solve computationally.
- **Solver as a first-class feature, not a debug tool.** BFS/A* run in the browser against
  the exact grid the player sees, and their frontier/path is animated — the solve is a
  visible artifact, not a hidden correctness check.
- **Zero backend.** Generation, solving, and rendering are all client-side. The whole game
  is a static bundle, which keeps hosting free and trivial (any static file host, including
  a subpath of an existing domain).
- **Plain Canvas 2D, no game framework.** The rendering surface is simple enough (a grid of
  tiles) that a framework would add indirection without adding capability.

## What "v1 done" looks like

- A player can load the page, get a procedurally generated level, and solve it with
  keyboard/touch controls (move, undo, reset).
- Every generated level is solvable by construction — no unsolvable board ever reaches
  the player.
- A visible difficulty control changes grid size / box count / scramble depth.
- A "Solve" action runs BFS or A* (chosen appropriately for board size) and animates the
  resulting solution path over the current board.
- The whole thing builds to a single static output directory with relative asset paths
  and runs with no server-side component.
- Core generator and solver logic (not rendering) has unit test coverage, and CI runs
  lint + tests + build on every push.
