import { move } from './state.js';

/**
 * Wraps a game state with an undo/redo stack. Keeps `move` itself pure
 * (state in, state out) while giving the UI layer a single object to call
 * for player input.
 */
export class MoveHistory {
  constructor(initialState) {
    this.reset(initialState);
  }

  get state() {
    return this.present;
  }

  reset(initialState) {
    this.past = [];
    this.present = initialState;
    this.future = [];
  }

  /** Returns true if the move changed the state, false for a no-op. */
  move(direction) {
    const next = move(this.present, direction);
    if (next === this.present) {
      return false;
    }
    this.past.push(this.present);
    this.present = next;
    this.future = [];
    return true;
  }

  canUndo() {
    return this.past.length > 0;
  }

  canRedo() {
    return this.future.length > 0;
  }

  undo() {
    if (!this.canUndo()) {
      return false;
    }
    this.future.push(this.present);
    this.present = this.past.pop();
    return true;
  }

  redo() {
    if (!this.canRedo()) {
      return false;
    }
    this.past.push(this.present);
    this.present = this.future.pop();
    return true;
  }
}
