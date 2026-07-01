import { describe, expect, it } from 'vitest';
import { TILE, createEmptyGrid } from '../src/game/grid.js';
import { DEFAULT_TILE_SIZE, PALETTE, drawGrid, drawState } from '../src/game/renderer.js';

/**
 * Records every draw call the renderer makes so tests can assert on the
 * scene (which colors were used, where rects/arcs landed) without a real
 * canvas backend.
 */
function createStubContext() {
  const calls = [];
  const ctx = {
    calls,
    fillStyleLog: [],
    _fillStyle: '',
    set fillStyle(value) {
      this._fillStyle = value;
      this.fillStyleLog.push(value);
    },
    get fillStyle() {
      return this._fillStyle;
    },
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
  };
  for (const method of [
    'fillRect',
    'save',
    'restore',
    'translate',
    'rotate',
    'beginPath',
    'arc',
    'fill',
    'stroke',
  ]) {
    ctx[method] = (...args) => {
      calls.push({ method, args, fillStyle: ctx._fillStyle, alpha: ctx.globalAlpha });
    };
  }
  return ctx;
}

/** All fillRect/arc calls made while `fillStyle` was set to `color`. */
function callsWithColor(ctx, color) {
  return ctx.calls.filter((c) => c.fillStyle === color && (c.method === 'fillRect' || c.method === 'arc'));
}

describe('drawGrid', () => {
  it('checkers the floor with the two alternating floor colors', () => {
    const grid = createEmptyGrid(2, 1);
    const ctx = createStubContext();

    drawGrid(ctx, grid);

    expect(ctx.fillStyleLog[0]).toBe(PALETTE.floorA);
    expect(ctx.fillStyleLog[1]).toBe(PALETTE.floorB);
  });

  it('fills each floor tile at its scaled pixel offset for a custom tile size', () => {
    const grid = createEmptyGrid(2, 2);
    const ctx = createStubContext();

    drawGrid(ctx, grid, 25);

    const rects = ctx.calls.filter((c) => c.method === 'fillRect').map((c) => c.args);
    expect(rects).toEqual([
      [0, 0, 25, 25],
      [25, 0, 25, 25],
      [0, 25, 25, 25],
      [25, 25, 25, 25],
    ]);
  });

  it('draws a wall as a face plus top-light and shadow bevels', () => {
    const grid = createEmptyGrid(1, 1);
    grid[0][0] = TILE.WALL;
    const ctx = createStubContext();

    drawGrid(ctx, grid, 40);

    // floor underlay + face + top bevel + bottom bevel = 4 rects
    expect(callsWithColor(ctx, PALETTE.wallFace)).toHaveLength(1);
    expect(callsWithColor(ctx, PALETTE.wallTop)).toHaveLength(1);
    expect(callsWithColor(ctx, PALETTE.wallShadow)).toHaveLength(1);
    const top = callsWithColor(ctx, PALETTE.wallTop)[0];
    expect(top.args[1]).toBe(0); // the highlight sits on the tile's top edge
  });

  it('draws a target as a pad plus a pulsing lamplight ring', () => {
    const grid = createEmptyGrid(1, 1);
    grid[0][0] = TILE.TARGET;
    const ctx = createStubContext();

    drawGrid(ctx, grid, 40, 0);

    // One filled pad circle (the ring that follows only strokes, but its arc
    // still records the lingering fillStyle - count fills, not arcs).
    expect(ctx.calls.filter((c) => c.method === 'fill' && c.fillStyle === PALETTE.targetPad)).toHaveLength(1);
    expect(ctx.calls.some((c) => c.method === 'stroke')).toBe(true);
  });

  it('pulses the target ring alpha with time', () => {
    const grid = createEmptyGrid(1, 1);
    grid[0][0] = TILE.TARGET;

    // sin(t/450) differs between these two instants, so the recorded
    // globalAlpha at stroke time must differ too - that IS the pulse.
    const alphaAt = (timeMs) => {
      const ctx = createStubContext();
      drawGrid(ctx, grid, 40, timeMs);
      return ctx.calls.find((c) => c.method === 'stroke').alpha;
    };

    expect(alphaAt(0)).not.toBe(alphaAt(700));
  });
});

