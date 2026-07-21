import { type CSSProperties, Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { accentFor, GlyphCircle, GlyphCross, GlyphDpad, GlyphOptions, GlyphSquare, GlyphSwipe, ServiceIcon, taglineFor } from "./icons";
import { heroArtFor } from "./heroArt";
import { Clock } from "./Clock";
import { Atmosphere } from "./Atmosphere";
import { useController } from "../hooks/useController";
import { useEdges } from "../hooks/useEdges";
import { duckAmbient, setAmbientHue } from "../ambient";
import { MOTION } from "../motion";
import { useGridNav } from "../hooks/useGridNav";
import { useTouchpad, type DragState } from "../hooks/useTouchpad";
import { useSpringScroll } from "../hooks/useSpringScroll";
import { navFeedback, selectFeedback, launchFeedback, tabFeedback } from "../feedback";
import { getControllerSettings } from "../settings";
import { getRecents, recordLaunch } from "../recents";
import type { Panel } from "../App";

const KeyboardOverlay = lazy(() => import("./KeyboardOverlay").then((m) => ({ default: m.KeyboardOverlay })));

type Category = "apps" | "games" | "launchers";
type Direction = "up" | "down" | "left" | "right";
type TopFocus = "none" | "wifi" | "search" | "settings" | "power";
type PowerAction = "minimize" | "close" | "lock" | "sleep" | "shutdown";
interface Tile { id: string; label: string; category: Category; needsCursor?: boolean; hasTrainer?: boolean; }
interface RawAppConfig { apps: Array<{ id: string; label: string; category: string; needs_cursor: boolean; trainer?: string | null }>; }
type GameAction = { id: "play" | "close" | "trainer"; label: string };
interface LiveBackdropFrame { tile_id: string; title: string; data_url: string; width: number; height: number; }
type TabId = Category | "continue";
const TABS: Array<{ id: TabId; label: string }> = [{ id: "continue", label: "Continue" }, { id: "apps", label: "Apps" }, { id: "games", label: "Games" }, { id: "launchers", label: "Launchers" }];
const TILE_DISTANCE = MOTION.dock.tileDistance; const MOMENTUM_MS = MOTION.dock.momentumMs; const L1 = 0x01; const R1 = 0x02;
// Share/Create is unbound elsewhere in this app. buf[9] 0x10 per the standard
// DualSense shoulders-byte layout (L1=0x01,R1=0x02,L2=0x04,R2=0x08,Create=0x10,
// Options=0x20,L3=0x40,R3=0x80) — consistent with hid.rs's confirmed
// Options=0x20, and CONFIRMED WORKING on hardware (AJ, 2026-07-19).
const SHARE_BUTTON = 0x10;
const SHARE_DOUBLE_TAP_MS = 450; // mirrors hid.rs's MULTI_TAP_WINDOW
const TOP_ITEMS: TopFocus[] = ["wifi", "search", "settings", "power"];
const POWER_ACTIONS: Array<{ id: PowerAction; label: string; description: string; command: string }> = [
  { id: "minimize", label: "Minimize console", description: "Hide the console and return to Windows without closing it.", command: "minimize_console" },
  { id: "close", label: "Close console", description: "Exit console mode and re-arm the PS-button launcher.", command: "exit_mode" },
  { id: "lock", label: "Lock console", description: "Keep apps running and require Windows sign-in.", command: "lock_workstation" },
  { id: "sleep", label: "Rest mode", description: "Enter the animated idle screen and lower power use. Press PS to wake.", command: "rest_mode" },
  { id: "shutdown", label: "Turn off", description: "Close Windows and power down this PC.", command: "shutdown_machine" },
];
/** #rrggbb -> hue degrees. Only the hue matters to the bed. */
function hueOf(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 210;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 210;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function WifiIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9.7a12.8 12.8 0 0 1 17 0M6.8 13a8 8 0 0 1 10.4 0M10.1 16.3a3.2 3.2 0 0 1 3.8 0M12 19.3h.01" /></svg>; }
function GearIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13.5a7.7 7.7 0 0 0 .05-1.5 7.7 7.7 0 0 0-.05-1.5l2-1.55-2-3.46-2.38.96a7.45 7.45 0 0 0-2.58-1.5L14.1 2.4h-4l-.35 2.5a7.45 7.45 0 0 0-2.58 1.5l-2.38-.96-2 3.46 2 1.55a7.7 7.7 0 0 0-.05 1.5c0 .5.02 1 .05 1.5l-2 1.55 2 3.46 2.38-.96a7.45 7.45 0 0 0 2.58 1.5l.35 2.5h4l.35-2.5a7.45 7.45 0 0 0 2.58-1.5l2.38.96 2-3.46-2-1.55Z" /><circle cx="12" cy="12" r="2.65" /></svg>; }
function PowerIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6v8.1" /><path d="M7.1 5.5a8.1 8.1 0 1 0 9.8 0" /></svg>; }
function BatteryIcon({ level, charging }: { level: number; charging: boolean }) { const fill = Math.max(1.5, Math.round(level / 10) * 1.45); return <svg viewBox="0 0 28 16" aria-hidden="true" style={{ width: "2.35cqh", height: "1.45cqh" }}><rect x="1" y="2" width="23" height="12" rx="2.5" /><path d="M26 6v4" /><rect x="3.4" y="4.3" width={fill} height="7.4" rx="1.1" fill="#f4f6fb" stroke="none" />{charging && <path d="m14 3.4-3.3 5h2.55L12.4 13l4.5-6h-2.6l1-3.6Z" fill="#10131b" stroke="none" />}</svg>; }

/** Functional production home. It uses the existing config, launching, process, controller and touchpad APIs. */
export function CodexLauncher({ onOpen, onReady, onRest, inputEnabled }: { onOpen: (panel: Panel) => void; onReady: () => void; onRest: () => void; inputEnabled: boolean }) {
  const [tabIndex, setTabIndex] = useState(1); const [topFocus, setTopFocus] = useState<TopFocus>("none"); // 1 = Apps (Continue is tab 0)
  const [allTiles, setAllTiles] = useState<Tile[]>([]); const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [closing, setClosing] = useState(false); const [confirmClose, setConfirmClose] = useState<Tile | null>(null);
  // Game tiles get an in-place "page" (Play / Close / Trainer) instead of an
  // instant launch — apps/launchers keep launching straight from the dock.
  const [expandedTile, setExpandedTile] = useState<Tile | null>(null); const [actionIndex, setActionIndex] = useState(0);
  const [powerOpen, setPowerOpen] = useState(false); const [powerIndex, setPowerIndex] = useState(0); const [powerConfirm, setPowerConfirm] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [battery, setBattery] = useState<number | null>(null); const [charging, setCharging] = useState(false);
  const [liveBackdrop, setLiveBackdrop] = useState<LiveBackdropFrame | null>(null);
  const [recents, setRecents] = useState<string[]>(() => getRecents());
  const [switchDir, setSwitchDir] = useState<1 | -1>(1);
  const [outgoing, setOutgoing] = useState<{ tiles: Tile[]; dir: 1 | -1 } | null>(null);
  // The copy block remounts on every focus change (it's keyed by the active
  // tile), so it must NOT inherit the tab-switch direction — otherwise walking
  // tile-to-tile slides the title in from whichever way you last changed tabs.
  // Non-zero only for the duration of a tab switch; 0 = plain vertical fade.
  const [copyDir, setCopyDir] = useState(0);
  const copyDirTimer = useRef<number | null>(null);
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // Geometry of the glow that slides between tabs. Measured from the real
  // buttons rather than assumed, so it stays correct if a label's width changes.
  const [tabGlow, setTabGlow] = useState<{ left: number; width: number } | null>(null);
  const [tabGlowMoving, setTabGlowMoving] = useState(false);
  const tabGlowTimer = useRef<number | null>(null);
  // Same travelling-glow treatment for the top utility row (Wi-Fi/Search/
  // Settings/Power), so focus reads consistently on both sides of the header
  // instead of a static box on one and a sliding light on the other.
  const utilRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [utilGlow, setUtilGlow] = useState<{ left: number; width: number } | null>(null);
  const [utilGlowMoving, setUtilGlowMoving] = useState(false);
  const utilGlowTimer = useRef<number | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const liveBackdropCache = useRef(new Map<string, LiveBackdropFrame>());
  const outgoingTimer = useRef<number | null>(null);
  // Snapshot once: reduced-motion users get a plain fade (see the shelf/copy
  // CSS override in styles.css), so skip building the exit-slide ghost layer.
  const reduceMotion = useRef(typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  // Button/d-pad/shoulder edges come from the shared useEdges tracker; only the
  // analog stick still needs a local previous-direction ref (it's derived from
  // axis thresholds, not a button state).
  const edges = useEdges(); const prevStick = useRef<Direction | null>(null); const dragStartFocus = useRef(0); const dragging = useRef(false); const dragLastDx = useRef(0); const dragLastT = useRef(0); const dragVel = useRef(0); const shareTap = useRef<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const applyConfig = (config: RawAppConfig | null | undefined) => {
      // The first render must remain valid while native config is still absent
      // (or a local preview has no native bridge). Otherwise two undefined
      // values can masquerade as a valid live backdrop and crash the gate.
      const apps = Array.isArray(config?.apps) ? config.apps : [];
      if (!cancelled) setAllTiles(apps.map((tile) => ({ id: tile.id, label: tile.label, category: TABS.some((tab) => tab.id === tile.category) ? tile.category as Category : "apps", needsCursor: tile.needs_cursor, hasTrainer: !!tile.trainer })));
    };
    void invoke<RawAppConfig>("get_config").then((config) => { applyConfig(config); if (!cancelled) onReady(); }).catch(() => { if (!cancelled) onReady(); });
    return () => { cancelled = true; };
  }, []);
  const tabId = TABS[tabIndex].id;
  const tiles = useMemo(() => {
    if (tabId === "continue") {
      // "Continue" = what you last launched, then whatever's running now.
      const byId = new Map(allTiles.map((t) => [t.id, t] as const));
      const seen = new Set<string>();
      const out: Tile[] = [];
      const push = (id: string) => { const t = byId.get(id); if (t && !seen.has(id)) { seen.add(id); out.push(t); } };
      recents.forEach(push);
      runningIds.forEach(push);
      return out;
    }
    return allTiles.filter((tile) => tile.category === tabId);
  }, [allTiles, tabId, recents, runningIds]);
  const tileIds = useMemo(() => [...new Set(allTiles.map((tile) => tile.id))], [allTiles]);
  const { focus, setFocus, move, jumpTo } = useGridNav(Math.max(tiles.length, 1), Math.max(tiles.length, 1));
  const scrollDockTo = useSpringScroll(dockRef);
  const activeTile = tiles[focus]; const accent = activeTile ? accentFor(activeTile.id) : "#6ea8ff"; const HeroArt = activeTile ? heroArtFor(activeTile.id) : undefined;
  // Feed the focused tile's accent to the ambient bed so the harmony and filter
  // colour track what you're looking at — the same --focus-bloom that drives the
  // visual bloom, so audio and light agree instead of drifting apart.
  useEffect(() => { setAmbientHue(hueOf(accent)); }, [accent]);
  // Parallax: -1 (first tile) .. +1 (last tile), fed to CSS as --px so the hero
  // art and atmosphere pan at different depths as focus moves across the dock.
  const parallax = tiles.length > 1 ? (focus / (tiles.length - 1) - 0.5) * 2 : 0;
  useEffect(() => setFocus(0), [tabIndex, setFocus]);
  useEffect(() => () => { if (outgoingTimer.current) window.clearTimeout(outgoingTimer.current); if (copyDirTimer.current) window.clearTimeout(copyDirTimer.current); }, []);
  useEffect(() => { const dock = dockRef.current; const tile = tileRefs.current[focus]; if (!dock || !tile) return; scrollDockTo(tile.offsetLeft - (dock.clientWidth - tile.offsetWidth) / 2); }, [focus, tabIndex, tiles.length, scrollDockTo]);
  useEffect(() => { if (!tileIds.length) return; let stopped = false; const poll = () => void invoke<string[]>("running_tile_ids", { tileIds }).then((ids) => { if (!stopped) setRunningIds(new Set(ids)); }); poll(); const interval = window.setInterval(poll, 4000); return () => { stopped = true; window.clearInterval(interval); }; }, [tileIds]);
  useEffect(() => {
    const tileId = activeTile?.id;
    if (!tileId || !runningIds.has(tileId)) { setLiveBackdrop(null); return; }
    const cached = liveBackdropCache.current.get(tileId);
    if (cached) { setLiveBackdrop(cached); return; }
    setLiveBackdrop(null);
    let cancelled = false;
    // Let the selection settle, then prepare one safe native snapshot. The hero
    // remains visible until a complete valid frame is ready, so there is no flicker.
    const timer = window.setTimeout(() => {
      void invoke<LiveBackdropFrame | null>("prepare_live_backdrop", { tileId }).then((frame) => {
        if (!cancelled && frame && frame.tile_id === tileId) {
          liveBackdropCache.current.set(tileId, frame);
          setLiveBackdrop(frame);
        }
      }).catch(() => undefined);
    }, 140);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [activeTile?.id, runningIds]);
  useLayoutEffect(() => {
    const node = tabRefs.current[tabIndex];
    if (!node) return;
    setTabGlow((prev) => {
      const next = { left: node.offsetLeft, width: node.offsetWidth };
      // First measurement should appear in place, not fly in from x=0.
      if (prev && (prev.left !== next.left || prev.width !== next.width)) {
        setTabGlowMoving(true);
        if (tabGlowTimer.current) window.clearTimeout(tabGlowTimer.current);
        // Blur is time-boxed to the travel, never left on the layer at rest.
        tabGlowTimer.current = window.setTimeout(() => setTabGlowMoving(false), MOTION.tabSlide.inMs);
      }
      return next;
    });
  }, [tabIndex, tiles.length]);
  useEffect(() => () => { if (tabGlowTimer.current) window.clearTimeout(tabGlowTimer.current); }, []);

  // Position the utility glow over the focused top-bar button. When focus
  // leaves the top row (topFocus === "none") the glow is dropped entirely so
  // it doesn't hang over an item the user is no longer on.
  useLayoutEffect(() => {
    if (topFocus === "none") { setUtilGlow(null); return; }
    const node = utilRefs.current[TOP_ITEMS.indexOf(topFocus)];
    if (!node) return;
    setUtilGlow((prev) => {
      const next = { left: node.offsetLeft, width: node.offsetWidth };
      if (prev && (prev.left !== next.left || prev.width !== next.width)) {
        setUtilGlowMoving(true);
        if (utilGlowTimer.current) window.clearTimeout(utilGlowTimer.current);
        utilGlowTimer.current = window.setTimeout(() => setUtilGlowMoving(false), MOTION.tabSlide.inMs);
      }
      return next;
    });
  }, [topFocus]);
  useEffect(() => () => { if (utilGlowTimer.current) window.clearTimeout(utilGlowTimer.current); }, []);

  function setTab(next: number) {
    const clamped = Math.max(0, Math.min(TABS.length - 1, next));
    if (clamped === tabIndex) return;
    const dir: 1 | -1 = clamped > tabIndex ? 1 : -1;
    setSwitchDir(dir);
    // Reset after the copy animation (.26s) has finished, so flipping the var
    // back to 0 can't restart or visibly alter an in-flight animation.
    setCopyDir(dir);
    if (copyDirTimer.current) window.clearTimeout(copyDirTimer.current);
    copyDirTimer.current = window.setTimeout(() => setCopyDir(0), 300);
    if (!reduceMotion.current && tiles.length) {
      if (outgoingTimer.current) window.clearTimeout(outgoingTimer.current);
      setOutgoing({ tiles, dir });
      outgoingTimer.current = window.setTimeout(() => setOutgoing(null), 300);
    }
    setTabIndex(clamped);
    tabFeedback(dir);
  }
  function movePower(delta: number) { setPowerIndex((current) => { const next = Math.max(0, Math.min(POWER_ACTIONS.length - 1, current + delta)); if (next !== current) navFeedback(); return next; }); }
  function launch(tile?: Tile) { if (!tile) return; recordLaunch(tile.id); setRecents(getRecents()); launchFeedback();
    // Hard-duck before we hand the screen over. Our bed must never play under
    // a game — competing with its audio is the fastest way to feel broken.
    duckAmbient(true); if (tile.id === "youtube") return onOpen("youtube"); setClosing(true); window.setTimeout(() => void invoke("launch_app", { target: tile.id, needsCursor: !!tile.needsCursor }), 160); }
  const expandedActions = useMemo<GameAction[]>(() => {
    if (!expandedTile) return [];
    const list: GameAction[] = [{ id: "play", label: "Play" }];
    if (runningIds.has(expandedTile.id)) list.push({ id: "close", label: "Close Game" });
    if (expandedTile.hasTrainer) list.push({ id: "trainer", label: "Trainer" });
    return list;
  }, [expandedTile, runningIds]);
  function moveGameAction(delta: number) { setActionIndex((current) => { const next = Math.max(0, Math.min(expandedActions.length - 1, current + delta)); if (next !== current) navFeedback(); return next; }); }
  function runGameAction(action?: GameAction) {
    if (!expandedTile || !action) return;
    selectFeedback();
    if (action.id === "play") { launch(expandedTile); }
    else if (action.id === "close") { const id = expandedTile.id; void invoke("close_tile_app", { tileId: id }).then(() => setRunningIds((current) => { const next = new Set(current); next.delete(id); return next; })); }
    else if (action.id === "trainer") { void invoke("launch_trainer", { tileId: expandedTile.id }); }
    setExpandedTile(null);
  }
  function commitPower() { const action = POWER_ACTIONS[powerIndex]; selectFeedback(); if (action.command === "rest_mode") { setPowerConfirm(false); setPowerOpen(false); onRest(); return; } void invoke(action.command); }
  function navigate(direction: Direction) { if (direction === "up") { if (topFocus === "none") { setTopFocus("wifi"); navFeedback(); } return; } if (direction === "down") { if (topFocus !== "none") { setTopFocus("none"); navFeedback(); } return; } if (topFocus !== "none") { const index = TOP_ITEMS.indexOf(topFocus); const step = direction === "right" ? 1 : -1; setTopFocus(TOP_ITEMS[(index + step + TOP_ITEMS.length) % TOP_ITEMS.length]); navFeedback(); return; } move(direction); }
  useController((pad) => {
    // Sample edges FIRST, unconditionally. Every `return` below is now safe:
    // the baseline stays truthful even while input is disabled or a modal owns
    // it, so a button still held when input re-enables is never mistaken for a
    // fresh press (that bug closed the launcher on the first command).
    const edge = edges.sync(pad);
    const hat = edge.hat();
    const stickAt = (axis: number) => (Math.abs(axis - 128) > 52 ? (axis > 128 ? 1 : -1) : 0);
    if (typeof pad.battery_percent === "number") setBattery(pad.battery_percent);
    if (typeof pad.charging === "boolean") setCharging(pad.charging);
    if (!inputEnabled) return;
    if (confirmClose) { if (edge.rising("cross")) { const id = confirmClose.id; selectFeedback(); void invoke("close_tile_app", { tileId: id }).then(() => { setConfirmClose(null); setRunningIds((current) => { const next = new Set(current); next.delete(id); return next; }); }); } else if (edge.rising("circle")) setConfirmClose(null); return; }
    if (expandedTile) {
      if (hat === 0) moveGameAction(-1); if (hat === 4) moveGameAction(1);
      const menuStick = stickAt(pad.ly) === 1 ? "down" : stickAt(pad.ly) === -1 ? "up" : null;
      if (menuStick !== prevStick.current) { prevStick.current = menuStick; if (menuStick === "up") moveGameAction(-1); if (menuStick === "down") moveGameAction(1); }
      if (edge.rising("cross")) runGameAction(expandedActions[actionIndex]);
      else if (edge.rising("circle")) setExpandedTile(null);
      return;
    }
    if (powerConfirm) { if (edge.rising("cross")) commitPower(); else if (edge.rising("circle")) setPowerConfirm(false); return; }
    if (powerOpen) { if (hat === 0) movePower(-1); if (hat === 4) movePower(1); const menuStick = stickAt(pad.ly) === 1 ? "down" : stickAt(pad.ly) === -1 ? "up" : null; if (menuStick !== prevStick.current) { prevStick.current = menuStick; if (menuStick === "up") movePower(-1); if (menuStick === "down") movePower(1); } if (edge.rising("cross")) setPowerConfirm(true); else if (edge.rising("circle")) setPowerOpen(false); return; }
    const shoulderEdge = edge.shoulderEdge();
    // Double-press Share/Create summons the keyboard overlay from anywhere on Home.
    if (!keyboardOpen && (shoulderEdge & SHARE_BUTTON)) {
      const now = performance.now();
      if (shareTap.current !== null && now - shareTap.current <= SHARE_DOUBLE_TAP_MS) { shareTap.current = null; selectFeedback(); setKeyboardOpen(true); }
      else shareTap.current = now;
    }
    if (keyboardOpen) return; // overlay owns input while open
    if (hat !== null) { const direction: Direction | null = hat === 0 ? "up" : hat === 2 ? "right" : hat === 4 ? "down" : hat === 6 ? "left" : null; if (direction) navigate(direction); }
    const stick: Direction | null = stickAt(pad.lx) !== 0 ? (stickAt(pad.lx) === 1 ? "right" : "left") : stickAt(pad.ly) !== 0 ? (stickAt(pad.ly) === 1 ? "down" : "up") : null;
    if (stick !== prevStick.current) { prevStick.current = stick; if (stick) navigate(stick); }
    if (edge.rising("cross")) { if (topFocus === "wifi") { selectFeedback(); onOpen("settings"); } else if (topFocus === "search") { selectFeedback(); onOpen("search"); } else if (topFocus === "settings") { selectFeedback(); onOpen("settings"); } else if (topFocus === "power") { selectFeedback(); setPowerOpen(true); } else if (activeTile?.category === "games") { selectFeedback(); setActionIndex(0); setExpandedTile(activeTile); } else launch(activeTile); }
    if (edge.rising("square") && activeTile && runningIds.has(activeTile.id)) setConfirmClose(activeTile);
    if (shoulderEdge & L1) setTab(tabIndex - 1); if (shoulderEdge & R1) setTab(tabIndex + 1);
  });
  useTouchpad((drag: DragState) => {
    if (!inputEnabled || keyboardOpen) return;
    const distance = TILE_DISTANCE / getControllerSettings().homeSwipeSensitivity;
    if (!drag.active) {
      // Release: project the flick's momentum and let the spring carry focus to
      // the landing tile (apple-design: hand release velocity to the animation,
      // snap from the projected endpoint — not the release point).
      if (dragging.current) {
        const projected = dragVel.current * MOMENTUM_MS; // touchpad units of glide
        jumpTo(dragStartFocus.current + Math.round((dragLastDx.current + projected) / distance));
      }
      dragging.current = false; dragVel.current = 0;
      return;
    }
    const now = performance.now();
    if (!dragging.current) { dragging.current = true; dragStartFocus.current = focus; dragLastDx.current = drag.dx; dragLastT.current = now; dragVel.current = 0; }
    const dt = now - dragLastT.current;
    // Low-pass the instantaneous velocity so one noisy sample can't fling it.
    if (dt > 0) dragVel.current = dragVel.current * 0.7 + ((drag.dx - dragLastDx.current) / dt) * 0.3;
    dragLastDx.current = drag.dx; dragLastT.current = now;
    jumpTo(dragStartFocus.current + Math.round(drag.dx / distance)); // 1:1 while dragging
  });
  const showLiveBackdrop = Boolean(liveBackdrop && activeTile && liveBackdrop.tile_id === activeTile.id);
  const liveBackground = showLiveBackdrop && liveBackdrop ? `linear-gradient(90deg, rgba(5,8,14,.78) 0%, rgba(6,9,15,.37) 39%, rgba(6,9,15,.15) 100%), url("${liveBackdrop.data_url}")` : undefined;
  return <main className={`codex-launcher ${closing ? "app-exit" : ""}`} style={{ "--focus-bloom": accent, "--px": parallax, "--dir": switchDir } as CSSProperties}>
    <style>{CSS}</style><Atmosphere variant="home" /><div className="codex-backdrop" aria-hidden="true"><div className={`codex-live-backdrop ${showLiveBackdrop ? "is-ready" : ""}`} style={{ backgroundImage: liveBackground }} />{HeroArt && <div className={`codex-hero-art ${showLiveBackdrop ? "is-covered" : ""}`}><HeroArt /></div>}</div>
    <header className="codex-topbar"><div className="codex-utility"><div className="codex-glass codex-pill-group">{utilGlow && <span className={`codex-util-glow ${utilGlowMoving ? "is-moving" : ""}`} aria-hidden="true" style={{ left: utilGlow.left, width: utilGlow.width }} />}<button ref={(node) => { utilRefs.current[0] = node; }} className="codex-utility-button codex-wifi-button" onClick={() => { setTopFocus("wifi"); onOpen("settings"); }} aria-label="Wi-Fi and network"><WifiIcon /><span>Wi-Fi</span></button><button ref={(node) => { utilRefs.current[1] = node; }} className="codex-utility-button" onClick={() => { setTopFocus("search"); onOpen("search"); }} aria-label="Search"><span className="codex-search-glyph" /><span>Search</span></button><button ref={(node) => { utilRefs.current[2] = node; }} className="codex-utility-button" onClick={() => { setTopFocus("settings"); onOpen("settings"); }} aria-label="Settings"><GearIcon /><span>Settings</span></button><button ref={(node) => { utilRefs.current[3] = node; }} className="codex-utility-button" onClick={() => setPowerOpen(true)} aria-label="Power"><PowerIcon /><span>Power</span></button></div><div className="codex-glass codex-pill-group codex-status-group">{battery !== null && <div className="codex-status" title={`DualSense battery: about ${battery}%`}><BatteryIcon level={battery} charging={charging} /><span>~{battery}%</span></div>}<div className="codex-clock"><Clock /></div></div></div></header>
    <nav className="codex-tabs" aria-label="Library categories">{tabGlow && <span className={`codex-tab-glow ${tabGlowMoving ? "is-moving" : ""}`} aria-hidden="true" style={{ left: tabGlow.left, width: tabGlow.width }} />}{TABS.map((tab, index) => <button ref={(node) => { tabRefs.current[index] = node; }} key={tab.id} className={`codex-tab ${tabIndex === index ? "active" : ""}`} onClick={() => setTab(index)}>{tab.label}</button>)}</nav>
    {activeTile && <section className="codex-copy" key={`${activeTile.category}-${activeTile.id}-${activeTile.label}`} style={{ "--dir": copyDir, "--copy-blur": copyDir ? "9px" : "0px" } as CSSProperties}><div className="codex-eyebrow"><i className="codex-live-dot" />NOW SELECTED</div><h1>{activeTile.label}</h1><p>{taglineFor(activeTile.id) || (activeTile.category === "games" ? "Ready when you are" : "Open and continue")}</p><div className="codex-rule" /></section>}
    <section className="codex-dock-wrap" aria-label={`${TABS[tabIndex].label} dock`}><div ref={dockRef} className="codex-dock codex-glass"><div className="codex-dock-light" aria-hidden="true" /><div className="codex-shelf codex-shelf-in" key={tabId}>{tabId === "continue" && tiles.length === 0 ? <div className="codex-empty">Nothing recent yet — launch an app or game and it'll show up here.</div> : tiles.map((tile, index) => <button ref={(node) => { tileRefs.current[index] = node; }} key={`${tile.category}-${index}-${tile.id}`} className={`codex-tile ${focus === index ? "focused" : ""}`} onClick={() => { setFocus(index); if (tile.category === "games") { setActionIndex(0); setExpandedTile(tile); } else launch(tile); }}><span className="codex-tile-icon"><ServiceIcon id={tile.id} /></span><span className="codex-tile-label">{tile.label}</span>{runningIds.has(tile.id) && <i className="codex-running" aria-label="Running" />}</button>)}</div>{outgoing && <div className="codex-shelf codex-shelf-ghost" style={{ "--dir": outgoing.dir } as CSSProperties} aria-hidden="true">{outgoing.tiles.map((tile, index) => <span key={`${tile.category}-${index}-${tile.id}`} className="codex-tile"><span className="codex-tile-icon"><ServiceIcon id={tile.id} /></span><span className="codex-tile-label">{tile.label}</span></span>)}</div>}</div></section>
    <footer className="codex-hints" aria-label="Controller hints">
  <span className="codex-glass codex-hint"><i className="codex-hint-icon"><GlyphCross /></i>Select</span>
  <span className="codex-glass codex-hint"><i className="codex-hint-icon"><GlyphDpad /></i>Navigate</span>
  <span className="codex-glass codex-hint"><i className="codex-hint-icon"><GlyphSwipe /></i>Browse</span>
  <span className="codex-glass codex-hint"><b>L1 / R1</b>Switch tab</span>
  {activeTile && runningIds.has(activeTile.id) && <span className="codex-glass codex-hint"><i className="codex-hint-icon"><GlyphSquare /></i>Close app</span>}
  <span className="codex-glass codex-hint"><i className="codex-hint-icon"><GlyphOptions /></i>Menu</span>
</footer>
    {powerOpen && <div className="codex-confirm-backdrop"><section className="codex-power-panel codex-glass" style={{ background: "radial-gradient(110% 92% at 9% -8%, rgba(255,255,255,.29), transparent 39%), radial-gradient(70% 100% at 100% 100%, color-mix(in srgb, var(--focus-bloom) 28%, transparent), transparent 66%), linear-gradient(145deg, rgba(37,50,79,.73), rgba(11,15,28,.82))", borderColor: "rgba(225,240,255,.38)", boxShadow: "0 42px 130px rgba(0,0,0,.72), inset 0 1px rgba(255,255,255,.56), inset 0 -24px 54px rgba(0,4,18,.35)", backdropFilter: "blur(48px) saturate(175%)", WebkitBackdropFilter: "blur(48px) saturate(175%)" }}>{powerConfirm ? <><div className="codex-eyebrow">CONFIRM SYSTEM ACTION</div><h2>{POWER_ACTIONS[powerIndex].label}?</h2><p>{POWER_ACTIONS[powerIndex].description}</p><div className="codex-power-confirm"><button onClick={commitPower}><i className="codex-dualsense-inline"><GlyphCross /></i>Confirm</button><button onClick={() => setPowerConfirm(false)}><i className="codex-dualsense-inline"><GlyphCircle /></i>Cancel</button></div></> : <><div className="codex-eyebrow">POWER</div><h2>End your session</h2><p>Choose an action. A second confirmation is required.</p><div className="codex-power-actions" style={{ gridTemplateColumns: "1fr", overflow: "hidden" }}>{POWER_ACTIONS.map((action, index) => <button key={action.id} className={index === powerIndex ? "selected" : ""} style={{ minHeight: "8.4cqh", padding: "1.15cqh 1.6cqw", flexDirection: "row", alignItems: "center", justifyContent: "space-between", textAlign: "left", background: index === powerIndex ? "linear-gradient(105deg, color-mix(in srgb, var(--focus-bloom) 34%, rgba(255,255,255,.16)), rgba(255,255,255,.12))" : "linear-gradient(110deg, rgba(255,255,255,.13), rgba(255,255,255,.035))", boxShadow: index === powerIndex ? "0 0 0 .24cqh rgba(255,255,255,.19), 0 1.2cqh 2.5cqh color-mix(in srgb, var(--focus-bloom) 23%, transparent), inset 0 1px rgba(255,255,255,.46)" : "inset 0 1px rgba(255,255,255,.22)" }} onClick={() => { setPowerIndex(index); setPowerConfirm(true); }}><b>{action.label}</b><span>{action.description}</span></button>)}</div><div className="codex-power-footer">Up / Down to choose <b><i className="codex-dualsense-inline"><GlyphCross /></i>Select</b> <span><i className="codex-dualsense-inline"><GlyphCircle /></i>Back</span></div></>}</section></div>}
    {confirmClose && <div className="codex-confirm-backdrop"><section className="codex-confirm codex-glass"><div className="codex-eyebrow">RUNNING APPLICATION</div><h2>Close {confirmClose.label}?</h2><p>Any unsaved progress may be lost.</p><div><b><i className="codex-dualsense-inline"><GlyphCross /></i>Close</b><span><i className="codex-dualsense-inline"><GlyphCircle /></i>Cancel</span></div></section></div>}
    {expandedTile && <div className="codex-confirm-backdrop"><section className="codex-power-panel codex-glass" style={{ width: "min(40cqw,32rem)" }}><div className="codex-eyebrow">GAME</div><h2>{expandedTile.label}</h2><p>{runningIds.has(expandedTile.id) ? "Currently running." : "Ready when you are."}</p><div className="codex-power-actions" style={{ gridTemplateColumns: "1fr", overflow: "hidden" }}>{expandedActions.map((action, index) => <button key={action.id} className={index === actionIndex ? "selected" : ""} style={{ minHeight: "8.4cqh", padding: "1.15cqh 1.6cqw", flexDirection: "row", alignItems: "center", justifyContent: "space-between", textAlign: "left", background: index === actionIndex ? "linear-gradient(105deg, color-mix(in srgb, var(--focus-bloom) 34%, rgba(255,255,255,.16)), rgba(255,255,255,.12))" : "linear-gradient(110deg, rgba(255,255,255,.13), rgba(255,255,255,.035))", boxShadow: index === actionIndex ? "0 0 0 .24cqh rgba(255,255,255,.19), 0 1.2cqh 2.5cqh color-mix(in srgb, var(--focus-bloom) 23%, transparent), inset 0 1px rgba(255,255,255,.46)" : "inset 0 1px rgba(255,255,255,.22)" }} onClick={() => { setActionIndex(index); runGameAction(action); }}><b>{action.label}</b></button>)}</div><div className="codex-power-footer">Up / Down to choose <b><i className="codex-dualsense-inline"><GlyphCross /></i>Select</b> <span><i className="codex-dualsense-inline"><GlyphCircle /></i>Back</span></div></section></div>}
    {/* No consumer wired at Home yet (double-Share summon has nowhere to send typed
        text today) — onDone just closes. First real use case TBD with AJ. */}
    {keyboardOpen && <Suspense fallback={null}><KeyboardOverlay subtitle="D-pad, left stick, or touchpad to choose a key." onDone={() => setKeyboardOpen(false)} onCancel={() => setKeyboardOpen(false)} /></Suspense>}
  </main>;
}

const CSS = `
.codex-launcher{position:fixed;inset:0;overscroll-behavior:none;isolation:isolate;overflow:hidden;width:100%;height:100%;color:#f4f6fb;background:#090b10;font-family:"Manrope",system-ui,sans-serif;container-type:size}.codex-backdrop{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none;transform:translate3d(calc(var(--px,0)*2.4cqw),0,0);transition:transform .55s cubic-bezier(.22,1,.36,1)}.codex-launcher .atmos{transform:translate3d(calc(var(--px,0)*1.1cqw),0,0);transition:transform .6s cubic-bezier(.22,1,.36,1)}.codex-live-backdrop{position:absolute;inset:0;opacity:0;transform:scale(1.035);background-position:center;background-size:cover;filter:saturate(.78) contrast(1.05);transition:opacity .32s cubic-bezier(.22,1,.36,1),transform .7s cubic-bezier(.22,1,.36,1);will-change:opacity,transform}.codex-live-backdrop.is-ready{opacity:1;transform:scale(1)}.codex-hero-art{position:absolute;inset:-10%;opacity:1;animation:codex-fade .5s ease both;transition:opacity .27s ease}.codex-hero-art.is-covered{opacity:0}.codex-glass{position:relative;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.03));backdrop-filter:blur(28px) saturate(180%);-webkit-backdrop-filter:blur(28px) saturate(180%);border:1px solid rgba(255,255,255,.14);box-shadow:0 24px 60px -22px rgba(0,0,0,.6),inset 0 1px rgba(255,255,255,.35)}.codex-glass::before{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;background:radial-gradient(120% 82% at 15% 0%,rgba(255,255,255,.19),transparent 56%)}.codex-topbar{position:absolute;top:5.1cqh;left:8.1cqw;right:8.1cqw;display:flex;align-items:center;justify-content:flex-end}.codex-wordmark{display:flex;align-items:center;gap:.65cqw;font-size:1.1cqh;font-weight:750;letter-spacing:.18em;text-shadow:0 1px 15px #000}.codex-wordmark span{font-size:1.6cqh;letter-spacing:-.12em;font-weight:900;font-style:italic;transform:skew(-12deg)}.codex-utility{display:flex;align-items:center;gap:.65cqw}.codex-pill-group{position:relative;display:flex;align-items:stretch;padding:.32cqh .28cqw;border-radius:1.45cqh}
/* Travelling highlight for the utility row — the top-bar counterpart to
   .codex-tab-glow, so focus slides the same way on both sides of the header.
   Sits behind the buttons (z-index:0; buttons are z-index:1) and smears while
   in flight. Positioned within the pill group, which is the offsetParent. */
.codex-util-glow{position:absolute;top:.32cqh;height:3.86cqh;border-radius:1.1cqh;pointer-events:none;z-index:0;
  background:linear-gradient(180deg,color-mix(in srgb,var(--focus-bloom) 30%,rgba(255,255,255,.16)),color-mix(in srgb,var(--focus-bloom) 10%,rgba(255,255,255,.03)));
  box-shadow:0 0 1.8cqh color-mix(in srgb,var(--focus-bloom) 50%,transparent),inset 0 1px rgba(255,255,255,.4);
  transition:left .3s cubic-bezier(.22,1,.36,1),width .3s cubic-bezier(.22,1,.36,1),filter .16s ease,transform .3s cubic-bezier(.22,1,.36,1)}
.codex-util-glow.is-moving{filter:blur(6px) saturate(150%);transform:scaleX(1.12)}
@media (prefers-reduced-motion: reduce){.codex-util-glow{transition:none;filter:none!important;transform:none!important}}
html.reduce-motion .codex-util-glow{transition:none;filter:none!important;transform:none!important}.codex-status,.codex-utility-button,.codex-clock{height:3.86cqh;border-radius:1.1cqh;display:flex;align-items:center;justify-content:center;background:none;border:0;box-shadow:none}.codex-pill-group .codex-utility-button:not(:last-child),.codex-status-group .codex-status{box-shadow:1px 0 0 rgba(255,255,255,.12)}.codex-status{padding:0 1.15cqw;gap:.62cqw;font-size:1.25cqh;font-weight:700}.codex-status svg,.codex-utility-button svg{width:1.8cqh;height:1.8cqh;fill:none;stroke:#fff;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.codex-utility-button{position:relative;z-index:1;padding:0 1.1cqw;gap:.55cqw;color:inherit;font:inherit;font-size:1.2cqh;font-weight:700;cursor:pointer}.codex-power-glyph{font:900 2.2cqh/1 system-ui;color:#fff;transform:translateY(-.15cqh)}.codex-search-glyph{width:1.6cqh;height:1.6cqh;border:2px solid #fff;border-radius:50%;position:relative}.codex-search-glyph:after{content:"";position:absolute;width:.75cqh;height:2px;background:#fff;right:-.52cqh;bottom:-.26cqh;transform:rotate(45deg);border-radius:1px}.codex-clock{padding:0 1.15cqw}.codex-clock>div{font-size:1.05cqh!important;text-align:right!important}.codex-clock>div>div:last-child{display:none}.codex-tabs{position:absolute;left:8.1cqw;top:5.1cqh;display:flex;align-items:center;gap:.65cqw}
/* Travelling highlight. Sits behind the tab buttons and slides between them,
   smearing horizontally while in flight — the light itself carries the motion,
   which is what makes a console dashboard feel physical rather than stepped.
   scaleX + blur are applied ONLY during travel and cleared after, so nothing
   lingers on its own composited layer at rest. */
.codex-tab-glow{position:absolute;top:0;height:4.5cqh;border-radius:1.45cqh;pointer-events:none;z-index:0;
  background:linear-gradient(180deg,color-mix(in srgb,var(--focus-bloom) 34%,rgba(255,255,255,.16)),color-mix(in srgb,var(--focus-bloom) 12%,rgba(255,255,255,.03)));
  box-shadow:0 0 2.6cqh color-mix(in srgb,var(--focus-bloom) 55%,transparent),inset 0 1px rgba(255,255,255,.4);
  transition:left .34s cubic-bezier(.22,1,.36,1),width .34s cubic-bezier(.22,1,.36,1),filter .18s ease,transform .34s cubic-bezier(.22,1,.36,1)}
.codex-tab-glow.is-moving{filter:blur(7px) saturate(150%);transform:scaleX(1.14)}
.codex-tab{position:relative;z-index:1}
@media (prefers-reduced-motion: reduce){.codex-tab-glow{transition:none;filter:none!important;transform:none!important}}
html.reduce-motion .codex-tab-glow{transition:none;filter:none!important;transform:none!important}.codex-tab{height:4.5cqh;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.045);color:rgba(238,241,246,.72);padding:0 1.1cqw;border-radius:1.45cqh;font:700 1.2cqh inherit;cursor:pointer}.codex-tab.active{color:#fff;background:transparent;border-color:transparent;text-shadow:0 1px 8px #000}.codex-copy{position:absolute;left:8.1cqw;bottom:33cqh;max-width:54cqw;text-shadow:0 3px 24px rgba(0,0,0,.65);animation:codex-copy-in .26s cubic-bezier(.22,1,.36,1) both}.codex-eyebrow{display:flex;align-items:center;gap:.7cqw;font-size:1.02cqh;font-weight:800;letter-spacing:.18em;color:rgba(255,255,255,.72)}.codex-live-dot{width:.66cqh;height:.66cqh;border-radius:50%;background:var(--focus-bloom);box-shadow:0 0 1.2cqh var(--focus-bloom)}.codex-copy h1{margin:1.35cqh 0 .8cqh;font-size:6.7cqh;line-height:.96;font-weight:800;letter-spacing:-.055em}.codex-copy p{margin:0;font-size:2.1cqh;font-weight:560;letter-spacing:-.01em;color:rgba(255,255,255,.84)}.codex-rule{width:5.2cqw;height:.38cqh;border-radius:2px;background:var(--focus-bloom);margin-top:2.2cqh;box-shadow:0 0 1.8cqh var(--focus-bloom)}.codex-dock-wrap{position:absolute;left:8.1cqw;right:8.1cqw;bottom:11cqh}.codex-dock{overscroll-behavior-x:contain;padding:2cqh 1.6cqw 1.8cqh;border-radius:2.2cqh;overflow-x:auto;overflow-y:hidden;scrollbar-width:none} .codex-dock::-webkit-scrollbar{display:none}.codex-dock-light{position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(100deg,transparent 20%,color-mix(in srgb,var(--focus-bloom) 18%,transparent) 50%,transparent 78%);filter:blur(1.2cqh)}.codex-shelf{position:relative;display:flex;align-items:flex-start;gap:.52cqw;width:max-content;padding:.7cqh .9cqw}.codex-shelf-in{animation:codex-shelf-in .32s cubic-bezier(.22,1,.36,1) both}.codex-shelf-ghost{position:absolute;inset:.7cqh .9cqw;pointer-events:none;animation:codex-shelf-out .28s cubic-bezier(.22,1,.36,1) both}.codex-empty{display:flex;align-items:center;height:5.5cqw;padding:0 1.6cqw;color:rgba(255,255,255,.62);font-size:1.5cqh;font-weight:600;max-width:56cqw;line-height:1.4}.codex-tile{position:relative;border:0;background:transparent;color:inherit;display:flex;flex:0 0 5.5cqw;min-width:0;flex-direction:column;align-items:center;gap:1.25cqh;padding:0;cursor:pointer;font:650 1.42cqh inherit;text-shadow:0 2px 10px #000}.codex-tile-icon{width:5.5cqw;height:5.5cqw;min-width:0;border-radius:.83cqw;overflow:hidden;display:block;transform:scale(.93);transition:transform .28s cubic-bezier(.22,1,.36,1),filter .28s}.codex-tile-icon>div{border-radius:inherit!important;box-shadow:inset 0 1px rgba(255,255,255,.3),0 1.4cqh 2.5cqh rgba(0,0,0,.36)}.codex-tile-label{width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;opacity:.74;transition:opacity .28s,font-weight .28s}.codex-tile.focused .codex-tile-icon{transform:scale(1.0);filter:drop-shadow(0 0 1.6cqh color-mix(in srgb,var(--focus-bloom) 75%,transparent))}.codex-tile.focused .codex-tile-icon:after{content:"";position:absolute;inset:-.42cqh;border-radius:.98cqw;border:.18cqh solid rgba(255,255,255,.85);box-shadow:0 0 2.2cqh color-mix(in srgb,var(--focus-bloom) 55%,transparent)}.codex-tile.focused .codex-tile-label{opacity:1;font-weight:800}.codex-running{position:absolute;right:.35cqw;top:4.75cqw;width:1.25cqh;height:1.25cqh;border-radius:50%;background:#86ffbf;border:.25cqh solid #12151c;box-shadow:0 0 1.1cqh #86ffbf}.codex-hints{position:absolute;left:8.1cqw;bottom:3.3cqh;display:flex;gap:.75cqw}.codex-hint{border-radius:1.1cqh;padding:.72cqh .95cqw;font-size:1.02cqh;color:rgba(255,255,255,.72);display:flex;gap:.45cqw;align-items:center}.codex-hint b{color:#fff;font-weight:800}.codex-hint-icon{width:1.85cqh;height:1.85cqh;display:grid;place-items:center;color:#fff}.codex-hint-icon svg{width:100%;height:100%}.codex-confirm-backdrop{position:absolute;inset:0;z-index:10;display:grid;place-items:center;background:rgba(4,6,10,.78)}.codex-confirm{width:min(43cqw,34rem);padding:4cqh 3.5cqw;border-radius:2.5cqh;text-align:center}.codex-confirm h2{font-size:3cqh;margin:1.4cqh 0 1cqh}.codex-confirm p{color:rgba(255,255,255,.68);font-size:1.7cqh;margin:0 0 3cqh}.codex-confirm div:last-child{display:flex;justify-content:center;gap:2cqw;font-size:1.4cqh}.codex-confirm div:last-child span{color:rgba(255,255,255,.65)}.codex-power-panel{width:min(68cqw,56rem);padding:4cqh 3.5cqw;border-radius:2.5cqh;text-align:center}.codex-power-panel h2{font-size:3.2cqh;margin:1.4cqh 0 1cqh}.codex-power-panel p{font-size:1.55cqh;color:rgba(255,255,255,.7);margin:0 0 2.7cqh}.codex-power-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:1cqw}.codex-power-actions button,.codex-power-confirm button{border:1px solid rgba(255,255,255,.13);border-radius:1.5cqh;background:rgba(255,255,255,.06);color:#fff;font:inherit;cursor:pointer}.codex-power-actions button{min-height:15cqh;padding:2.1cqh 1.2cqw;display:flex;flex-direction:column;gap:1.1cqh}.codex-power-actions button b{font-size:1.7cqh}.codex-power-actions button span{font-size:1.15cqh;color:rgba(255,255,255,.63);line-height:1.35}.codex-power-actions button.selected{border-color:#fff;background:color-mix(in srgb,var(--focus-bloom) 25%,rgba(255,255,255,.10));box-shadow:0 0 0 .28cqh rgba(255,255,255,.18),0 0 2.3cqh color-mix(in srgb,var(--focus-bloom) 50%,transparent)}.codex-power-footer{margin-top:2cqh;font-size:1.2cqh;color:rgba(255,255,255,.65);display:flex;justify-content:center;gap:1cqw}.codex-power-footer b{color:#fff}.codex-power-confirm{display:flex;justify-content:center;gap:1cqw}.codex-power-confirm button{padding:1.2cqh 1.6cqw;font-weight:800;font-size:1.4cqh}.codex-power-confirm button:first-child{background:#f4f6fb;color:#111}.codex-power-confirm button:last-child{color:rgba(255,255,255,.7)}.codex-dualsense-inline{width:1.65cqh;height:1.65cqh;display:inline-grid;place-items:center;vertical-align:-.3cqh;margin-right:.45cqw}.codex-dualsense-inline svg{width:100%;height:100%}@keyframes codex-fade{from{opacity:.4;transform:translateY(1cqh)}to{opacity:1;transform:none}}@keyframes codex-shelf-in{from{opacity:0;transform:translateX(calc(var(--dir,1)*6cqw));filter:blur(12px)}to{opacity:1;transform:none;filter:none}}@keyframes codex-shelf-out{from{opacity:1;transform:none;filter:blur(0)}to{opacity:0;transform:translateX(calc(var(--dir,1)*-6cqw));filter:blur(12px)}}@keyframes codex-copy-in{from{opacity:0;transform:translate(calc(var(--dir,0)*4cqw),.7cqh);filter:blur(var(--copy-blur,0px))}to{opacity:1;transform:none;filter:none}}@media (max-aspect-ratio:1/1){.codex-copy h1{font-size:5.4cqh}.codex-dock-wrap{bottom:12cqh}.codex-tile{flex-basis:8.2cqw}.codex-tile-icon{width:8.2cqw;height:8.2cqw;border-radius:1.23cqw}.codex-running{top:7.1cqw}}
`;
