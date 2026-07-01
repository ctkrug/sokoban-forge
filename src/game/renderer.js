import { TILE } from './grid.js';
import { confettiAlpha } from './confetti.js';

export const DEFAULT_TILE_SIZE = 40;

// The board palette from docs/DESIGN.md ("warm tactile toy"): an espresso
// room, top-lit wooden walls, amber lamplight targets, wooden crates, and a
// round amber keeper. Exported so tests can assert against named colors
// instead of magic strings.
export const PALETTE = {
  floorA: '#2a2117',
  floorB: '#2e2519',
  wallFace: '#4a3826',
  wallTop: '#5c4832',
  wallShadow: '#31251a',
  targetPad: '#52402a',
  targetRing: '#ffb454',
  crate: '#c98a4b',
  crateEdge: '#8a5a2e',
  crateHome: '#5da874',
  crateHomeEdge: '#3d7a52',
  crateHomeGlow: '#7ddb91',
  player: '#ffb454',
  playerEye: '#3a2c1d',
};

/**
 * Draws the static board: checkered floor, chunky top-lit walls, and target
 * pads whose ring pulses slowly with `timeMs`. Pure - only talks to the
 * canvas context it is given, so it unit-tests against a stub context.
 */
export function drawGrid(ctx, grid, tileSize = DEFAULT_TILE_SIZE, timeMs = 0) {
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      const px = x * tileSize;
      const py = y * tileSize;
      const tile = grid[y][x];

      // Every cell gets a floor fill first (walls sit on top of it) so the
      // checker pattern stays continuous behind rounded wall corners.
      ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
      ctx.fillRect(px, py, tileSize, tileSize);

      if (tile === TILE.WALL) {
        drawWall(ctx, px, py, tileSize);
      } else if (tile === TILE.TARGET) {
        drawTarget(ctx, px, py, tileSize, timeMs);
      }
    }
  }
}

function drawWall(ctx, px, py, tileSize) {
  const bevel = Math.max(2, tileSize * 0.14);
  ctx.fillStyle = PALETTE.wallFace;
  ctx.fillRect(px, py, tileSize, tileSize);
  ctx.fillStyle = PALETTE.wallTop; // top-lit edge
  ctx.fillRect(px, py, tileSize, bevel);
  ctx.fillStyle = PALETTE.wallShadow; // grounded bottom edge
  ctx.fillRect(px, py + tileSize - bevel, tileSize, bevel);
}

function drawTarget(ctx, px, py, tileSize, timeMs) {
  const cx = px + tileSize / 2;
  const cy = py + tileSize / 2;

  ctx.fillStyle = PALETTE.targetPad;
  ctx.beginPath();
  ctx.arc(cx, cy, tileSize * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // The lamplight ring breathes between ~35% and ~75% opacity so an empty
  // target quietly asks for a crate without strobing.
  const pulse = 0.55 + 0.2 * Math.sin(timeMs / 450);
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = PALETTE.targetRing;
  ctx.lineWidth = Math.max(1.5, tileSize * 0.06);
  ctx.beginPath();
  ctx.arc(cx, cy, tileSize * 0.34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCrate(ctx, x, y, tileSize, onTarget, scale = 1) {
  const size = tileSize * 0.76 * scale;
  const cx = (x + 0.5) * tileSize;
  const cy = (y + 0.5) * tileSize;
  const half = size / 2;
  const edge = Math.max(2, size * 0.12);

  if (onTarget) {
    // Home glow behind the crate: the success cue from docs/DESIGN.md.
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = PALETTE.crateHomeGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, tileSize * 0.46 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = onTarget ? PALETTE.crateHome : PALETTE.crate;
  ctx.fillRect(cx - half, cy - half, size, size);

  // Wooden frame: a border strip on all four sides plus a horizontal brace.
  ctx.fillStyle = onTarget ? PALETTE.crateHomeEdge : PALETTE.crateEdge;
  ctx.fillRect(cx - half, cy - half, size, edge);
  ctx.fillRect(cx - half, cy + half - edge, size, edge);
  ctx.fillRect(cx - half, cy - half, edge, size);
  ctx.fillRect(cx + half - edge, cy - half, edge, size);
  ctx.fillRect(cx - half, cy - edge / 2, size, edge);
}

function drawPlayer(ctx, x, y, tileSize) {
  const cx = (x + 0.5) * tileSize;
  const cy = (y + 0.5) * tileSize;
  const r = tileSize * 0.32;

  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Two dark eyes make it a keeper, not a token.
  ctx.fillStyle = PALETTE.playerEye;
  ctx.beginPath();
  ctx.arc(cx - r * 0.35, cy - r * 0.15, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + r * 0.35, cy - r * 0.15, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
}

function drawConfetti(ctx, particles, tileSize) {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = confettiAlpha(p);
    ctx.fillStyle = p.color;
    ctx.translate(p.x * tileSize, p.y * tileSize);
    ctx.rotate(p.angle);
    const s = p.size * tileSize;
    ctx.fillRect(-s / 2, -s / 2, s, s * 0.6);
    ctx.restore();
  }
}

/**
 * Draws one full frame: grid, crates, player, and any celebration confetti.
 *
 * `visual` is the animation layer (all optional, defaults to a static frame):
 * - `boxPositions`: per-box fractional positions mid-slide
 * - `boxScales`: per-box scale for the lands-on-target pop
 * - `playerPos`: fractional player position mid-slide
 * - `bump`: {x,y} tile-unit offset for the blocked-move nudge
 * - `timeMs`: clock for the target-ring pulse
 * - `confetti`: particles from spawnConfetti/stepConfetti
 *
 * On-target coloring uses the box's LOGICAL cell (state.boxes), not the
 * interpolated pixel position, so a crate turns green the moment the move
 * commits rather than flickering mid-slide.
 */
export function drawState(ctx, state, tileSize = DEFAULT_TILE_SIZE, visual = {}) {
  drawGrid(ctx, state.grid, tileSize, visual.timeMs ?? 0);

  state.boxes.forEach((box, i) => {
    const pos = visual.boxPositions?.[i] ?? box;
    const scale = visual.boxScales?.[i] ?? 1;
    const onTarget = state.grid[box.y][box.x] === TILE.TARGET;
    drawCrate(ctx, pos.x, pos.y, tileSize, onTarget, scale);
  });

  const pos = visual.playerPos ?? state.player;
  const bump = visual.bump ?? { x: 0, y: 0 };
  drawPlayer(ctx, pos.x + bump.x, pos.y + bump.y, tileSize);

  if (visual.confetti?.length) {
    drawConfetti(ctx, visual.confetti, tileSize);
  }
}