describe('drawState', () => {
  const baseState = () => {
    const grid = createEmptyGrid(3, 3);
    grid[1][1] = TILE.TARGET;
    return {
      grid,
      player: { x: 0, y: 0 },
      boxes: [{ x: 2, y: 2 }],
    };
  };

  it('draws crates in wood and the keeper in amber with eyes', () => {
    const ctx = createStubContext();

    drawState(ctx, baseState());

    expect(callsWithColor(ctx, PALETTE.crate).length).toBeGreaterThan(0);
    // body circle + two eyes = three arcs after setting the player colors
    expect(callsWithColor(ctx, PALETTE.player)).toHaveLength(1);
    expect(callsWithColor(ctx, PALETTE.playerEye)).toHaveLength(2);
  });

  it('colors a crate on its target green with a glow, off-target as plain wood', () => {
    const state = baseState();
    state.boxes = [
      { x: 1, y: 1 }, // on the target
      { x: 2, y: 0 }, // off target
    ];
    const ctx = createStubContext();

    drawState(ctx, state);

    expect(callsWithColor(ctx, PALETTE.crateHome).length).toBeGreaterThan(0);
    expect(callsWithColor(ctx, PALETTE.crateHomeGlow).length).toBeGreaterThan(0);
    expect(callsWithColor(ctx, PALETTE.crate).length).toBeGreaterThan(0);
  });

  it('draws entities at interpolated visual positions mid-slide', () => {
    const state = baseState();
    const ctx = createStubContext();

    drawState(ctx, state, DEFAULT_TILE_SIZE, {
      playerPos: { x: 0.5, y: 0 },
      boxPositions: [{ x: 2, y: 1.5 }],
    });

    // The keeper's body arc is centered at (x + 0.5) * tileSize.
    const playerArc = ctx.calls.find((c) => c.method === 'arc' && c.fillStyle === PALETTE.player);
    expect(playerArc.args[0]).toBe((0.5 + 0.5) * DEFAULT_TILE_SIZE);
    const crateRect = ctx.calls.find(
      (c) => c.method === 'fillRect' && c.fillStyle === PALETTE.crate,
    );
    // Crate body rect is centered on (y + 0.5) * tileSize vertically.
    const size = DEFAULT_TILE_SIZE * 0.76;
    expect(crateRect.args[1]).toBeCloseTo((1.5 + 0.5) * DEFAULT_TILE_SIZE - size / 2);
  });

  it('keeps on-target coloring keyed to the logical cell, not the visual position', () => {
    const state = baseState();
    state.boxes = [{ x: 1, y: 1 }]; // logically home
    const ctx = createStubContext();

    // Mid-slide the crate is drawn short of the pad, but it committed to the
    // target cell, so it must already be green.
    drawState(ctx, state, DEFAULT_TILE_SIZE, { boxPositions: [{ x: 0.6, y: 1 }] });

    expect(callsWithColor(ctx, PALETTE.crateHome).length).toBeGreaterThan(0);
  });

  it('applies the bump offset to the player only', () => {
    const state = baseState();
    const ctx = createStubContext();

    drawState(ctx, state, DEFAULT_TILE_SIZE, { bump: { x: 0.18, y: 0 } });

    const playerArc = ctx.calls.find((c) => c.method === 'arc' && c.fillStyle === PALETTE.player);
    expect(playerArc.args[0]).toBeCloseTo((0 + 0.18 + 0.5) * DEFAULT_TILE_SIZE);
  });

  it('scales a popping crate up around its center', () => {
    const state = baseState();
    const ctx = createStubContext();

    drawState(ctx, state, 40, { boxScales: [1.18] });

    const crateRect = ctx.calls.find(
      (c) => c.method === 'fillRect' && c.fillStyle === PALETTE.crate,
    );
    expect(crateRect.args[2]).toBeCloseTo(40 * 0.76 * 1.18); // width grew with the pop
  });

  it('draws confetti particles with rotation and life-based alpha', () => {
    const state = baseState();
    const ctx = createStubContext();

    drawState(ctx, state, 40, {
      confetti: [
        { x: 1, y: 1, angle: 0.5, size: 0.1, color: '#ffb454', life: 1.8 },
        { x: 2, y: 0.5, angle: 1, size: 0.12, color: '#7ddb91', life: 0.1 }, // fading out
      ],
    });

    const rotations = ctx.calls.filter((c) => c.method === 'rotate');
    expect(rotations).toHaveLength(2);
    const fadingRect = ctx.calls.find(
      (c) => c.method === 'fillRect' && c.fillStyle === '#7ddb91',
    );
    expect(fadingRect.alpha).toBeCloseTo(0.2); // life 0.1 / fade window 0.5
  });

  it('draws a static frame when no visual layer is passed', () => {
    const ctx = createStubContext();

    expect(() => drawState(ctx, baseState())).not.toThrow();
    // Static frame: exactly one keeper body, no confetti rotations.
    expect(ctx.calls.filter((c) => c.method === 'rotate')).toHaveLength(0);
  });
});
