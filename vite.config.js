import { defineConfig } from 'vite';

// Relative base so the built site works when served from any subpath,
// e.g. apps.charliekrug.com/sokoban-forge/.
export default defineConfig({
  base: './',
  test: {
    // The suite is at 100% coverage on every dimension; failing the run on
    // any drop turns "coverage regressed" into a CI failure instead of a
    // number nobody happens to notice went down.
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
