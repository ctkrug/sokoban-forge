import { DIRECTIONS, findTargets, isWalkable } from './state.js';

/** Canonical key for a (player, boxes) search node, order-independent on boxes. */
function serialize(player, boxes) {
  const sorted = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
  return `${player.x},${player.y}|${sorted.map((b) => `${b.x},${b.y}`).join(';')}`;
}

/**
 * Mirrors state.js's isWon: every target must be covered by a box. Checking
 * only "every box sits on a target" would be vacuously true whenever there
 * are fewer boxes than targets (including zero boxes), wrongly reporting an
 * unsolved board as already solved.
 */
function isSolved(grid, boxes) {
  const targets = findTargets(grid);
  return (
    targets.length > 0 &&
    targets.every((target) => boxes.some((box) => box.x === target.x && box.y === target.y))
  );
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

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Sum, over each box, of the Manhattan distance to its nearest target.
 * Admissible (never overestimates the true cost) because every push moves
 * exactly one box exactly one tile, so it can't lead A* to an unsolved
 * board while a lower-cost solution exists.
 */
function boxToTargetHeuristic(boxes, targets) {
  let total = 0;
  for (const box of boxes) {
    let best = Infinity;
    for (const target of targets) {
      const d = manhattan(box, target);
      if (d < best) {
        best = d;
      }
    }
    total += best;
  }
  return total;
}

/** Minimal binary min-heap keyed by `priority`, used by the A* frontier. */
class MinHeap {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(priority, value) {
    this.items.push({ priority, value });
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].priority <= this.items[i].priority) {
        break;
      }
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop() {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        let smallest = i;
        if (left < this.items.length && this.items[left].priority < this.items[smallest].priority) {
          smallest = left;
        }
        if (right < this.items.length && this.items[right].priority < this.items[smallest].priority) {
          smallest = right;
        }
        if (smallest === i) {
          break;
        }
        [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
        i = smallest;
      }
    }
    return top.value;
  }
}

/**
 * A* search using the box-to-target Manhattan heuristic. Explores far
 * fewer states than plain BFS on larger boards because the heuristic
 * steers the frontier toward the goal instead of expanding uniformly.
 */
export function aStarSolve(grid, player, boxes, { maxStates = 200000 } = {}) {
  if (isSolved(grid, boxes)) {
    return [];
  }

  const targets = findTargets(grid);
  const gScore = new Map();
  const startKey = serialize(player, boxes);
  gScore.set(startKey, 0);

  const frontier = new MinHeap();
  frontier.push(boxToTargetHeuristic(boxes, targets), { player, boxes, path: [] });

  let explored = 0;
  while (frontier.size > 0 && explored < maxStates) {
    const current = frontier.pop();
    explored += 1;
    const currentKey = serialize(current.player, current.boxes);
    // gScore is always set for a node's key before it's pushed to the
    // frontier (the start node above, or via gScore.set(key, g) below), so
    // this lookup can never miss - no `?? Infinity` fallback needed.
    if (current.path.length > gScore.get(currentKey)) {
      continue; // a cheaper path to this state was already processed
    }

    for (const next of neighbors(grid, current)) {
      const key = serialize(next.player, next.boxes);
      const g = current.path.length + 1;
      if (g >= (gScore.get(key) ?? Infinity)) {
        continue;
      }
      gScore.set(key, g);

      const path = [...current.path, next.direction];
      if (isSolved(grid, next.boxes)) {
        return path;
      }
      const f = g + boxToTargetHeuristic(next.boxes, targets);
      frontier.push(f, { player: next.player, boxes: next.boxes, path });
    }
  }

  return null;
}
