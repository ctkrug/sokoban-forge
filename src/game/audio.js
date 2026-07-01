// Synthesized sound effects - every sound is generated from oscillator/noise
// envelopes at play time, so the game ships zero audio assets (docs/DESIGN.md,
// "Juice plan"). The module takes its AudioContext constructor and storage as
// injectable dependencies so tests can drive it without a real audio backend,
// and so environments with neither (jsdom, old browsers) degrade to a no-op.

const MASTER_GAIN = 0.5;
const MUTE_KEY = 'shove.muted';

// Each effect is data, not code: a list of tones played relative to the
// trigger time. `type` is the oscillator wave, `freq`/`freqEnd` a pitch
// (optionally sliding), `at`/`dur` seconds, `gain` the peak of a fast
// attack + exponential-ish decay envelope.
export const SFX = {
  step: [{ type: 'triangle', freq: 220, freqEnd: 180, at: 0, dur: 0.045, gain: 0.12 }],
  push: [{ type: 'square', freq: 110, freqEnd: 70, at: 0, dur: 0.07, gain: 0.2 }],
  bump: [{ type: 'square', freq: 65, at: 0, dur: 0.04, gain: 0.08 }],
  target: [
    { type: 'sine', freq: 660, at: 0, dur: 0.09, gain: 0.22 },
    { type: 'sine', freq: 880, at: 0.07, dur: 0.12, gain: 0.22 },
  ],
  // A-major rise for the win: A4, C#5, E5, A5.
  win: [
    { type: 'triangle', freq: 440, at: 0, dur: 0.14, gain: 0.24 },
    { type: 'triangle', freq: 554.37, at: 0.11, dur: 0.14, gain: 0.24 },
    { type: 'triangle', freq: 659.25, at: 0.22, dur: 0.16, gain: 0.24 },
    { type: 'triangle', freq: 880, at: 0.33, dur: 0.34, gain: 0.26 },
  ],
};

// Rapid key-repeat can fire `step` faster than the ear separates; retriggering
// the same effect inside this window just stacks volume, so drop those plays.
const THROTTLE_SEC = 0.03;

/**
 * Creates the game's sound channel.
 *
 * @param {object} [deps]
 * @param {Function|null} [deps.contextFactory] returns a fresh AudioContext;
 *   defaults to the global constructor when one exists. `null` disables sound.
 * @param {Storage|null} [deps.storage] persistence for the mute flag;
 *   defaults to localStorage when available.
 */
export function createAudio({
  contextFactory = defaultContextFactory(),
  storage = defaultStorage(),
} = {}) {
  let ctx = null;
  let master = null;
  let muted = readMuted(storage);
  const lastPlayed = new Map();

  function ensureContext() {
    if (ctx || !contextFactory) {
      return ctx;
    }
    // AudioContext construction can throw (e.g. hitting a browser's
    // per-page context limit); a sound failure must never break the game.
    try {
      ctx = contextFactory();
      master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
      contextFactory = null; // don't retry a factory that throws
    }
    return ctx;
  }

  return {
    get muted() {
      return muted;
    },

    /** Flips mute, persists it, and reports the new state. */
    toggleMuted() {
      muted = !muted;
      writeMuted(storage, muted);
      return muted;
    },

    /**
     * Plays a named effect from SFX. Safe to call unconditionally: it is a
     * no-op when muted, when the effect name is unknown, or when no audio
     * backend exists. Must be first called from a user gesture (the context
     * is created lazily here to satisfy autoplay policies).
     */
    play(name) {
      const tones = SFX[name];
      if (muted || !tones || !ensureContext()) {
        return;
      }
      const now = ctx.currentTime;
      const last = lastPlayed.get(name);
      if (last !== undefined && now - last < THROTTLE_SEC) {
        return;
      }
      lastPlayed.set(name, now);
      for (const tone of tones) {
        playTone(ctx, master, now, tone);
      }
    },
  };
}

function playTone(ctx, master, now, { type, freq, freqEnd, at, dur, gain }) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  const start = now + at;
  const end = start + dur;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd !== undefined) {
    osc.frequency.linearRampToValueAtTime(freqEnd, end);
  }

  // Fast attack, exponential decay to (near) silence - clickless on both ends.
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(env);
  env.connect(master);
  osc.start(start);
  osc.stop(end);
}

function defaultContextFactory() {
  const Ctor = typeof window !== 'undefined' ? window.AudioContext : undefined;
  return Ctor ? () => new Ctor() : null;
}

function defaultStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    // Accessing window.localStorage itself throws under some privacy modes.
    return null;
  }
}

function readMuted(storage) {
  try {
    return storage ? storage.getItem(MUTE_KEY) === '1' : false;
  } catch {
    return false;
  }
}

function writeMuted(storage, muted) {
  try {
    storage?.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Persistence is best-effort; a full/blocked storage must not break mute.
  }
}
