import { describe, expect, it } from 'vitest';
import config from '../vite.config.js';

describe('vite.config.js', () => {
  it('uses a relative base so the build is deployable from any subpath', () => {
    // Regression guard: an absolute base (the Vite default, '/') bakes
    // root-relative asset URLs into dist/index.html, which 404s the moment
    // the site is served from a subpath instead of a domain root - exactly
    // the deployment the README promises ("servable from any subpath").
    expect(config.base).toBe('./');
  });

  it('gates the coverage run on 100% across every dimension', () => {
    expect(config.test.coverage.thresholds).toEqual({
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    });
  });
});
