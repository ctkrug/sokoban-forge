import { describe, expect, it } from 'vitest';
import { createEmptyGrid } from '../src/game/grid.js';
import { createGameState } from '../src/game/state.js';
import { MoveHistory } from '../src/game/history.js';

function makeHistory() {
  const state = createGameState({
    grid: createEmptyGrid(5, 5),
    player: { x: 2, y: 2 },
    boxes: [],
  });
  return new MoveHistory(state);
}

describe('MoveHistory', () => {
  it('applies a legal move and reports it changed the state', () => {
    const history = makeHistory();

    const changed = history.move('right');

    expect(changed).toBe(true);
    expect(history.state.player).toEqual({ x: 3, y: 2 });
  });

  it('reports no-op moves without touching the stack', () => {
    const state = createGameState({
      grid: createEmptyGrid(5, 5),
      player: { x: 0, y: 0 },
      boxes: [],
    });
    const history = new MoveHistory(state);

    const changed = history.move('up' /* off the top edge of the board */);

    expect(changed).toBe(false);
    expect(history.canUndo()).toBe(false);
  });

  it('undoes and redoes moves', () => {
    const history = makeHistory();
    history.move('right');
    history.move('right');

    expect(history.undo()).toBe(true);
    expect(history.state.player).toEqual({ x: 3, y: 2 });
    expect(history.redo()).toBe(true);
    expect(history.state.player).toEqual({ x: 4, y: 2 });
  });

  it('discards the redo branch once a new move is made', () => {
    const history = makeHistory();
    history.move('right');
    history.undo();

    history.move('down');

    expect(history.canRedo()).toBe(false);
  });

  it('is a no-op to undo with an empty history', () => {
    const history = makeHistory();

    expect(history.undo()).toBe(false);
  });

  it('is a no-op to redo with an empty future', () => {
    const history = makeHistory();

    expect(history.redo()).toBe(false);
  });
});
