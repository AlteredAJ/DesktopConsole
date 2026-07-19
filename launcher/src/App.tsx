import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { CodexLauncher } from "./components/CodexLauncher";
import { IdleScreen } from "./components/IdleScreen";
import { StartupScreen } from "./components/StartupScreen";
import { useController, PadState } from "./hooks/useController";
import { startupFeedback } from "./feedback";

// Code-split everything that ISN'T the grid ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â the grid is what's on screen
// on every single launch (triple-click PS spawns straight into it), so it
// stays in the main chunk; Settings/Search/YouTube/Keyboard only need to
// parse+eval once the user actually navigates to them, not before first paint.
const YouTubeEmbed = lazy(() => import("./components/YouTubeEmbed").then((m) => ({ default: m.YouTubeEmbed })));
const SettingsMenu = lazy(() => import("./components/SettingsMenu").then((m) => ({ default: m.SettingsMenu })));
const VirtualKeyboard = lazy(() => import("./components/VirtualKeyboard").then((m) => ({ default: m.VirtualKeyboard })));
const Search = lazy(() => import("./components/Search").then((m) => ({ default: m.Search })));

export type Panel = "grid" | "youtube" | "settings" | "network" | "keyboard" | "wifi-password" | "search";

interface WifiRequest {
  ssid: string;
  security: string;
}

const IDLE_MS = 10 * 60 * 1000; // 10 minutes
const STICK_CENTER = 128;
const STICK_DEADZONE = 24; // ADC jitter noise floor ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â real stick input only

function isMeaningfulInput(pad: PadState): boolean {
  if (pad.cross || pad.circle || pad.triangle || pad.options || pad.ps || pad.touchpad_btn) return true;
  if (pad.dpad !== 8) return true; // 8 = neutral hat
  if (pad.touch_active) return true;
  const stickMoved = (v: number) => Math.abs(v - STICK_CENTER) > STICK_DEADZONE;
  return stickMoved(pad.lx) || stickMoved(pad.ly) || stickMoved(pad.rx) || stickMoved(pad.ry);
}

export function App() {
  const [panel, setPanel] = useState<Panel>("grid");
  const [homeReady, setHomeReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const [startupLeaving, setStartupLeaving] = useState(false);
  const [wifiRequest, setWifiRequest] = useState<WifiRequest | null>(null);
  const [networkNotice, setNetworkNotice] = useState<string | undefined>();
  const [idle, setIdle] = useState(false);
  const prevOptions = useRef(false);
  const prevCircle = useRef(false);
  const prevStartupPs = useRef(false);
  const prevIdlePs = useRef(false);
  const startupTimer = useRef<number | undefined>(undefined);
  const lastActivity = useRef(Date.now());
  const idleRef = useRef(false);
  idleRef.current = idle;
  // Bumped on every restore so the `key` below remounts and replays the
  // entrance animation ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â the webview never actually unmounts across
  // minimize/restore, so without this the "open" feel would only ever play
  // once, on the very first triple-click spawn.
  const [enterKey, setEnterKey] = useState(0);

  // Keep the native window hidden through WebView2's blank first frame, then
  // reveal it only after React has painted the entry screen twice.
  useEffect(() => {
    const first = requestAnimationFrame(() => {
      requestAnimationFrame(() => void invoke("show_console_window"));
    });
    return () => cancelAnimationFrame(first);
  }, []);
  useEffect(() => {
    const un = listen("window-restored", () => setEnterKey((k) => k + 1));
    return () => {
      un.then((f) => f());
    };
  }, []);

  // Global controller stream: Circle backs out to the grid from anywhere,
  // a single Options tap opens Settings from anywhere (edge-triggered ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â see
  // Launcher.tsx's comment on why held buttons must be edge-detected, not
  // level-checked). Options is ALSO watched independently on the backend for
  // triple-click / PS+Options exit ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â those are separate systems reacting to
  // the same physical button, not a conflict: a quick single tap opens the
  // menu, holding it with PS or tapping it three times still exits.
  // No on-screen "Menu"/"Exit" buttons anymore ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â there's no cursor most of the
  // time, so those were dead UI; this is the real, controller-reachable path.
  useController((pad) => {
    if (!entered && panel === "grid") {
      if (homeReady && !startupLeaving && pad.ps && !prevStartupPs.current) {
        setStartupLeaving(true);
        startupFeedback();
        startupTimer.current = window.setTimeout(() => {
          setEntered(true);
          setStartupLeaving(false);
        }, 760);
      }
      prevStartupPs.current = pad.ps;
      return;
    }
    prevStartupPs.current = pad.ps;
    if (idleRef.current) {
      // Rest/idle uses PS as its deliberate wake control, so a bumped stick
      // never accidentally drops the user back into the dashboard.
      if (pad.ps && !prevIdlePs.current) {
        setIdle(false);
        void invoke("exit_idle_power_save");
      }
      prevIdlePs.current = pad.ps;
      return;
    }
    prevIdlePs.current = false;
    if (isMeaningfulInput(pad)) lastActivity.current = Date.now();
    if (pad.circle && !prevCircle.current && panel !== "grid") {
      setPanel(panel === "wifi-password" ? "settings" : "grid");
    }
    if (pad.options && !prevOptions.current && panel !== "settings") setPanel("settings");
    prevOptions.current = pad.options;
    prevCircle.current = pad.circle;

  });

  // Idle detection: analog stick jitter alone must never keep this armed
  // forever (see isMeaningfulInput's deadzone) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â checked on a slow interval
  // rather than per-frame since a 10-minute threshold doesn't need precision.
  useEffect(() => {
    const id = setInterval(() => {
      if (!idleRef.current && Date.now() - lastActivity.current >= IDLE_MS) {
        setIdle(true);
        void invoke("enter_idle_power_save");
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div key={enterKey} className={entered ? "app-enter" : "app-shell"} style={{ height: "100%", containerType: "size", background: "#05060a" }}>
      {panel === "grid" && <CodexLauncher onOpen={setPanel} onReady={() => setHomeReady(true)} onRest={() => { setIdle(true); void invoke("enter_idle_power_save"); }} inputEnabled={entered} />}
      {panel === "grid" && !entered && <StartupScreen ready={homeReady} leaving={startupLeaving} />}
      {/* Suspense fallback is invisible (null) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â these panels are tiny
          compiled chunks (a few KB each) fetched from local disk, not a
          network round-trip, so a loading spinner would just flash. */}
      <Suspense fallback={null}>
        {panel === "youtube" && <YouTubeEmbed />}
        {panel === "settings" && <SettingsMenu initialTab="Appearance" networkNotice={networkNotice} onRequestWifiPassword={(network) => { setNetworkNotice(undefined); setWifiRequest(network); setPanel("wifi-password"); }} />}
        {panel === "wifi-password" && wifiRequest && <VirtualKeyboard title="Wi-Fi password" subtitle={`Enter the password for ${wifiRequest.ssid}. Shift cycles letters, capitals, and symbols.`} placeholder="Enter network password..." secret onDone={(password) => { const request = wifiRequest; void invoke("wifi_connect", { ssid: request.ssid, password, security: request.security }).then(() => { setNetworkNotice(`Connecting to ${request.ssid}…`); setWifiRequest(null); setPanel("settings"); }).catch((error) => { setNetworkNotice(String(error)); setPanel("settings"); }); }} />}
        {panel === "keyboard" && <VirtualKeyboard onDone={() => setPanel("grid")} />}
        {panel === "search" && <Search onOpen={setPanel} />}
      </Suspense>
      {idle && <IdleScreen />}
    </div>
  );
}
