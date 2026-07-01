// Deliberately NOT jsdom: audio.js's browser-default helpers must also work
// where `window` does not exist at all (SSR imports, node tooling).
import { describe, expect, it } from 'vitest';
import { createAudio } from '../src/game/audio.js';

describe('createAudio without a window global', () => {
  it('degrades to a silent, unmuted, storage-less channel', () => {
    const audio = createAudio();
    expect(audio.muted).toBe(false);
    expect(() => audio.play('step')).not.toThrow();
    expect(() => audio.toggleMuted()).not.toThrow();
  });
});
