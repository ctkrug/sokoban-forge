// Pure movement/feedback math for the board's animation layer (docs/DESIGN.md,
// "Juice plan"). No DOM, no timers: main.js owns the requestAnimationFrame
// loop and feeds elapsed milliseconds in; everything here is a pure function
// of time so it can be unit-tested with plain numbers.

export const MOVE_MS = 110; // player/crate slide (cubic-out, never teleport)
export const BUMP_MS = 90; // blocked-move head-shake
export const POP_MS = 180; // crate-lands-on-target scale pop

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function easeOutCubic(t) {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

/** Clamped 0..1 progress of an animation that started `elapsed` ms ago. */
export function progress(elapsed, duration) {
  if (duration <= 0) {
    return 1;
  }
  return Math.min(1, Math.max(0, elapsed / duration));
}

/**
 * Interpolated board position for an entity sliding from -> to.
 * Returns grid-space (fractional) coordinates the renderer scales up.
 */
export function slidePosition(from, to, elapsed, duration = MOVE_MS) {
  const t = easeOutCubic(progress(elapsed, duration));
  return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) };
}

/**
 * Offset (in tile units) of the blocked-move nudge: a quick push toward the
 * wall that springs back to rest, zero once the bump has played out.
 */
export function bumpOffset(direction, elapsed, duration = BUMP_MS) {
  const t = progress(elapsed, duration);
  // sin(pi*t) rises then returns to exactly 0, so the sprite never sticks
  // off-grid; 0.18 tiles is visible without reading as an actual move.
  const magnitude = Math.sin(Math.PI * t) * 0.18;
  return { x: direction.dx * magnitude, y: direction.dy * magnitude };
}

/** Scale factor for the crate-on-target pop: 1 -> ~1.18 -> 1. */
export function popScale(elapsed, duration = POP_MS) {
  const t = progress(elapsed, duration);
  return 1 + Math.sin(Math.PI * t) * 0.18;
}
