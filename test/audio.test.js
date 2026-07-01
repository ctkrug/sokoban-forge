// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { SFX, createAudio } from '../src/game/audio.js';

/** A recording AudioContext double covering the WebAudio surface audio.js uses. */
function createStubContext() {
  const started = [];
  const ctx = {
    currentTime: 0,
    destination: { name: 'destination' },
    started,
    createGain() {
      return {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      };
    },
    createOscillator() {
      const osc = {
        type: '',
        frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: (at) => started.push({ osc, at }),
        stop: vi.fn(),
      };
      return osc;
    },
  };
  return ctx;
}

function createStubStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem(k, v) {
      data[k] = v;
    },
  };
}

describe('createAudio', () => {
  it('lazily creates the context on first play, not at construction', () => {
    const factory = vi.fn(createStubContext);
    const audio = createAudio({ contextFactory: factory, storage: null });

    expect(factory).not.toHaveBeenCalled();
    audio.play('step');
    expect(factory).toHaveBeenCalledTimes(1);
    audio.play('push');
    expect(factory).toHaveBeenCalledTimes(1); // reused, not rebuilt
  });

  it('starts one oscillator per tone of the effect', () => {
    const ctx = createStubContext();
    const audio = createAudio({ contextFactory: () => ctx, storage: null });

    audio.play('win');

    expect(ctx.started).toHaveLength(SFX.win.length);
  });

  it('slides pitch only for tones that declare freqEnd', () => {
    const ctx = createStubContext();
    const audio = createAudio({ contextFactory: () => ctx, storage: null });

    audio.play('bump'); // bump's single tone has no freqEnd

    const osc = ctx.started[0].osc;
    expect(osc.frequency.setValueAtTime).toHaveBeenCalled();
    expect(osc.frequency.linearRampToValueAtTime).not.toHaveBeenCalled();
  });

  it('is silent while muted and resumes when unmuted', () => {
    const ctx = createStubContext();
    const audio = createAudio({ contextFactory: () => ctx, storage: createStubStorage() });

    audio.toggleMuted();
    audio.play('step');
    expect(ctx.started).toHaveLength(0);

    audio.toggleMuted();
    audio.play('step');
    expect(ctx.started).toHaveLength(1);
  });

  it('persists the mute flag and reads it back on construction', () => {
    const storage = createStubStorage();
    const audio = createAudio({ contextFactory: createStubContext, storage });

    expect(audio.muted).toBe(false);
    audio.toggleMuted();
    expect(storage.data['shove.muted']).toBe('1');

    const next = createAudio({ contextFactory: createStubContext, storage });
    expect(next.muted).toBe(true);
    next.toggleMuted();
    expect(storage.data['shove.muted']).toBe('0');
  });

  it('throttles retriggering the same effect within the same instant', () => {
    const ctx = createStubContext();
    const audio = createAudio({ contextFactory: () => ctx, storage: null });

    audio.play('step');
    audio.play('step'); // same ctx.currentTime -> dropped
    expect(ctx.started).toHaveLength(1);

    ctx.currentTime = 1;
    audio.play('step');
    expect(ctx.started).toHaveLength(2);
  });

  it('does not throttle two different effects at the same instant', () => {
    const ctx = createStubContext();
    const audio = createAudio({ contextFactory: () => ctx, storage: null });

    audio.play('push');
    audio.play('target');

    expect(ctx.started).toHaveLength(SFX.push.length + SFX.target.length);
  });

  it('is a no-op for unknown effect names and missing backends', () => {
    const ctx = createStubContext();
    const audio = createAudio({ contextFactory: () => ctx, storage: null });
    expect(() => audio.play('kazoo')).not.toThrow();
    expect(ctx.started).toHaveLength(0);

    const silent = createAudio({ contextFactory: null, storage: null });
    expect(() => silent.play('step')).not.toThrow();
  });

  it('disables sound permanently when the context factory throws', () => {
    const factory = vi.fn(() => {
      throw new Error('context limit reached');
    });
    const audio = createAudio({ contextFactory: factory, storage: null });

    expect(() => audio.play('step')).not.toThrow();
    audio.play('step');
    expect(factory).toHaveBeenCalledTimes(1); // not retried after the throw
  });

  it('survives a storage that throws on read and write', () => {
    const hostile = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('full');
      },
    };
    const audio = createAudio({ contextFactory: createStubContext, storage: hostile });
    expect(audio.muted).toBe(false);
    expect(() => audio.toggleMuted()).not.toThrow();
  });

  it('uses browser defaults when constructed with no dependencies (jsdom: silent no-op)', () => {
    // jsdom has localStorage but no AudioContext - the default construction
    // path must still produce a working, silent channel.
    const audio = createAudio();
    expect(() => audio.play('step')).not.toThrow();
    expect(typeof audio.muted).toBe('boolean');
  });
});

describe('createAudio browser defaults', () => {
  it('builds contexts from the global AudioContext when one exists', () => {
    const started = [];
    class FakeAudioContext {
      constructor() {
        this.currentTime = 0;
        this.destination = {};
      }
      createGain() {
        return {
          gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {},
        };
      }
      createOscillator() {
        return {
          type: '',
          frequency: { setValueAtTime() {}, linearRampToValueAtTime() {} },
          connect() {},
          start: (at) => started.push(at),
          stop() {},
        };
      }
    }
    window.AudioContext = FakeAudioContext;
    try {
      const audio = createAudio({ storage: null });
      audio.play('step');
      expect(started).toHaveLength(1);
    } finally {
      delete window.AudioContext;
    }
  });

  it('degrades to no storage when accessing window.localStorage itself throws', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('privacy mode');
      },
    });
    try {
      const audio = createAudio({ contextFactory: null });
      expect(audio.muted).toBe(false);
      expect(() => audio.toggleMuted()).not.toThrow();
    } finally {
      Object.defineProperty(window, 'localStorage', original);
    }
  });
});
