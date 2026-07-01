import { TILE, createEmptyGrid } from './grid.js';
import { boxIndexAt, isWalkable } from './state.js';
import { createRng } from './rng.js';

/**
 * Difficulty as generation parameters, not solver tuning: bigger boards,
 * more boxes, and deeper scrambles all make a level harder both to play
 * and to solve computationally.
 */
export const DIFFICULTY_PRESETS = {
  easy: { width: 7, height: 7, boxCount: 1, scrambleDepth: 12 },
  medium: { width: 8, height: 8, boxCount: 2, scrambleDepth: 24 },
  hard: { width: 9, height: 9, boxCount: 3, scrambleDepth: 40 },
};

const PULL_DIRECTIONS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];

function shuffle(items, rng) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Reverse-play generation: build a level that starts *solved* (every box
 * already on a target), then scramble it by repeatedly applying legal
 * "pull" moves (the exact inverse of a forward push). Because each
 * scrambling step is the reverse of a real push, replaying the generation
 * forward — in reverse order, in the opposite direction — always solves
 * the resulting board. Solvability is guaranteed by construction, not
 * checked after the fact.
 *
 * A pull in direction `m` requires:
 *   - the player's destination (player + m) to be walkable and box-free
 *   - a box directly behind the player (player - m), which moves onto the
 *     player's old position
 * When no box sits behind the player, the step is just a plain reverse
 * walk (movement alone is its own inverse).
 */
export function generateLevel({ width, height, boxCount, scrambleDepth, seed }) {
  if (width < 4 || height < 4) {
    throw new RangeError('level must be at least 4x4 to leave room for a border');
  }
  const interiorCells = (width - 2) * (height - 2);
  if (boxCount < 1 || boxCount + 1 > interiorCells) {
    throw new RangeError('boxCount must fit the interior with room left for the player');
  }

  const rng = createRng(seed ?? Date.now());
  const grid = createEmptyGrid(width, height);
  for (let x = 0; x < width; x += 1) {
    grid[0][x] = TILE.WALL;
    grid[height - 1][x] = TILE.WALL;
  }
  for (let y = 0; y < height; y += 1) {
    grid[y][0] = TILE.WALL;
    grid[y][width - 1] = TILE.WALL;
  }

  const cells = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      cells.push({ x, y });
    }
  }
  const shuffled = shuffle(cells, rng);

  const targets = shuffled.slice(0, boxCount);
  for (const target of targets) {
    grid[target.y][target.x] = TILE.TARGET;
  }
  let boxes = targets.map((target) => ({ ...target }));
  let player = { ...shuffled[boxCount] };

  for (let step = 0; step < scrambleDepth; step += 1) {
    const candidates = [];
    for (const dir of shuffle(PULL_DIRECTIONS, rng)) {
      const px = player.x + dir.dx;
      const py = player.y + dir.dy;
      if (!isWalkable(grid, px, py) || boxIndexAt(boxes, px, py) !== -1) {
        continue;
      }

      const behindX = player.x - dir.dx;
      const behindY = player.y - dir.dy;
      const behindBoxIdx = boxIndexAt(boxes, behindX, behindY);
      candidates.push({ player: { x: px, y: py }, behindBoxIdx });
    }

    if (candidates.length === 0) {
      break; // scrambled into a dead end; a shorter scramble is fine
    }

    const choice = candidates[Math.floor(rng() * candidates.length)];
    if (choice.behindBoxIdx !== -1) {
      boxes = boxes.map((box, i) => (i === choice.behindBoxIdx ? { ...player } : box));
    }
    player = choice.player;
  }

  return { grid, player, boxes };
}
