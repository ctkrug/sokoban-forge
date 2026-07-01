import { TILE } from './grid.js';
import { DIRECTIONS, findTargets, isWalkable } from './state.js';

/** Canonical key for a (player, boxes) search node, order-independent on boxes. */
function serialize(player, boxes) {
  const sorted = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
  return `${player.x},${player.y}|${sorted.map((b) => `${b.x},${b.y}`).join(';')}`;
}

function isSolved(grid, boxes) {
  return boxes.every((box) => grid[box.y][box.x] === TILE.TARGET);
}

/**
 * Computes the neighboring search states reachable from `node` by one
 * player move, including box pushes. Shared by the BFS and A* solvers so
 * they can never disagree on what a legal move is.
 */
function* neighbors(grid, node) {
  for (const [direction, delta] of Object.entries(DIRECTIONS)) {
    const nx = node.player.x + delta.dx;
    const ny = node.player.y + delta.dy;
    if (!isWalkable(grid, nx, ny)) {
      continue;
    }

    const pushedIdx = node.boxes.findIndex((box) => box.x === nx && box.y === ny);
    let boxes = node.boxes;
    if (pushedIdx !== -1) {
      const bx = nx + delta.dx;
      const by = ny + delta.dy;
      if (!isWalkable(grid, bx, by) || node.boxes.some((box) => box.x === bx && box.y === by)) {
        continue;
      }
      boxes = node.boxes.map((box, i) => (i === pushedIdx ? { x: bx, y: by } : box));
    }

    yield { direction, player: { x: nx, y: ny }, boxes };
  }
}

/**
 * Breadth-first search over (player, boxes) states. Optimal in move count
 * and simple, but its frontier grows with the full state space — best
 * suited to small boards. Returns an array of direction names from start
 * to goal, or null if no solution was found within `maxStates`.
 */
export function bfsSolve(grid, player, boxes, { maxStates = 200000 } = {}) {
  if (isSolved(grid, boxes)) {
    return [];
  }

  const start = { player, boxes };
  const visited = new Set([serialize(player, boxes)]);
  const queue = [{ ...start, path: [] }];

  for (let head = 0; head < queue.length && head < maxStates; head += 1) {
    const current = queue[head];
    for (const next of neighbors(grid, current)) {
      const key = serialize(next.player, next.boxes);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);

      const path = [...current.path, next.direction];
      if (isSolved(grid, next.boxes)) {
        return path;
      }
      queue.push({ player: next.player, boxes: next.boxes, path });
    }
  }

  return null;
}
