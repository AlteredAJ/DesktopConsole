// Settings ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â real tabs (General / Audio / Network / Bluetooth), L1/R1 to
// switch between them like the grid's Apps/Games/Launchers tabs. Each tab
// owns its own row-focus state rather than one giant shared row index, since
// tabs now have very different row shapes (a volume slider isn't a toggle).

import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useController } from "../hooks/useController";
import { useEdges } from "../hooks/useEdges";
import { useTouchpad } from "../hooks/useTouchpad";
import { ButtonHints } from "./ButtonHints";
import { CodexPanelShell } from "./CodexPanelShell";
import { getTheme, setTheme, subscribeTheme, ACCENT_SWATCHES, AccentScheme } from "../theme";
import { getControllerSettings, getFeedbackSettings, getPerformanceSettings, setControllerSettings, setFeedbackSettings, setPerformanceSettings, subscribeControllerSettings, subscribeFeedbackSettings, subscribePerformanceSettings } from "../settings";
import { navFeedback, selectFeedback } from "../feedback";
import { ART_CREDITS, THIRD_PARTY } from "../credits";

interface SystemInfo {
  cpu?: string | null;
  cpu_cores?: number | null;
  gpus: string[];
  memory_total?: number | null;
  os_name?: string | null;
  os_version?: string | null;
  kernel_version?: string | null;
  app_version: string;
  webview_version?: string | null;
  config_path?: string | null;
}

interface RgbMode { index: number; name: string; }
interface RgbDevice { index: number; name: string; kind: string; led_count: number; active_mode: number; modes: RgbMode[]; }
interface RgbState { available: boolean; message?: string | null; devices: RgbDevice[]; }

const RGB_PRESETS = [
  { id: "ice", label: "Ice", swatch: "#75C8FF" },
  { id: "violet", label: "Violet", swatch: "#9D7CFF" },
  { id: "warm", label: "Warm", swatch: "#FF9A61" },
  { id: "off", label: "Off", swatch: "#1a1d24" },
] as const;

interface DisplayMode {
  width: number;
  height: number;
  hz: number;
}
interface WifiNetwork {
  ssid: string;
  signal_percent: number;
  known: boolean;
  security: string;
}
interface WifiScan {
  networks: WifiNetwork[];
  requires_location: boolean;
  error?: string;
}
interface WifiStatus {
  connected: boolean;
  ssid?: string;
  signal_percent?: number;
}
interface PairedDevice {
  name: string;
  connected: boolean;
}
interface MixerSession {
  process_id: number;
  name: string;
  volume: number;
  muted: boolean;
}

const ACCENTS = Object.keys(ACCENT_SWATCHES) as AccentScheme[];
const TABS = ["Appearance", "Feedback", "Display", "System", "Controller", "Audio", "Bluetooth", "Lighting", "Performance", "About"] as const;
type Tab = (typeof TABS)[number] | "Network";

// Shoulder bits (buf[9]) ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â same convention as Launcher.tsx.
const L1 = 0x01;
const R1 = 0x02;
const HAT_UP = 0;
const HAT_RIGHT = 2;
const HAT_DOWN = 4;
const HAT_LEFT = 6;

