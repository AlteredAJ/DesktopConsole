import { type CSSProperties, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useController } from "../hooks/useController";
import { useEdges } from "../hooks/useEdges";
import { navFeedback, selectFeedback, errorFeedback } from "../feedback";
import { ACCENT_SWATCHES, getTheme, subscribeTheme } from "../theme";

type OverlayItem = {
  id: "resume" | "audio" | "controller" | "party" | "capture" | "rgb" | "home";
  label: string;
  detail: string;
  glyph: string;
};

const GAME_ITEMS: OverlayItem[] = [
  { id: "resume", glyph: "▶", label: "Resume", detail: "Return to your game" },
  { id: "audio", glyph: "◖", label: "Sound", detail: "Quick audio controls" },
  { id: "controller", glyph: "◎", label: "Controller", detail: "DualSense settings" },
  { id: "party", glyph: "◌", label: "Game Base", detail: "Friends and parties" },
  { id: "capture", glyph: "▣", label: "Capture", detail: "Clips and screenshots" },
  { id: "rgb", glyph: "✦", label: "RGB", detail: "PC lighting controls" },
  { id: "home", glyph: "⌂", label: "Console Home", detail: "Open the full dashboard" },
];

const APP_ITEMS: OverlayItem[] = [
  { id: "resume", glyph: "▶", label: "Back to app", detail: "Dismiss the quick menu" },
  { id: "audio", glyph: "◖", label: "Sound", detail: "Quick audio controls" },
  { id: "controller", glyph: "◎", label: "Controller", detail: "DualSense settings" },
  { id: "party", glyph: "◌", label: "Game Base", detail: "Friends and parties" },
  { id: "capture", glyph: "▣", label: "Capture", detail: "Clips and screenshots" },
  { id: "rgb", glyph: "✦", label: "RGB", detail: "PC lighting controls" },
  { id: "home", glyph: "⌂", label: "Console Home", detail: "Open the full dashboard" },
];

const RGB_SCENES = ["ice", "violet", "warm", "off"] as const;
const RGB_LABELS: Record<(typeof RGB_SCENES)[number], string> = { ice: "Ice", violet: "Violet", warm: "Warm", off: "Off" };

function BatteryMeter({ level, charging }: { level: number; charging: boolean }) {
  const fill = Math.max(1.5, Math.round(level / 10) * 1.45);
  return <span title={`DualSense battery: about ${level}%`} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><svg viewBox="0 0 28 16" aria-hidden="true" style={{ width: 25, height: 14, fill: "none", stroke: "#d7eeff", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }}><rect x="1" y="2" width="23" height="12" rx="2.5" /><path d="M26 6v4" /><rect x="3.4" y="4.3" width={fill} height="7.4" rx="1.1" fill="#d7eeff" stroke="none" />{charging && <path d="m14 3.4-3.3 5h2.55L12.4 13l4.5-6h-2.6l1-3.6Z" fill="#14284a" stroke="none" />}</svg><span>~{level}%</span></span>;
}

