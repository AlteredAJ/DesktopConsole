// Sound/haptics on-off toggles, persisted like theme.ts. Kept as a separate
// module (not folded into theme.ts) since these gate behavior, not styling.

const STORAGE_KEY = "ps5mode-feedback-settings";
const CONTROLLER_STORAGE_KEY = "ps5mode-controller-settings";

interface FeedbackSettings {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

function load(): FeedbackSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as FeedbackSettings;
  } catch {
    /* ignore malformed storage */
  }
  return { soundEnabled: true, hapticsEnabled: true };
}

let current = load();
const listeners = new Set<() => void>();

export function getFeedbackSettings(): FeedbackSettings {
  return current;
}

export function setFeedbackSettings(next: Partial<FeedbackSettings>) {
  current = { ...current, ...next };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  listeners.forEach((l) => l());
}

export function subscribeFeedbackSettings(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export interface ControllerSettings {
  homeSwipeSensitivity: number;
  keyboardSwipeSensitivity: number;
}

function loadController(): ControllerSettings {
  try {
    const raw = localStorage.getItem(CONTROLLER_STORAGE_KEY);
    if (raw) return { homeSwipeSensitivity: 1, keyboardSwipeSensitivity: 0.72, ...JSON.parse(raw) };
  } catch { /* ignore malformed storage */ }
  return { homeSwipeSensitivity: 1, keyboardSwipeSensitivity: 0.72 };
}

let controllerCurrent = loadController();
const controllerListeners = new Set<() => void>();

export function getControllerSettings(): ControllerSettings { return controllerCurrent; }
export function setControllerSettings(next: Partial<ControllerSettings>) {
  controllerCurrent = { ...controllerCurrent, ...next };
  localStorage.setItem(CONTROLLER_STORAGE_KEY, JSON.stringify(controllerCurrent));
  controllerListeners.forEach((listener) => listener());
}
export function subscribeControllerSettings(listener: () => void): () => void {
  controllerListeners.add(listener);
  return () => controllerListeners.delete(listener);
}

// ── Performance ─────────────────────────────────────────────────────────────
// Settings > Performance. These gate cost, not styling — the perf HUD is the
// thing that lets motion claims be *measured* rather than eyeballed, which is
// how every animation change here has been accepted so far.
//
// `reduceMotion` is an in-app switch that is deliberately independent of the OS
// `prefers-reduced-motion` the CSS already honours: someone can want the system
// default everywhere else and still want this one app calm (or vice versa).
// It's additive — the OS preference still wins when it's set.

const PERFORMANCE_STORAGE_KEY = "ps5mode-performance-settings";

export interface PerformanceSettings {
  perfHud: boolean;
  reduceMotion: boolean;
  heroRotation: boolean;
  idleRotation: boolean;
}

const PERFORMANCE_DEFAULTS: PerformanceSettings = {
  perfHud: false,
  reduceMotion: false,
  heroRotation: true,
  idleRotation: true,
};

function loadPerformance(): PerformanceSettings {
  try {
    const raw = localStorage.getItem(PERFORMANCE_STORAGE_KEY);
    if (raw) return { ...PERFORMANCE_DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore malformed storage */ }
  return { ...PERFORMANCE_DEFAULTS };
}

let performanceCurrent = loadPerformance();
const performanceListeners = new Set<() => void>();

export function getPerformanceSettings(): PerformanceSettings { return performanceCurrent; }
export function setPerformanceSettings(next: Partial<PerformanceSettings>) {
  performanceCurrent = { ...performanceCurrent, ...next };
  localStorage.setItem(PERFORMANCE_STORAGE_KEY, JSON.stringify(performanceCurrent));
  performanceListeners.forEach((listener) => listener());
}
export function subscribePerformanceSettings(listener: () => void): () => void {
  performanceListeners.add(listener);
  return () => performanceListeners.delete(listener);
}

// ── Audio layers ────────────────────────────────────────────────────────────
// Three independent switches, not one "sound on/off". Plenty of people who are
// happy with UI ticks would hate a constant ambient bed, and the reverse is
// true too — collapsing them into one toggle forces an all-or-nothing choice.
//
// `soundEnabled` in FeedbackSettings above still gates UI ticks (it predates
// this and is wired through feedback.ts); these cover the two musical layers
// plus a level trim for the bed.

const AUDIO_STORAGE_KEY = "ps5mode-audio-settings";

export interface AudioSettings {
  /** The generative pad under the dashboard. */
  ambientEnabled: boolean;
  /** Slower, sparser music once the idle screen takes over. */
  idleMusicEnabled: boolean;
  /** 0..1 trim on the bed only — UI ticks keep their own fixed level. */
  ambientLevel: number;
}

const AUDIO_DEFAULTS: AudioSettings = {
  ambientEnabled: true,
  idleMusicEnabled: true,
  ambientLevel: 0.6,
};

function loadAudio(): AudioSettings {
  try {
    const raw = localStorage.getItem(AUDIO_STORAGE_KEY);
    if (raw) return { ...AUDIO_DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore malformed storage */ }
  return { ...AUDIO_DEFAULTS };
}

let audioCurrent = loadAudio();
const audioListeners = new Set<() => void>();

export function getAudioSettings(): AudioSettings { return audioCurrent; }
export function setAudioSettings(next: Partial<AudioSettings>) {
  audioCurrent = { ...audioCurrent, ...next };
  localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(audioCurrent));
  audioListeners.forEach((listener) => listener());
}
export function subscribeAudioSettings(listener: () => void): () => void {
  audioListeners.add(listener);
  return () => audioListeners.delete(listener);
}