/**
 * HSV -> 8-bit RGB. Saturation is held at 1 by the Lighting tab: a desaturated
 * "colour" on an LED just reads as dimmer white, so exposing it as a third axis
 * would cost a row and buy nothing perceptible on this hardware.
 */
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function RowIcon({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "2.1rem",
        height: "2.1rem",
        borderRadius: "0.5rem",
        background: "rgba(255,255,255,0.06)",
        display: "grid",
        placeItems: "center",
        color: "var(--muted)",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function Row({
  focused,
  icon,
  label,
  value,
  onClick,
}: {
  focused: boolean;
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "1rem 1.3rem",
        borderRadius: "1rem",
        background: focused ? "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.07))" : "rgba(255,255,255,0.025)",
        border: focused ? "2px solid rgba(255,255,255,0.95)" : "1px solid rgba(255,255,255,0.055)",
        display: "flex",
        alignItems: "center",
        gap: "1.15rem",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <RowIcon>{icon}</RowIcon>
      <span style={{ fontSize: "1.2rem", flex: 1 }}>{label}</span>
      <span style={{ fontSize: "1.05rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {value}
      </span>
    </div>
  );
}

/**
 * Read-only About row. Not the focusable `Row` above on purpose: About is a
 * spec sheet with nothing to activate, so giving its lines a focus ring would
 * imply a control that isn't there.
 */
function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "1rem", padding: "0.55rem 0.9rem", borderRadius: "0.6rem", background: "rgba(255,255,255,0.025)" }}>
      <span style={{ fontSize: "1rem", color: "var(--muted)", flexShrink: 0, minWidth: "11rem" }}>{label}</span>
      <span style={{ fontSize: "1rem", textAlign: "right", flex: 1, wordBreak: "break-all", fontFamily: mono ? "ui-monospace, monospace" : undefined }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 style={{ fontSize: "1.1rem", marginBottom: "0.75rem", color: "var(--muted)", fontWeight: 600, letterSpacing: "0.04em" }}>
      {children}
    </h1>
  );
}

function IconTheme() {
  return (
    <svg viewBox="0 0 24 24" width="55%" height="55%">
      <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconPalette() {
  return (
    <svg viewBox="0 0 24 24" width="55%" height="55%">
      <path d="M12 3a9 8 0 1 0 0 16c1.1 0 1.7-.9 1.2-1.8-.3-.5-.1-1.2.5-1.4A5 5 0 0 0 17 11a5 5 0 0 0 5-5c0-1.7-4-3-10-3z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="7.5" cy="10.5" r="1.1" fill="currentColor" />
      <circle cx="9.5" cy="7" r="1.1" fill="currentColor" />
    </svg>
  );
}
function IconSound() {
  return (
    <svg viewBox="0 0 24 24" width="55%" height="55%">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      <path d="M17 9a4 4 0 0 1 0 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconHaptics() {
  return (
    <svg viewBox="0 0 24 24" width="55%" height="55%">
      <rect x="7" y="4" width="10" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 9v6M21 9v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconDisplay() {
  return (
    <svg viewBox="0 0 24 24" width="55%" height="55%">
      <rect x="3" y="4" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 20h6M12 16v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconGameMode() {
  return (
    <svg viewBox="0 0 24 24" width="55%" height="55%">
      <rect x="2" y="7" width="20" height="11" rx="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="15.5" cy="10.5" r="1" fill="currentColor" />
      <circle cx="17.5" cy="13" r="1" fill="currentColor" />
      <path d="M7 10v4M5 12h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconVolume() {
  return (
    <svg viewBox="0 0 24 24" width="55%" height="55%">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
    </svg>
  );
}
function IconMute() {
  return (
    <svg viewBox="0 0 24 24" width="55%" height="55%">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      <path d="m16 9 5 6m0-6-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconWifi() {
  return (
    <svg viewBox="0 0 24 24" width="55%" height="55%">
      <path d="M4 9a12 12 0 0 1 16 0M7 12.5a8 8 0 0 1 10 0M10 16a4 4 0 0 1 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="19" r="1.2" fill="currentColor" />
    </svg>
  );
}
function IconBluetooth() {
  return (
    <svg viewBox="0 0 24 24" width="55%" height="55%">
      <path d="M8 7l8 6-4 3v-13l4 3-8 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconTouchpad() {
  return (
    <svg viewBox="0 0 24 24" width="55%" height="55%">
      <rect x="3" y="6" width="18" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 12h8M13 9l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconDpad() {
  return <svg viewBox="0 0 24 24" width="55%" height="55%"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></svg>;
}
function IconKeyboard() {
  return <svg viewBox="0 0 24 24" width="55%" height="55%"><rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M6 10h1M9 10h1M12 10h1M15 10h1M18 10h0M6 14h8M16 14h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

export function SettingsMenu({ initialTab = "Appearance", networkNotice, onRequestWifiPassword }: { initialTab?: Tab; networkNotice?: string; onRequestWifiPassword?: (network: WifiNetwork) => void }) {
  const [tabIndex, setTabIndex] = useState(() => Math.max(0, TABS.indexOf(initialTab as (typeof TABS)[number])));
  const [focus, setFocus] = useState(0);
  // Shared edge tracker — baseline seeded from the first real pad frame.
  const edges = useEdges();
  const prevStick = useRef<"up" | "down" | "left" | "right" | null>(null);
  const touchStart = useRef<{ tabIndex: number; focus: number } | null>(null);
  const [, forceUpdate] = useState(0);

  const [modes, setModes] = useState<DisplayMode[]>([]);
  const [gameMode, setGameMode] = useState(true);
  const [sensitivity, setSensitivity] = useState(1.6);
  const [homeSwipeSensitivity, setHomeSwipeSensitivity] = useState(getControllerSettings().homeSwipeSensitivity);
  const [keyboardSwipeSensitivity, setKeyboardSwipeSensitivity] = useState(getControllerSettings().keyboardSwipeSensitivity);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [sessions, setSessions] = useState<MixerSession[]>([]);
  const [wifiStatus, setWifiStatus] = useState<WifiStatus>({ connected: false });
  const [wifiScan, setWifiScan] = useState<WifiScan>({ networks: [], requires_location: false });
  const networks = wifiScan.networks;
  const [btEnabled, setBtEnabled] = useState(false);
  const [paired, setPaired] = useState<PairedDevice[]>([]);
  const [rescanStatus, setRescanStatus] = useState("Scan installed games when you choose");

  useEffect(() => {
    void invoke<DisplayMode[]>("list_display_modes").then((m) =>
      setModes([...m].sort((a, b) => b.width * b.height - a.width * a.height || b.hz - a.hz)),
    );
    void invoke<boolean>("game_mode_enabled").then(setGameMode);
    void invoke<number>("get_cursor_sensitivity").then(setSensitivity);
    const un1 = subscribeTheme(() => forceUpdate((n) => n + 1));
    const un2 = subscribeFeedbackSettings(() => forceUpdate((n) => n + 1));
    const un3 = subscribeControllerSettings(() => forceUpdate((n) => n + 1));
    const un4 = subscribePerformanceSettings(() => forceUpdate((n) => n + 1));
    return () => {
      un1();
      un2(); un3(); un4();
    };
  }, []);

  useEffect(() => setFocus(0), [tabIndex]);

  const tab = TABS[tabIndex];

  // Poll each tab's live data only while it's active ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â avoids background
  // netsh/WinRT calls running for tabs the user isn't even looking at.
  useEffect(() => {
    let cancelled = false;
    if (tab === "Audio") {
      const poll = () => {
        void invoke<number>("get_master_volume").then((v) => !cancelled && setVolume(v));
        void invoke<boolean>("get_master_mute").then((m) => !cancelled && setMuted(m));
        void invoke<MixerSession[]>("get_mixer_sessions").then((s) => !cancelled && setSessions(s));
      };
      poll();
      const id = setInterval(poll, 1000);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }
    if ((tab as string) === "Network") {
      const poll = () => {
        void invoke<WifiStatus>("wifi_status").then((s) => !cancelled && setWifiStatus(s));
      };
      poll();
      void invoke<WifiScan>("wifi_scan").then((scan) => !cancelled && setWifiScan(scan)).catch((error) => !cancelled && setWifiScan({ networks: [], requires_location: false, error: String(error) }));
      const id = setInterval(poll, 3000);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }
    if (tab === "Lighting" && !rgb) {
      // Enumerating may have to start OpenRGB, so this can take a moment.
      void invoke<RgbState>("rgb_devices").then((state) => !cancelled && setRgb(state))
        .catch((error) => !cancelled && setRgb({ available: false, message: String(error), devices: [] }));
    }
    if (tab === "About" && !sysInfo) {
      void invoke<SystemInfo>("system_info").then((info) => !cancelled && setSysInfo(info)).catch(() => {});
    }
    if (tab === "Bluetooth") {
      void invoke<boolean>("bluetooth_enabled").then((e) => !cancelled && setBtEnabled(e));
      void invoke<PairedDevice[]>("bluetooth_paired_devices").then((d) => !cancelled && setPaired(d));
    }
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const theme = getTheme();
  const feedback = getFeedbackSettings();
  const performance_ = getPerformanceSettings();
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [rgb, setRgb] = useState<RgbState | null>(null);
  const [rgbBusy, setRgbBusy] = useState(false);
  // Custom colour is held as HSV because that's what maps onto a controller:
  // hue is one continuous axis you scrub left/right, brightness another.
  // An RGB triple would need three axes and reads as nothing to a person.
  const [hue, setHue] = useState(200);
  const [brightness, setBrightness] = useState(100);

  function rowCountFor(t: Tab): number {
    if (t === "Appearance") return 2;
    if (t === "Feedback") return 2;
    if (t === "Display") return modes.length;
    if (t === "System") return 2;
    if (t === "Controller") return 3;
    if (t === "Lighting") return RGB_PRESETS.length + 3 + (rgb?.devices.length ?? 0); // presets + hue + brightness + apply + devices
    if (t === "Performance") return 4;
    if (t === "About") return 0; // read-only spec sheet, nothing to activate
    if (t === "Audio") return 3 + sessions.length; // volume, mute, device-picker, + per-app rows
    if ((t as string) === "Network") return 1 + networks.length + (wifiScan.requires_location ? 1 : 0);
    return 1 + paired.length; // Bluetooth: toggle + informational rows
  }

  useController((pad) => {
    const padEdge = edges.sync(pad);
    const edge = padEdge.shoulderEdge();
    if (edge & L1) setTabIndex((i) => Math.max(0, i - 1));
    if (edge & R1) setTabIndex((i) => Math.min(TABS.length - 1, i + 1));

    const rowCount = rowCountFor(tab);
    const hat = padEdge.hat();
    if (hat !== null) {
      if (hat === HAT_DOWN)
        setFocus((f) => {
          const next = Math.min(f + 1, rowCount - 1);
          if (next !== f) navFeedback();
          return next;
        });
      else if (hat === HAT_UP)
        setFocus((f) => {
          const next = Math.max(f - 1, 0);
          if (next !== f) navFeedback();
          return next;
        });
      else if (tab === "Audio" && focus === 0 && (hat === HAT_LEFT || hat === HAT_RIGHT)) {
        const delta = hat === HAT_RIGHT ? 0.05 : -0.05;
        setVolume((v) => {
          const next = Math.max(0, Math.min(1, v + delta));
          void invoke("set_master_volume", { level: next });
          return next;
        });
      } else if (tab === "Audio" && focus >= 3 && (hat === HAT_LEFT || hat === HAT_RIGHT)) {
        const delta = hat === HAT_RIGHT ? 0.05 : -0.05;
        const session = sessions[focus - 3];
        if (session) {
          setSessions((list) =>
            list.map((s, i) =>
              i === focus - 3 ? { ...s, volume: Math.max(0, Math.min(1, s.volume + delta)) } : s,
            ),
          );
          void invoke("set_session_volume", {
            processId: session.process_id,
            level: Math.max(0, Math.min(1, session.volume + delta)),
          });
        }
      } else if (tab === "Lighting" && (hat === HAT_LEFT || hat === HAT_RIGHT)) {
        const dir = hat === HAT_RIGHT ? 1 : -1;
        // Hue wraps: it's a colour wheel, and hitting a wall at red would be
        // wrong. Brightness clamps, since 0 and 100 are real endpoints.
        if (focus === RGB_PRESETS.length) setHue((h) => (h + dir * 10 + 360) % 360);
        else if (focus === RGB_PRESETS.length + 1) setBrightness((b) => Math.max(0, Math.min(100, b + dir * 5)));
      } else if (tab === "Controller" && (hat === HAT_LEFT || hat === HAT_RIGHT)) {
        const delta = hat === HAT_RIGHT ? 0.1 : -0.1;
        if (focus === 0) setSensitivity((s) => { const next = Math.max(0.2, Math.min(5, +(s + delta).toFixed(1))); void invoke("set_cursor_sensitivity", { value: next }); return next; });
        if (focus === 1) setHomeSwipeSensitivity((s) => { const next = Math.max(0.5, Math.min(1.8, +(s + delta).toFixed(1))); setControllerSettings({ homeSwipeSensitivity: next }); return next; });
        if (focus === 2) setKeyboardSwipeSensitivity((s) => { const next = Math.max(0.35, Math.min(1.2, +(s + delta).toFixed(2))); setControllerSettings({ keyboardSwipeSensitivity: next }); return next; });
      }
    }

    const stick = Math.abs(pad.lx - 128) > 52 ? (pad.lx > 128 ? "right" : "left") : Math.abs(pad.ly - 128) > 52 ? (pad.ly > 128 ? "down" : "up") : null;
    if (stick !== prevStick.current) {
      prevStick.current = stick;
      if (stick === "down") setFocus((f) => { const next = Math.min(f + 1, rowCount - 1); if (next !== f) navFeedback(); return next; });
      else if (stick === "up") setFocus((f) => { const next = Math.max(f - 1, 0); if (next !== f) navFeedback(); return next; });
      else if (stick === "right" || stick === "left") {
        const delta = stick === "right" ? 0.05 : -0.05;
        if (tab === "Audio" && focus === 0) setVolume((v) => { const next = Math.max(0, Math.min(1, v + delta)); void invoke("set_master_volume", { level: next }); return next; });
        else if (tab === "Controller" && focus === 0) setSensitivity((s) => { const next = Math.max(0.2, Math.min(5, +(s + (stick === "right" ? 0.1 : -0.1)).toFixed(1))); void invoke("set_cursor_sensitivity", { value: next }); return next; });
        else if (tab === "Controller" && focus === 1) setHomeSwipeSensitivity((s) => { const next = Math.max(0.5, Math.min(1.8, +(s + (stick === "right" ? 0.1 : -0.1)).toFixed(1))); setControllerSettings({ homeSwipeSensitivity: next }); return next; });
        else if (tab === "Controller" && focus === 2) setKeyboardSwipeSensitivity((s) => { const next = Math.max(0.35, Math.min(1.2, +(s + (stick === "right" ? 0.1 : -0.1)).toFixed(2))); setControllerSettings({ keyboardSwipeSensitivity: next }); return next; });
        else if (tab === "Lighting" && focus === RGB_PRESETS.length) setHue((h) => (h + (stick === "right" ? 10 : -10) + 360) % 360);
        else if (tab === "Lighting" && focus === RGB_PRESETS.length + 1) setBrightness((b) => Math.max(0, Math.min(100, b + (stick === "right" ? 5 : -5))));
        else if (tab === "Audio" && focus >= 3) { const session = sessions[focus - 3]; if (session) { const next = Math.max(0, Math.min(1, session.volume + delta)); setSessions((list) => list.map((item, index) => index === focus - 3 ? { ...item, volume: next } : item)); void invoke("set_session_volume", { processId: session.process_id, level: next }); } }
      }
    }
    if (padEdge.rising("cross")) {
      selectFeedback();
      if (tab === "Appearance") {
        if (focus === 0) setTheme({ mode: getTheme().mode === "dark" ? "light" : "dark" });
        else if (focus === 1) {
          const i = ACCENTS.indexOf(getTheme().accent);
          setTheme({ accent: ACCENTS[(i + 1) % ACCENTS.length] });
        }
      } else if (tab === "Feedback") {
        if (focus === 0) setFeedbackSettings({ soundEnabled: !getFeedbackSettings().soundEnabled });
        else if (focus === 1) setFeedbackSettings({ hapticsEnabled: !getFeedbackSettings().hapticsEnabled });
      } else if (tab === "Lighting") {
        if (focus < RGB_PRESETS.length) {
          const preset = RGB_PRESETS[focus];
          setRgbBusy(true);
          void invoke("set_rgb_scene", { scene: preset.id })
            .then(() => setRgb((r) => (r ? { ...r, message: `Applied ${preset.label}` } : r)))
            .catch((error) => setRgb((r) => (r ? { ...r, message: String(error) } : { available: false, message: String(error), devices: [] })))
            .finally(() => setRgbBusy(false));
        } else if (focus === RGB_PRESETS.length || focus === RGB_PRESETS.length + 1 || focus === RGB_PRESETS.length + 2) {
          // Cross anywhere in the custom-colour block applies it to everything.
          const [r, g, b] = hsvToRgb(hue, 1, brightness / 100);
          setRgbBusy(true);
          const targets = rgb?.devices ?? [];
          void Promise.all(targets.map((d) => invoke("set_rgb_device_color", { index: d.index, red: r, green: g, blue: b })))
            .then(() => setRgb((state) => state && ({ ...state, message: targets.length ? `Applied custom colour to ${targets.length} device(s)` : "No devices to apply to" })))
            .catch((error) => setRgb((state) => (state ? { ...state, message: String(error) } : { available: false, message: String(error), devices: [] })))
            .finally(() => setRgbBusy(false));
        } else {
          // Cross on a device cycles to its next reported mode. Modes are read
          // from the device, never hardcoded - different hardware exposes
          // wildly different sets.
          const device = rgb?.devices[focus - RGB_PRESETS.length - 3];
          if (device && device.modes.length > 0) {
            const next = device.modes[(device.modes.findIndex((m) => m.index === device.active_mode) + 1) % device.modes.length];
            setRgbBusy(true);
            void invoke("set_rgb_device_mode", { index: device.index, mode: next.index })
              .then(() => setRgb((r) => r && ({ ...r, devices: r.devices.map((d) => d.index === device.index ? { ...d, active_mode: next.index } : d) })))
              .catch((error) => setRgb((r) => (r ? { ...r, message: String(error) } : r)))
              .finally(() => setRgbBusy(false));
          }
        }
      } else if (tab === "Performance") {
        const perf = getPerformanceSettings();
        if (focus === 0) setPerformanceSettings({ perfHud: !perf.perfHud });
        else if (focus === 1) setPerformanceSettings({ reduceMotion: !perf.reduceMotion });
        else if (focus === 2) setPerformanceSettings({ heroRotation: !perf.heroRotation });
        else if (focus === 3) setPerformanceSettings({ idleRotation: !perf.idleRotation });
      } else if (tab === "Display") {
        if (modes[focus]) void invoke("set_display_mode", { mode: modes[focus] });
      } else if (tab === "System") {
        if (focus === 0) {
          setGameMode((g) => {
            void invoke("set_game_mode_enabled", { on: !g });
            return !g;
          });
        } else if (focus === 1) {
          setRescanStatus("Scanning installed games…");
          void invoke<{ apps: Array<unknown> }>("sync_game_library", { roots: ["E:\\"] })
            .then((config) => setRescanStatus(`Found ${config.apps.length} launchable items`))
            .catch(() => setRescanStatus("Scan failed — check the configured game drive"));
        }
      } else if (tab === "Audio" && focus === 1) {
        setMuted((m) => {
          void invoke("set_master_mute", { muted: !m });
          return !m;
        });
      } else if (tab === "Audio" && focus === 2) {
        void invoke("open_audio_device_picker");
      } else if (tab === "Audio" && focus >= 3) {
        const session = sessions[focus - 3];
        if (session) {
          setSessions((list) =>
            list.map((s, i) => (i === focus - 3 ? { ...s, muted: !s.muted } : s)),
          );
          void invoke("set_session_mute", { processId: session.process_id, muted: !session.muted });
        }
} else if ((tab as string) === "Network") {
        if (focus === 0) {
          if (wifiStatus.connected) void invoke("wifi_disconnect");
          else void invoke<WifiScan>("wifi_scan").then(setWifiScan);
        } else if (wifiScan.requires_location && focus === 1) {
          void invoke("open_location_settings");
        } else {
          const networkIndex = focus - 1 - (wifiScan.requires_location ? 1 : 0);
          const net = networks[networkIndex];
          if (net?.known) void invoke("wifi_connect", { ssid: net.ssid });
          else if (net?.security === "Open") void invoke("wifi_connect", { ssid: net.ssid, security: net.security });
          else if (net) onRequestWifiPassword?.(net);
        }
      } else if (tab === "Bluetooth" && focus === 0) {
        setBtEnabled((e) => {
          void invoke("set_bluetooth_enabled", { on: !e });
          return !e;
        });
      }
    }
  });

  useTouchpad((drag) => {
    if (!drag.active) { touchStart.current = null; return; }
    if (!touchStart.current) touchStart.current = { tabIndex, focus };
    const start = touchStart.current;
    const nextTabIndex = Math.max(0, Math.min(TABS.length - 1, start.tabIndex + Math.round(drag.dx / 560)));
    const nextTab = TABS[nextTabIndex];
    const maxFocus = Math.max(0, rowCountFor(nextTab) - 1);
    const nextFocus = Math.max(0, Math.min(maxFocus, start.focus + Math.round(drag.dy / 160)));
    setTabIndex(nextTabIndex);
    setFocus(nextFocus);
  });
  return (
    <CodexPanelShell eyebrow="SYSTEM" title="Settings" subtitle="Tune the room, the controller, and this PC."><div style={{ height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        {TABS.map((t, i) => (
          <div
            key={t}
            style={{
              padding: "0.4rem 1.2rem",
              borderRadius: "999px",
              background: i === tabIndex ? "var(--tile-focus)" : "transparent",
              color: i === tabIndex ? "var(--accent)" : "var(--muted)",
              fontSize: "1.1rem",
              fontWeight: 600,
            }}
          >
            {t}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "hidden" }}>
        {tab === "Appearance" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <Row focused={focus === 0} icon={<IconTheme />} label="Theme" value={theme.mode === "dark" ? "Dark" : "Light"} />
            <Row
              focused={focus === 1}
              icon={<IconPalette />}
              label="Accent color"
              value={
                <>
                  <span style={{ width: "1rem", height: "1rem", borderRadius: "50%", background: ACCENT_SWATCHES[theme.accent], display: "inline-block" }} />
                  {theme.accent[0].toUpperCase() + theme.accent.slice(1)}
                </>
              }
            />
          </div>
        )}

        {tab === "Feedback" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <Row focused={focus === 0} icon={<IconSound />} label="Sound effects" value={feedback.soundEnabled ? "On" : "Off"} />
            <Row focused={focus === 1} icon={<IconHaptics />} label="Controller haptics" value={feedback.hapticsEnabled ? "On" : "Off"} />
          </div>
        )}

        {tab === "Lighting" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem", overflowY: "auto", maxHeight: "100%", paddingRight: "0.5rem" }}>
            <div>
              <SectionTitle>SCENES</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {RGB_PRESETS.map((preset, i) => (
                  <Row key={preset.id} focused={focus === i} icon={<IconPalette />} label={preset.label}
                    value={<span style={{ width: "1rem", height: "1rem", borderRadius: "50%", background: preset.swatch, display: "inline-block", border: "1px solid rgba(255,255,255,.25)" }} />} />
                ))}
              </div>
            </div>

            <div>
              <SectionTitle>CUSTOM COLOUR</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {/* Hue strip: the full wheel drawn as a gradient with a marker
                    at the current value, so the control is readable at 10 feet
                    instead of being a bare number. */}
                <Row focused={focus === RGB_PRESETS.length} icon={<IconPalette />} label="Hue"
                  value={<span style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ position: "relative", width: "14rem", height: "0.85rem", borderRadius: "0.45rem", border: "1px solid rgba(255,255,255,.18)", background: "linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }}>
                      <span style={{ position: "absolute", top: "-0.22rem", bottom: "-0.22rem", left: `calc(${(hue / 360) * 100}% - 0.15rem)`, width: "0.3rem", borderRadius: "0.15rem", background: "#fff", boxShadow: "0 0 0 1px rgba(0,0,0,.5)" }} />
                    </span>
                    <span style={{ fontVariantNumeric: "tabular-nums", minWidth: "3rem", textAlign: "right" }}>{hue}&deg;</span>
                  </span>} />
                <Row focused={focus === RGB_PRESETS.length + 1} icon={<IconPalette />} label="Brightness"
                  value={<span style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ position: "relative", width: "14rem", height: "0.85rem", borderRadius: "0.45rem", border: "1px solid rgba(255,255,255,.18)", background: `linear-gradient(90deg,#000,hsl(${hue} 100% 50%))` }}>
                      <span style={{ position: "absolute", top: "-0.22rem", bottom: "-0.22rem", left: `calc(${brightness}% - 0.15rem)`, width: "0.3rem", borderRadius: "0.15rem", background: "#fff", boxShadow: "0 0 0 1px rgba(0,0,0,.5)" }} />
                    </span>
                    <span style={{ fontVariantNumeric: "tabular-nums", minWidth: "3rem", textAlign: "right" }}>{brightness}%</span>
                  </span>} />
                <Row focused={focus === RGB_PRESETS.length + 2} icon={<IconPalette />} label="Apply to all devices"
                  value={<span style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ width: "1.5rem", height: "1.5rem", borderRadius: "0.4rem", border: "1px solid rgba(255,255,255,.25)", background: `rgb(${hsvToRgb(hue, 1, brightness / 100).join(",")})` }} />
                    {rgbBusy ? "..." : "Cross"}
                  </span>} />
              </div>
            </div>

            <div>
              <SectionTitle>DEVICES</SectionTitle>
              {!rgb && <InfoRow label="OpenRGB" value="Connecting..." />}
              {/* A missing OpenRGB is a normal state here, not a crash - it
                  doesn't run at boot. Show what's wrong and stay usable. */}
              {rgb && !rgb.available && <InfoRow label="OpenRGB" value={rgb.message ?? "Unavailable"} />}
              {rgb?.available && rgb.devices.length === 0 && <InfoRow label="OpenRGB" value="Connected, but no devices detected" />}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {rgb?.devices.map((device, i) => {
                  const activeName = device.modes.find((m) => m.index === device.active_mode)?.name ?? "-";
                  return <Row key={device.index} focused={focus === RGB_PRESETS.length + i} icon={<IconPalette />}
                    label={`${device.name}  (${device.kind}, ${device.led_count} LEDs)`}
                    value={rgbBusy ? "..." : activeName} />;
                })}
              </div>
              {rgb?.available && rgb.message && <p style={{ margin: "0.6rem 0 0", fontSize: "0.95rem", color: "var(--muted)" }}>{rgb.message}</p>}
            </div>
          </div>
        )}

        {tab === "About" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem", overflowY: "auto", maxHeight: "100%", paddingRight: "0.5rem" }}>
            <div>
              <SectionTitle>SYSTEM</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {sysInfo?.cpu && <InfoRow label="Processor" value={sysInfo.cpu_cores ? `${sysInfo.cpu} (${sysInfo.cpu_cores} cores)` : sysInfo.cpu} />}
                {sysInfo?.gpus.map((gpu) => <InfoRow key={gpu} label="Graphics" value={gpu} />)}
                {sysInfo?.memory_total ? <InfoRow label="Memory" value={`${(sysInfo.memory_total / 1024 ** 3).toFixed(1)} GB`} /> : null}
                {sysInfo?.os_name && <InfoRow label="System" value={[sysInfo.os_name, sysInfo.os_version].filter(Boolean).join(" ")} />}
                {sysInfo?.kernel_version && <InfoRow label="Build" value={sysInfo.kernel_version} />}
                {!sysInfo && <InfoRow label="System" value="Reading..." />}
              </div>
            </div>

            <div>
              <SectionTitle>PS5 MODE</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <InfoRow label="Version" value={sysInfo?.app_version ?? "-"} />
                {/* WebView2 is the renderer; a version mismatch is a real
                    failure mode, so it's worth being able to read off here. */}
                <InfoRow label="WebView2 runtime" value={sysInfo?.webview_version ?? "unknown"} />
                {sysInfo?.config_path && <InfoRow label="Config" value={sysInfo.config_path} mono />}
              </div>
            </div>

            <div>
              <SectionTitle>ART CREDITS</SectionTitle>
              <p style={{ margin: "0 0 0.6rem", fontSize: "0.95rem", color: "var(--muted)", lineHeight: 1.5 }}>
                Hero and idle artwork is the work of these artists, sourced from ArtStation.
                Used here in a personal, non-commercial launcher.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {ART_CREDITS.map((name) => (
                  <span key={name} style={{ padding: "0.4rem 0.75rem", borderRadius: "0.6rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", fontSize: "0.95rem" }}>{name}</span>
                ))}
              </div>
            </div>

            <div>
              <SectionTitle>LICENSES</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {THIRD_PARTY.map((item) => (
                  <InfoRow key={item.name} label={`${item.name} - ${item.what}`} value={item.license} />
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "Performance" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <Row focused={focus === 0} icon={<IconDisplay />} label="Performance overlay" value={performance_.perfHud ? "On" : "Off"} />
            <Row focused={focus === 1} icon={<IconDisplay />} label="Reduce motion" value={performance_.reduceMotion ? "On" : "Off"} />
            <Row focused={focus === 2} icon={<IconDisplay />} label="Hero art rotation" value={performance_.heroRotation ? "On" : "Off"} />
            <Row focused={focus === 3} icon={<IconDisplay />} label="Idle art rotation" value={performance_.idleRotation ? "On" : "Off"} />
          </div>
        )}

        {tab === "Display" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {modes.map((m, i) => (
              <Row key={i} focused={focus === i} icon={<IconDisplay />} label={`${m.width} x ${m.height}`} value={`${m.hz} Hz`} />
            ))}
          </div>
        )}

        {tab === "System" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <Row focused={focus === 0} icon={<IconGameMode />} label="Game Mode" value={gameMode ? "On" : "Off"} />
            <Row focused={focus === 1} icon={<IconGameMode />} label="Rescan Games" value={rescanStatus} onClick={() => {
              setRescanStatus("Scanning installed games…");
              void invoke<{ apps: Array<unknown> }>("sync_game_library", { roots: ["E:\\"] })
                .then((config) => setRescanStatus(`Found ${config.apps.length} launchable items`))
                .catch(() => setRescanStatus("Scan failed — check the configured game drive"));
            }} />
          </div>
        )}

        {tab === "Controller" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <Row
              focused={focus === 0}
              icon={<IconTouchpad />}
              label="Trackpad mouse sensitivity"
              value={
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <div style={{ width: "8rem", height: "0.4rem", borderRadius: "999px", background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
                    <div style={{ width: `${Math.round((sensitivity / 5) * 100)}%`, height: "100%", background: "var(--accent)" }} />
                  </div>
                  {sensitivity.toFixed(1)}x
                </div>
              }
            />
            <Row focused={focus === 1} icon={<IconDpad />} label="Home swipe sensitivity" value={`${homeSwipeSensitivity.toFixed(1)}x`} />
            <Row focused={focus === 2} icon={<IconKeyboard />} label="Keyboard swipe sensitivity" value={`${keyboardSwipeSensitivity.toFixed(2)}x`} />
          </div>
        )}

        {tab === "Audio" && (
          <>
            <SectionTitle>OUTPUT</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <Row
                focused={focus === 0}
                icon={<IconVolume />}
                label="Master volume"
                value={
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <div style={{ width: "8rem", height: "0.4rem", borderRadius: "999px", background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
                      <div style={{ width: `${Math.round(volume * 100)}%`, height: "100%", background: "var(--accent)" }} />
                    </div>
                    {Math.round(volume * 100)}%
                  </div>
                }
              />
              <Row focused={focus === 1} icon={<IconMute />} label="Mute" value={muted ? "On" : "Off"} />
              <Row focused={focus === 2} icon={<IconVolume />} label="Output device" value="Change..." />
            </div>

            {sessions.length > 0 && (
              <>
                <SectionTitle>APP VOLUMES</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  {sessions.map((s, i) => (
                    <Row
                      key={s.process_id}
                      focused={focus === i + 3}
                      icon={<IconVolume />}
                      label={s.name}
                      value={
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <div style={{ width: "8rem", height: "0.4rem", borderRadius: "999px", background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
                            <div style={{ width: `${Math.round(s.volume * 100)}%`, height: "100%", background: "var(--accent)" }} />
                          </div>
                          {s.muted ? "Muted" : `${Math.round(s.volume * 100)}%`}
                        </div>
                      }
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {(tab as string) === "Network" && (
          <>
            <SectionTitle>WI-FI</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <Row
                focused={focus === 0}
                icon={<IconWifi />}
                label={wifiStatus.connected ? wifiStatus.ssid ?? "Connected" : "Not connected"}
                value={wifiStatus.connected ? `${wifiStatus.signal_percent ?? 0}% / disconnect` : "refresh"}
              />
{wifiScan.requires_location && <Row focused={focus === 1} icon={<IconWifi />} label="Allow Wi-Fi scanning" value="Open Location settings" />}
              {networks.map((n, i) => (
                <Row
                  key={n.ssid + i}
                  focused={focus === i + 1 + (wifiScan.requires_location ? 1 : 0)}
                  icon={<IconWifi />}
                  label={n.ssid}
                  value={`${n.signal_percent}% / ${n.known ? "saved" : n.security}`}
                />
              ))}
              {wifiScan.error && <div style={{ color: "#ffd58a", padding: "0.9rem 1.2rem", lineHeight: 1.45 }}>{wifiScan.error}</div>}
              {networkNotice && <div style={{ color: "#b8e6ff", padding: "0.9rem 1.2rem", lineHeight: 1.45 }}>{networkNotice}</div>}
              {networks.length === 0 && !wifiScan.error && <div style={{ color: "var(--muted)", padding: "0.9rem 1.2rem" }}>No networks found. Press Cross to refresh.</div>}
            </div>
          </>
        )}

        {tab === "Bluetooth" && (
          <>
            <SectionTitle>BLUETOOTH</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <Row focused={focus === 0} icon={<IconBluetooth />} label="Bluetooth" value={btEnabled ? "On" : "Off"} />
              {paired.map((d, i) => (
                <Row key={d.name + i} focused={focus === i + 1} icon={<IconBluetooth />} label={d.name} value={d.connected ? "Connected" : "Paired"} />
              ))}
              {btEnabled && paired.length === 0 && (
                <div style={{ color: "var(--muted)", padding: "0.9rem 1.2rem" }}>No paired devices.</div>
              )}
            </div>
          </>
        )}
      </div>

      <ButtonHints
        hints={[
          { glyph: "dpad", label: "Navigate" },
          { glyph: "cross", label: "Apply / Toggle" },
          { glyph: "L1/R1", label: "Switch tab" },
          { glyph: "circle", label: "Back" },
          { glyph: "options", label: "Exit (x3)" },
        ]}
      />
    </div></CodexPanelShell>
  );
}
