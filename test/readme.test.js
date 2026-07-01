import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readmePath = fileURLToPath(new URL('../README.md', import.meta.url));
const readme = readFileSync(readmePath, 'utf-8');
const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf-8'));

describe('README Development section', () => {
  it('only documents npm scripts that actually exist in package.json', () => {
    // Regression guard: a script renamed or removed in package.json (e.g.
    // during a tooling change) would otherwise leave the README's copy-paste
    // "npm run X" instructions silently broken for the next person following
    // them from scratch, with no test to catch the drift.
    const devSection = readme.match(/## Development\n\n```sh\n([\s\S]*?)```/)[1];
    const scriptNames = [...devSection.matchAll(/^npm run (\S+)/gm)].map((match) => match[1]);

    expect(scriptNames.length).toBeGreaterThan(0);
    for (const name of scriptNames) {
      expect(packageJson.scripts).toHaveProperty(name);
    }
  });
});
