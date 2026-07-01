// Win-celebration confetti (docs/DESIGN.md, "The win moment"). Pure particle
// simulation: spawn takes an injectable random source and step is a function
// of (particles, dt), so the whole system is unit-testable without a canvas.
// main.js draws the particles; this module never touches the DOM.

// The board's own palette (docs/DESIGN.md tokens) so the celebration reads
// as part of the toy, not a generic rainbow.
export const CONFETTI_COLORS = ['#ffb454', '#7ddb91', '#c98a4b', '#f4e9d8'];

export const CONFETTI_COUNT = 90;
const GRAVITY = 2.6; // tile-units / s^2
const LIFE_SEC = 1.8;

/**
 * Spawns a burst across the top of a board `cols` tiles wide.
 * @param {number} cols board width in tiles
 * @param {() => number} random 0..1 source (injectable for tests)
 */
export function spawnConfetti(cols, random = Math.random) {
  const particles = [];
  for (let i = 0; i < CONFETTI_COUNT; i += 1) {
    particles.push({
      x: random() * cols,
      y: -random() * 2, // start just above the board so it rains in
      vx: (random() - 0.5) * 3,
      vy: 0.5 + random() * 1.5,
      spin: (random() - 0.5) * 10,
      angle: random() * Math.PI,
      size: 0.1 + random() * 0.12, // tile units
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      life: LIFE_SEC,
    });
  }
  return particles;
}

/**
 * Advances the simulation by `dt` seconds and returns the still-living
 * particles (a new array; the input is not mutated).
 */
export function stepConfetti(particles, dt) {
  const alive = [];
  for (const p of particles) {
    const life = p.life - dt;
    if (life <= 0) {
      continue;
    }
    alive.push({
      ...p,
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      vy: p.vy + GRAVITY * dt,
      angle: p.angle + p.spin * dt,
      life,
    });
  }
  return alive;
}

/** Opacity for a particle: full for most of its life, fading at the end. */
export function confettiAlpha(p) {
  return Math.min(1, Math.max(0, p.life / 0.5));
}
