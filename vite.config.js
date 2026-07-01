import { defineConfig } from 'vite';

// Relative base so the built site works when served from any subpath,
// e.g. apps.charliekrug.com/sokoban-forge/.
export default defineConfig({
  base: './',
});
