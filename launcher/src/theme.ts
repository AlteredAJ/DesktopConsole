// Theme system: a light/dark mode plus an accent color scheme, both applied as
// CSS custom properties on <html> and persisted to localStorage. No React
// context needed — settings changes are infrequent, so a plain module-level
// apply() + a small hook to re-render SettingsMenu on change is enough.

export type Mode = "dark" | "light";
export type AccentScheme = "blue" | "purple" | "green" | "amber" | "rose";

const ACCENTS: Record<AccentScheme, string> = {
  blue: "#6ea8ff",
  purple: "#b18aff",
  green: "#5fd98a",
  amber: "#ffb45d",
  rose: "#ff7398",
};

const MODE_VARS: Record<Mode, Record<string, string>> = {
  dark: {
    "--bg": "#0b0d12",
    "--tile": "#161a22",
    "--tile-focus": "#2a3550",
    "--text": "#eef1f6",
    "--muted": "#8a93a6",
  },
  light: {
    "--bg": "#f2f4f8",
    "--tile": "#ffffff",
    "--tile-focus": "#e4e9f5",
    "--text": "#14161b",
    "--muted": "#5b6472",
  },
};

const STORAGE_KEY = "ps5mode-theme";

interface ThemeState {
  mode: Mode;
  accent: AccentScheme;
}

function load(): ThemeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ThemeState;
  } catch {
    /* ignore malformed storage */
  }
  return { mode: "dark", accent: "blue" };
}

let current = load();
const listeners = new Set<() => void>();
const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("ps5mode-theme");

channel?.addEventListener("message", (event: MessageEvent<ThemeState>) => {
  if (!event.data || typeof event.data !== "object") return;
  current = event.data;
  apply();
  listeners.forEach((listener) => listener());
});

export function getTheme(): ThemeState {
  return current;
}

export function setTheme(next: Partial<ThemeState>) {
  current = { ...current, ...next };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  apply();
  listeners.forEach((l) => l());
  channel?.postMessage(current);
}

export function subscribeTheme(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function apply() {
  const root = document.documentElement;
  const vars = MODE_VARS[current.mode];
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.style.setProperty("--accent", ACCENTS[current.accent]);
  root.style.setProperty("--console-accent", ACCENTS[current.accent]);
}

export const ACCENT_SWATCHES = ACCENTS;

// Apply immediately on module load so the first paint already has the saved theme.
apply();
