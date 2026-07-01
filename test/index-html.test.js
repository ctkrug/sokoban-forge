import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { DIFFICULTY_PRESETS } from '../src/game/generator.js';

const indexPath = fileURLToPath(new URL('../index.html', import.meta.url));
const html = readFileSync(indexPath, 'utf-8');

describe('index.html', () => {
  it('offers exactly one <option> per difficulty preset, in matching order', () => {
    // Regression guard: main.js trusts that #difficulty's value is always a
    // key of DIFFICULTY_PRESETS (see the hasSharedDifficulty check around a
    // crafted share URL) - if a preset were ever added/renamed in
    // generator.js without updating this markup, the dropdown would offer a
    // dead option, or a preset would become unreachable through the UI.
    const dom = new JSDOM(html);
    const values = [...dom.window.document.querySelectorAll('#difficulty option')].map(
      (option) => option.value,
    );

    expect(values).toEqual(Object.keys(DIFFICULTY_PRESETS));
  });

  it('has exactly one option selected, matching the UI\'s default difficulty', () => {
    const dom = new JSDOM(html);
    const select = dom.window.document.querySelector('#difficulty');

    expect(select.value).toBe('medium');
  });

  it('surfaces the Reset/Undo/Redo keyboard shortcuts as button tooltips', () => {
    // The shortcuts (R/Z/Y) only otherwise appear in the README - a visitor
    // who never reads it has no way to discover them from the UI itself.
    const dom = new JSDOM(html);
    const { document } = dom.window;

    expect(document.querySelector('#reset').title).toBe('Shortcut: R');
    expect(document.querySelector('#undo').title).toBe('Shortcut: Z');
    expect(document.querySelector('#redo').title).toBe('Shortcut: Y');
  });
});