export function QuickOverlay() {
  const [selected, setSelected] = useState(0);
  const [notice, setNotice] = useState("Quick menu");
  const [context, setContext] = useState("desktop");
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [battery, setBattery] = useState<number | null>(null);
  const [charging, setCharging] = useState(false);
  const [time, setTime] = useState(() => new Date());
  const [, setThemeRevision] = useState(0);
  const [rgbScene, setRgbScene] = useState<(typeof RGB_SCENES)[number]>("ice");
  // Edge baseline is adopted from the first real pad frame (useEdges), not
  // assumed to be "nothing pressed" — the overlay is summoned by a double-PS
  // with a hand on the pad, and the old assumption ate the first press.
  const edges = useEdges();
  const previousStick = useRef<"left" | "right" | null>(null);

  const items = context.startsWith("game:") ? GAME_ITEMS : APP_ITEMS;
  // Controller input is only valid when the Rust backend explicitly shows the
  // overlay. Without this, a prewarmed-but-hidden overlay that somehow receives
  // a stray pad-state frame (e.g. after a crash/recovery cycle) would process
  // Cross presses in the background — cycling RGB, opening YouTube, etc.
  const quickMenuActive = useRef(false);
  useEffect(() => {
    const un = listen<boolean>("quick-menu-active", (event) => {
      quickMenuActive.current = event.payload;
    });
    return () => { void un.then((f) => f()); };
  }, []);

  const move = (delta: number) => {
    setSelected((current) => (current + delta + items.length) % items.length);
    navFeedback();
  };

  const activate = (item: OverlayItem) => {
    selectFeedback();
    if (item.id === "resume") return void invoke(context === "desktop" ? "minimize_console" : "hide_quick_overlay_command");
    if (item.id === "home") return void invoke("open_console_home");
    if (item.id === "audio") { const next = !muted; setMuted(next); setNotice(next ? "System audio muted" : "System audio unmuted"); return void invoke("set_master_mute", { muted: next }); }
    if (item.id === "rgb") {
      const next = RGB_SCENES[(RGB_SCENES.indexOf(rgbScene) + 1) % RGB_SCENES.length];
      setRgbScene(next);
      setNotice(`RGB scene: ${RGB_LABELS[next]}`);
      return void invoke("set_rgb_scene", { scene: next }).catch((error) => { errorFeedback(); setNotice(String(error).replace(/^Error:\s*/, "")); });
    }
    if (item.id === "party") { setNotice("Game Base needs a linked provider — Discord, Steam, or Xbox"); return; }
    setNotice(`${item.label} is prepared for the next overlay pass`);
  };

  useController((pad) => {
    if (!quickMenuActive.current) return; // dormant — ignore all input
    const edge = edges.sync(pad); // always sample first — never behind a return
    if (typeof pad.battery_percent === "number") setBattery(pad.battery_percent);
    if (typeof pad.charging === "boolean") setCharging(pad.charging);
    const hat = edge.hat();
    if (hat !== null) {
      if (items[selected]?.id === "audio" && (hat === 0 || hat === 4)) {
        const next = Math.max(0, Math.min(1, volume + (hat === 0 ? 0.05 : -0.05)));
        setVolume(next); void invoke("set_master_volume", { level: next }); setNotice(`Volume ${Math.round(next * 100)}%`); return;
      }
      if (hat === 6) move(-1);
      if (hat === 2) move(1);
    }
    const stick = Math.abs(pad.lx - 128) > 56 ? (pad.lx > 128 ? "right" : "left") : null;
    if (stick !== previousStick.current) {
      previousStick.current = stick;
      if (stick === "left") move(-1);
      if (stick === "right") move(1);
    }
    if (edge.rising("cross")) activate(items[selected]);
    if (edge.rising("circle")) void invoke("hide_quick_overlay_command");
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNotice("Quick menu"), 7000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { void invoke<number>("get_master_volume").then(setVolume); void invoke<boolean>("get_master_mute").then(setMuted); const timer = window.setInterval(() => setTime(new Date()), 1000); const unsubscribe = subscribeTheme(() => setThemeRevision((revision) => revision + 1)); return () => { window.clearInterval(timer); unsubscribe(); }; }, []);
  useEffect(() => { void invoke<string>("get_overlay_context").then(setContext).catch(() => setContext("desktop")); }, []);

  const theme = getTheme();
  return <main className="quick-overlay" aria-label="PS5 Mode quick menu" style={{ "--quick-accent": ACCENT_SWATCHES[theme.accent] } as CSSProperties}>
    <div className="quick-overlay__scrim" />
    <section className="quick-overlay__panel">
      <div className="quick-overlay__head"><span className="quick-overlay__ps">PS</span><span>{context.startsWith("game:") ? "GAME SESSION" : "APP CONTROLS"}</span><small>{notice}</small><aside className="quick-overlay__status" style={{ background: "transparent", border: 0, padding: 0, boxShadow: "none", gap: 8 }}><b className="quick-overlay__time" style={{ padding: "7px 10px", border: "1px solid rgba(255,255,255,.18)", borderRadius: 13, background: "rgba(255,255,255,.08)" }}>{time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</b>{battery === null ? <span className="quick-overlay__battery-pill" style={{ padding: "7px 10px", border: "1px solid rgba(255,255,255,.18)", borderRadius: 13, background: "rgba(255,255,255,.08)" }}>DualSense</span> : <span className="quick-overlay__battery-pill" style={{ padding: "7px 10px", border: "1px solid rgba(255,255,255,.18)", borderRadius: 13, background: "rgba(255,255,255,.08)" }}><BatteryMeter level={battery} charging={charging} /></span>}</aside></div>
      <div className="quick-overlay__items">
        {items.map((item, index) => <button key={item.id} className={`quick-overlay__item ${index === selected ? "is-selected" : ""}`} style={index === selected ? { background: `linear-gradient(145deg, color-mix(in srgb, var(--quick-accent) 78%, white), var(--quick-accent) 54%, rgba(32,42,94,.72))`, boxShadow: `0 0 0 3px color-mix(in srgb, var(--quick-accent) 34%, transparent), 0 17px 42px color-mix(in srgb, var(--quick-accent) 48%, transparent), inset 0 1px rgba(255,255,255,.74)` } : undefined} onClick={() => activate(item)}>
          <i>{item.glyph}</i><span><b>{item.label}</b><em>{item.id === "audio" ? (muted ? "Muted — ✕ to unmute" : `${Math.round(volume * 100)}% — ↑/↓ adjust`) : item.detail}</em></span>
        </button>)}
      </div>
      <footer><span><b>✕</b> Select</span><span><b>○</b> Close</span><span><b>PS ×2</b> Toggle overlay</span></footer>
    </section>
  </main>;
}

const overlayCss = `
.quick-overlay{position:fixed;inset:0;display:grid;place-items:end center;padding:0 0 5.4vh;overflow:hidden;color:#f8fbff;font-family:Manrope,system-ui,sans-serif;pointer-events:none}
.quick-overlay__scrim{position:absolute;inset:0;background:radial-gradient(ellipse 62% 54% at 50% 96%,rgba(70,149,255,.42),transparent 70%),radial-gradient(ellipse at 12% 5%,rgba(184,224,255,.13),transparent 41%),linear-gradient(180deg,rgba(3,8,17,.11),rgba(3,8,17,.5));backdrop-filter:blur(5px) saturate(118%)}
.quick-overlay__panel{isolation:isolate;position:relative;width:min(94vw,1160px);padding:27px 32px 22px;border:1px solid rgba(224,242,255,.46);border-radius:32px;background:linear-gradient(120deg,rgba(255,255,255,.16),rgba(89,145,226,.12) 31%,rgba(13,23,52,.76) 68%,rgba(8,11,25,.86));backdrop-filter:blur(42px) saturate(165%);-webkit-backdrop-filter:blur(42px) saturate(165%);box-shadow:0 36px 110px rgba(0,0,0,.62),0 0 0 1px rgba(105,186,255,.13),inset 0 1px rgba(255,255,255,.66),inset 0 -18px 40px rgba(0,10,38,.34);animation:overlay-in .24s cubic-bezier(.22,1,.36,1) both;pointer-events:auto;overflow:hidden}.quick-overlay__panel:before{content:"";position:absolute;z-index:-1;inset:-50% -10% auto;height:115%;background:radial-gradient(ellipse at 28% 15%,rgba(255,255,255,.42),transparent 25%),radial-gradient(ellipse at 69% 4%,rgba(123,202,255,.32),transparent 27%),linear-gradient(105deg,transparent 27%,rgba(255,255,255,.16) 42%,transparent 55%);filter:blur(10px);opacity:.9}.quick-overlay__panel:after{content:"";position:absolute;z-index:-1;inset:auto -11% -72% 33%;height:125%;border-radius:50%;background:radial-gradient(circle,rgba(70,123,255,.32),transparent 62%);filter:blur(16px)}
.quick-overlay__head{display:flex;align-items:center;gap:11px;letter-spacing:.22em;font-weight:800;font-size:12px;color:rgba(244,250,255,.9);text-shadow:0 1px 12px rgba(0,0,0,.5)}.quick-overlay__ps{font-size:18px;font-weight:950;letter-spacing:-.12em;transform:skew(-12deg);filter:drop-shadow(0 0 9px rgba(255,255,255,.45))}.quick-overlay__head small{margin-left:auto;font-size:11px;font-weight:650;letter-spacing:.02em;color:rgba(229,243,255,.68)}.quick-overlay__status{display:flex;align-items:center;gap:10px;padding:7px 10px;border:1px solid rgba(255,255,255,.18);border-radius:13px;background:rgba(255,255,255,.08);letter-spacing:0;font-size:11px;box-shadow:inset 0 1px rgba(255,255,255,.25)}.quick-overlay__status b{font-size:13px}.quick-overlay__status span{color:#d7eeff}
.quick-overlay__items{display:grid;grid-template-columns:repeat(7,1fr);gap:13px;margin-top:22px}.quick-overlay__item{position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.19);min-height:142px;border-radius:20px;color:#fff;background:linear-gradient(145deg,rgba(255,255,255,.14),rgba(255,255,255,.035));backdrop-filter:blur(18px) saturate(145%);padding:17px 13px;text-align:left;font:inherit;display:flex;flex-direction:column;justify-content:space-between;transition:transform .2s cubic-bezier(.22,1,.36,1),background .2s,border-color .2s,box-shadow .2s}.quick-overlay__item:before{content:"";position:absolute;inset:0;background:linear-gradient(145deg,rgba(255,255,255,.24),transparent 32%);opacity:.7}.quick-overlay__item i,.quick-overlay__item span{position:relative}.quick-overlay__item i{font-style:normal;font-size:27px;line-height:1;color:#d9efff;filter:drop-shadow(0 0 9px rgba(135,211,255,.5))}.quick-overlay__item b{display:block;font-size:14px}.quick-overlay__item em{display:block;margin-top:4px;color:rgba(235,243,255,.64);font-size:10px;font-style:normal;line-height:1.3}.quick-overlay__item.is-selected{transform:translateY(-8px) scale(1.045);background:linear-gradient(145deg,rgba(157,219,255,.75),rgba(80,140,255,.58) 48%,rgba(46,66,174,.55));border-color:rgba(255,255,255,.96);box-shadow:0 0 0 3px rgba(194,231,255,.28),0 17px 42px rgba(0,91,235,.46),inset 0 1px rgba(255,255,255,.74)}
.quick-overlay footer{margin-top:18px;display:flex;justify-content:center;gap:22px;color:rgba(234,243,255,.58);font-size:11px}.quick-overlay footer b{color:#fff;margin-right:5px}@keyframes overlay-in{from{opacity:0;transform:translateY(26px) scale(.97)}to{opacity:1;transform:none}}@media(max-width:800px){.quick-overlay__items{grid-template-columns:repeat(3,1fr)}.quick-overlay__item{min-height:100px}}
`;

if (typeof document !== "undefined") {
  // This module can be evaluated again during development/window recovery.
  // Keep one stylesheet per overlay document instead of accumulating tags.
  const styleId = "ps5-mode-quick-overlay-css";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = overlayCss;
    document.head.append(style);
  }
}
