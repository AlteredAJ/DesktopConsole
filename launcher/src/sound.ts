// Synthesized UI tones via Web Audio API — no asset files, no licensing
// concerns, tiny and instant to load.
//
// ── Design rules, from how consoles actually do this ────────────────────────
// Researched 2026-07-20 (Apple tvOS HIG, general UI-audio practice, and what
// PS5's UI is observably doing) and applied deliberately:
//
// 1. **Every sound is tied to a real state change.** The absence of a sound is
//    how you tell a no-op from an accepted input — the same contract the
//    haptics already follow. Nothing plays speculatively.
// 2. **Person-initiated only.** tvOS never plays audio the user didn't cause,
//    and doesn't sound alerts or notifications. Neither do we.
// 3. **Short and quiet.** Everything here is under ~180ms except the launch
//    swell. UI audio supports the interface, it doesn't perform.
// 4. **A consistent vocabulary.** Confirm and cancel mean the same thing
//    everywhere — a "sonic contract". Rising = forward/accept, falling = back.
// 5. **Nothing harsh.** Kept under ~2.5kHz: a TV's speakers exaggerate the top
//    end, and a bright click that's fine on a laptop is piercing across a room.
// 6. **The interface must work in silence.** Sound is never the only signal.

let ctx: AudioContext | null = null;
/** Shared output stage, so every UI sound can be trimmed or ducked together. */
let uiBus: GainNode | null = null;

export function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  // Browsers suspend AudioContext until a user gesture; controller input
  // doesn't count as one, so nudge it awake on every play attempt (no-op if
  // already running).
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function bus(): GainNode {
  const c = getCtx();
  if (!uiBus) {
    uiBus = c.createGain();
    uiBus.gain.value = 1;
    uiBus.connect(c.destination);
  }
  return uiBus;
}

interface ToneOptions {
  type?: OscillatorType;
  /** Start of a pitch glide, if the sound should move. */
  fromFreq?: number;
  delayMs?: number;
}

function tone(freq: number, durationMs: number, gain: number, options: ToneOptions = {}) {
  const c = getCtx();
  const at = c.currentTime + (options.delayMs ?? 0) / 1000;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = options.type ?? "sine";

  if (options.fromFreq) {
    osc.frequency.setValueAtTime(options.fromFreq, at);
    osc.frequency.exponentialRampToValueAtTime(freq, at + durationMs / 1000);
  } else {
    osc.frequency.setValueAtTime(freq, at);
  }

  // A tiny attack instead of starting at full gain: an instantaneous jump to
  // amplitude is a click, which on a TV reads as a glitch rather than a tick.
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + durationMs / 1000);

  osc.connect(g);
  g.connect(bus());
  osc.start(at);
  osc.stop(at + durationMs / 1000 + 0.02);
}

/** Light nav tick — a short high blip, mirrors the haptic nav pulse. */
export function playNavTick() {
  tone(720, 60, 0.05);
}

/** Heavier select confirm — a lower, slightly longer two-tone chirp. */
export function playSelect() {
  tone(480, 90, 0.07);
  tone(640, 70, 0.06, { delayMs: 40 });
}

/**
 * Back / cancel — deliberately the inverse of select: the same gesture in the
 * opposite direction, falling instead of rising. That's the sonic contract
 * doing its job, so "I went back" is legible without looking at the screen.
 */
export function playBack() {
  tone(560, 80, 0.055);
  tone(400, 100, 0.05, { delayMs: 45 });
}

/**
 * Tab switch, pitched to travel direction (+1 right / -1 left) so lateral
 * movement is audible. Distinct from the nav tick, which is per-tile.
 */
export function playTabSwitch(direction: number) {
  const up = direction >= 0;
  tone(up ? 880 : 660, 85, 0.045, { fromFreq: up ? 660 : 880, type: "triangle" });
}

/** Settings switch. Two clearly different states, not one generic blip. */
export function playToggle(on: boolean) {
  if (on) tone(900, 55, 0.05, { type: "triangle" });
  else tone(560, 70, 0.045, { type: "triangle" });
}

/**
 * Unavailable / failed — soft and low, never a harsh buzz. An error tone that
 * punishes you for a mistimed press is worse than no tone at all.
 */
export function playError() {
  tone(220, 140, 0.05, { type: "sine" });
  tone(180, 170, 0.04, { delayMs: 70 });
}

/**
 * Launch — a short rising swell under the exit animation, so opening something
 * feels like a departure rather than a cut. The longest sound here (~420ms) and
 * the only one that isn't a tick, because it's covering a real transition.
 */
export function playLaunch() {
  tone(660, 420, 0.055, { fromFreq: 330, type: "triangle" });
  tone(165, 460, 0.04, { type: "sine" });
}

/** Boot chime — a warm ascending G-major arpeggio over a soft low pad. Plays
 * once when Home opens (fits inside the ~760 ms entry animation). Bell-like
 * because `tone` decays exponentially, so it reads as a console power-on
 * flourish, not four flat beeps. */
export function playStartupChime() {
  const notes: Array<[number, number]> = [
    [392.0, 0],    // G4
    [523.25, 95],  // C5
    [659.25, 190], // E5
    [783.99, 285], // G5
  ];
  for (const [freq, delay] of notes) tone(freq, 460, 0.06, { delayMs: delay });
  tone(196.0, 620, 0.04); // G3 fundamental underneath for body
}
