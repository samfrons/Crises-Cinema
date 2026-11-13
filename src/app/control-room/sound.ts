/**
 * The desk's sound layer — off by default, synthesized, no asset files.
 *
 * Four voices, all short, all quiet, all mechanical: the teleprinter's
 * type-bar tick as a slip's leader prints, a relay clunk when the clock is
 * advanced, one low page-thud as the debrief's toll is set down, and a
 * faint key tick when an option takes focus. Nothing is sustained, nothing
 * sweeps upward, nothing resembles a siren or an emergency-alert tone: those
 * are regulated signals and this is a history desk, not an alarm.
 *
 * Level: one master gain at 0.08 (about −22 dBFS) and every voice peaks at
 * or below 1.0 into it, so no sound exceeds roughly −22 dBFS before the
 * short envelopes take it lower still.
 *
 * The player's choice is kept in localStorage (read and written inside
 * try/catch). A player who prefers reduced motion starts with sound off
 * even if an earlier choice said on, unless they turned it on while that
 * preference was set. The context is created only on the toggle's own
 * press (a user gesture), suspended while the page is hidden, and every
 * call is a no-op where Web Audio is unavailable.
 *
 * Each sound that actually plays leaves a performance mark (`cr-sound:<name>`)
 * so a test can see what fired without hearing it.
 */

const KEY = 'cr-sound';
const MASTER = 0.08;

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let enabled = false;
let loaded = false;
const listeners = new Set<(on: boolean) => void>();
/** Sources scheduled ahead (the leader ticks), so a skipped beat can hush them. */
let scheduled: AudioScheduledSourceNode[] = [];

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function AudioCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Whether this browser can make any sound at all (the toggle hides if not). */
export const soundAvailable = () => AudioCtor() !== null;

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  let v: string | null = null;
  try { v = window.localStorage.getItem(KEY); } catch { v = null; }
  enabled = v === 'on-rm' || (v === 'on' && !reduced());
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend().catch(() => {});
    else if (enabled) void ctx.resume().catch(() => {});
  });
}

export function soundOn(): boolean {
  load();
  return enabled;
}

export function onSoundChange(fn: (on: boolean) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function ensure(): Ctx | null {
  if (ctx) return ctx;
  const C = AudioCtor();
  if (!C) return null;
  try {
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = MASTER;
    master.connect(ctx.destination);
    // Half a second of white noise, made once: the body of every tick and thud.
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch {
    ctx = null;
    master = null;
  }
  return ctx;
}

/** Called from the toggle's press: a user gesture, so the context may start. */
export function setSound(on: boolean) {
  load();
  enabled = on;
  try { window.localStorage.setItem(KEY, on ? (reduced() ? 'on-rm' : 'on') : 'off'); } catch { /* storage refused: this page's life only */ }
  if (on) {
    const c = ensure();
    if (c && c.state !== 'running') void c.resume().catch(() => {});
  } else {
    hush();
    if (ctx) void ctx.suspend().catch(() => {});
  }
  listeners.forEach((fn) => fn(on));
}

/** A context ready to play into, or null (sound off, unavailable, hidden). */
function live(): Ctx | null {
  load();
  if (!enabled || (typeof document !== 'undefined' && document.hidden)) return null;
  const c = ensure();
  if (!c || !master) return null;
  if (c.state === 'suspended') void c.resume().catch(() => {});
  return c;
}

function mark(name: string) {
  try { performance.mark(`cr-sound:${name}`); } catch { /* marks unavailable: nothing to trace */ }
}

/** A filtered noise burst with a fast exponential decay. */
function burst(c: Ctx, at: number, { gain, decay, type, freq, q = 1 }: {
  gain: number; decay: number; type: BiquadFilterType; freq: number; q?: number;
}) {
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  src.connect(f).connect(g).connect(master!);
  src.start(at, Math.random() * 0.4);
  src.stop(at + decay + 0.02);
  return src;
}

/** A short falling sine: the weight behind a clunk or a thud. Falls only. */
function body(c: Ctx, at: number, { gain, from, to, decay }: { gain: number; from: number; to: number; decay: number }) {
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(from, at);
  o.frequency.exponentialRampToValueAtTime(to, at + decay);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  o.connect(g).connect(master!);
  o.start(at);
  o.stop(at + decay + 0.02);
  return o;
}

/**
 * The type bars striking as a leader line prints: `count` ticks, `spacing`
 * ms apart, starting `delay` ms from now — scheduled on the audio clock, so
 * no timer loop runs while they play.
 */
export function teletype(delay: number, count: number, spacing: number) {
  const c = live();
  if (!c || count <= 0) return;
  mark('teletype');
  for (let i = 0; i < count; i++) {
    // A skipped beat reschedules from a negative offset: ticks already past stay silent.
    const ms = delay + i * spacing;
    if (ms < 0) continue;
    const at = c.currentTime + ms / 1000 + Math.random() * 0.004;
    scheduled.push(burst(c, at, { gain: 0.42 + Math.random() * 0.18, decay: 0.018, type: 'bandpass', freq: 2600 + Math.random() * 900, q: 3 }));
  }
  if (scheduled.length > 120) scheduled = scheduled.slice(-120);
}

/** The relay as the clock is advanced: a dull mechanical clunk. */
export function clunk() {
  const c = live();
  if (!c) return;
  mark('clunk');
  const at = c.currentTime + 0.005;
  body(c, at, { gain: 0.9, from: 120, to: 58, decay: 0.14 });
  burst(c, at, { gain: 0.5, decay: 0.05, type: 'lowpass', freq: 900 });
}

/** The odometer stepping through an hour, during the advance beat. */
export function detent(delay = 0) {
  const c = live();
  if (!c) return;
  const at = c.currentTime + delay / 1000;
  scheduled.push(burst(c, at, { gain: 0.32, decay: 0.012, type: 'highpass', freq: 3200 }));
}

/** The toll set down on the debrief's closing band: one low page-thud. */
export function thud(delay = 0) {
  const c = live();
  if (!c) return;
  mark('thud');
  const at = c.currentTime + delay / 1000;
  scheduled.push(body(c, at, { gain: 1, from: 70, to: 38, decay: 0.32 }));
  scheduled.push(burst(c, at, { gain: 0.55, decay: 0.16, type: 'lowpass', freq: 320 }));
}

/** A key taking the finger: the faintest tick, on an option's focus. */
export function keyTick() {
  const c = live();
  if (!c) return;
  mark('key');
  burst(c, c.currentTime + 0.002, { gain: 0.2, decay: 0.01, type: 'bandpass', freq: 1800, q: 2 });
}

/** Stop anything scheduled ahead (a skipped beat leaves nothing ticking). */
export function hush() {
  for (const s of scheduled) { try { s.stop(); } catch { /* already done */ } }
  scheduled = [];
}
