// Layer 2/3 — the generative ambient bed, and its sparser idle variant.
//
// ── Why generated, not a loop ───────────────────────────────────────────────
// A loop betrays itself within minutes, and you sit in front of this thing for
// hours. The technique is Brian Eno's from *Music for Airports*: run several
// voices whose periods are **incommensurable** — ratios that aren't simple
// fractions — so they drift out of phase and the combination never repeats.
// Eno used tape loops of 23.5s / 25.875s / 29.9375s; the VOICES table below is
// the same idea with irrational-ish period ratios.
//
// It also costs zero asset weight, which matters when the art is already ~70MB,
// and it can *follow app state* in a way a fixed recording never could.
//
// ── Rules this must obey ────────────────────────────────────────────────────
// - **Barely there** (AJ's choice). It sits well under the UI ticks. You should
//   notice it stop, not start.
// - **Duck to silence when yielding.** If a game or app takes focus, this stops
//   completely. Competing with game audio is the fastest way to feel broken.
// - **Never over the in-game Quick Menu.** Overlay = UI ticks only, no bed.
// - Start only on a real gesture — the AudioContext is already gated that way.
//
// ── Accent-reactive (AJ: "yes — follow the accent") ─────────────────────────
// The focused app's accent hue drives the harmony and filter colour, so the bed
// leans brighter for streaming and darker/sparser for games. That ties audio to
// the existing --focus-bloom system and is the part that feels bespoke rather
// than like generic ambient.

import { getCtx } from "./sound";
import { getAudioSettings } from "./settings";

/**
 * One drifting voice. `periodS` values are deliberately not multiples of each
 * other — that's the whole trick. With these four, the pattern takes hours to
 * approximately re-align, which is longer than anyone will sit here.
 */
interface Voice {
  /** Scale degree (semitones above the root) this voice sings. */
  semitone: number;
  /** Seconds for one full swell-and-fade. */
  periodS: number;
  /** Where in its own cycle this voice starts, so they don't all bloom at once. */
  phase: number;
  gain: number;
}

const VOICES: Voice[] = [
  { semitone: 0, periodS: 23.5, phase: 0.0, gain: 0.16 },
  { semitone: 7, periodS: 25.875, phase: 0.31, gain: 0.13 },
  { semitone: 12, periodS: 29.9375, phase: 0.62, gain: 0.10 },
  { semitone: 16, periodS: 37.125, phase: 0.14, gain: 0.07 },
];

/** Root note. Low enough to sit under everything without muddying dialogue. */
const ROOT_HZ = 110; // A2

interface VoiceNodes {
  osc: OscillatorNode;
  detuned: OscillatorNode;
  gain: GainNode;
}

let master: GainNode | null = null;
let filter: BiquadFilterNode | null = null;
let nodes: VoiceNodes[] = [];
let timer: number | null = null;
let running = false;
let ducked = false;
let idleMode = false;
/** Current accent hue in degrees; drives harmony + filter colour. */
let hue = 210;

const FADE_S = 2.5;

function targetLevel(): number {
  if (ducked) return 0;
  const settings = getAudioSettings();
  if (idleMode && !settings.idleMusicEnabled) return 0;
  if (!idleMode && !settings.ambientEnabled) return 0;
  // Barely-there by design. This ceiling is intentionally low: the UI ticks sit
  // around 0.05-0.07, and the bed should read as room tone under them.
  const base = idleMode ? 0.045 : 0.03;
  return base * settings.ambientLevel;
}

function applyLevel(immediate = false) {
  if (!master) return;
  const c = getCtx();
  const value = targetLevel();
  master.gain.cancelScheduledValues(c.currentTime);
  master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), c.currentTime);
  if (immediate) master.gain.setValueAtTime(value, c.currentTime);
  // linearRamp, not exponential: exponential can't reach 0, and "duck to
  // silence" has to actually mean silence.
  else master.gain.linearRampToValueAtTime(value, c.currentTime + FADE_S);
}

/**
 * Hue -> filter cutoff. Warm accents (amber/rose, hue near 0/30) open up a
 * little; cool ones (blue/purple) stay darker. Small range on purpose — this
 * is a tint, not a different instrument.
 */
function cutoffFor(h: number): number {
  const warmth = Math.cos((h - 30) * Math.PI / 180); // 1 at amber, -1 at cyan
  return 420 + warmth * 140;
}

/** Minor vs major third, chosen by accent. Games skew cool -> minor, sparser. */
function thirdFor(h: number): number {
  const cool = h > 150 && h < 300;
  return cool ? 3 : 4;
}

function buildGraph() {
  const c = getCtx();
  master = c.createGain();
  master.gain.value = 0.0001;

  filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoffFor(hue);
  filter.Q.value = 0.6;

  filter.connect(master);
  master.connect(c.destination);

  nodes = VOICES.map((voice) => {
    const semitone = voice.semitone === 4 || voice.semitone === 3 ? thirdFor(hue) : voice.semitone;
    const freq = ROOT_HZ * Math.pow(2, semitone / 12);
    const gain = c.createGain();
    gain.gain.value = 0;

    // Two oscillators a few cents apart per voice. The slow beating between
    // them is what stops a synth pad sounding like a test tone.
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const detuned = c.createOscillator();
    detuned.type = "sine";
    detuned.frequency.value = freq;
    detuned.detune.value = 7;

    osc.connect(gain);
    detuned.connect(gain);
    gain.connect(filter!);
    osc.start();
    detuned.start();
    return { osc, detuned, gain };
  });
}

/**
 * Re-aim every voice's gain toward where its own slow cycle says it should be.
 * Run on a lazy timer rather than per-frame — these move over tens of seconds,
 * so sampling a few times a second is far more than enough and costs nothing.
 */
function step() {
  if (!running) return;
  const c = getCtx();
  const now = c.currentTime;
  VOICES.forEach((voice, i) => {
    const node = nodes[i];
    if (!node) return;
    const t = (now / voice.periodS + voice.phase) % 1;
    // Raised cosine: a smooth swell and fade with no corner at the seam.
    const envelope = (1 - Math.cos(t * Math.PI * 2)) / 2;
    // The idle bed is sparser — fewer voices audible at once, more space.
    const weight = idleMode ? Math.pow(envelope, 2.2) : envelope;
    node.gain.gain.setTargetAtTime(voice.gain * weight, now, 0.9);
  });
  if (filter) filter.frequency.setTargetAtTime(cutoffFor(hue), now, 1.5);
}

export function startAmbient() {
  if (running) return;
  running = true;
  if (!master) buildGraph();
  applyLevel();
  step();
  timer = window.setInterval(step, 500);
}

export function stopAmbient() {
  running = false;
  if (timer !== null) { clearInterval(timer); timer = null; }
  if (master) {
    const c = getCtx();
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.linearRampToValueAtTime(0, c.currentTime + 0.6);
  }
}

/**
 * Hard mute while another app owns the screen. Called on launch/yield and
 * released on restore — the bed must never play under a game.
 */
export function duckAmbient(on: boolean) {
  ducked = on;
  applyLevel();
}

/** Switch between the dashboard bed and the sparser idle-screen variant. */
export function setAmbientIdle(on: boolean) {
  if (idleMode === on) return;
  idleMode = on;
  applyLevel();
}

/** Follow the focused app's accent. Cheap — it only retunes filter + third. */
export function setAmbientHue(next: number) {
  if (Math.abs(next - hue) < 4) return;
  hue = next;
}

/** Re-read Settings (level trim, per-layer switches) without a restart. */
export function refreshAmbient() {
  applyLevel();
}
