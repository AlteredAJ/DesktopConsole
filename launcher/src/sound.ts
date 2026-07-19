// Synthesized UI tones via Web Audio API — no asset files, no licensing
// concerns, tiny (a few lines of oscillator setup) and instant to load.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  // Browsers suspend AudioContext until a user gesture; controller input
  // doesn't count as one, so nudge it awake on every play attempt (no-op if
  // already running).
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, durationMs: number, gain: number) {
  const c = getCtx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.value = gain;
  // Quick exponential decay so it reads as a "tick," not a sustained beep.
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + durationMs / 1000);
  osc.connect(g);
  g.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + durationMs / 1000);
}

/** Light nav tick — a short high blip, mirrors the haptic nav pulse. */
export function playNavTick() {
  tone(720, 60, 0.05);
}

/** Heavier select confirm — a lower, slightly longer two-tone chirp. */
export function playSelect() {
  tone(480, 90, 0.07);
  setTimeout(() => tone(640, 70, 0.06), 40);
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
  for (const [freq, delay] of notes) setTimeout(() => tone(freq, 460, 0.06), delay);
  tone(196.0, 620, 0.04); // G3 fundamental underneath for body
}
