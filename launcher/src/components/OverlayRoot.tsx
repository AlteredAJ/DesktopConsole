import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { QuickOverlay } from "./QuickOverlay";
import { KeyboardOverlay } from "./KeyboardOverlay";

type OverlayMode = "quick" | "keyboard";

/**
 * Root of the always-on-top overlay window. That one window is reused for both
 * in-game surfaces — the Quick Menu (double-PS) and the Desktop Mode keyboard
 * dock (double-Share) — because it's prewarmed at startup, so showing either is
 * a visibility change rather than a second WebView2 cold start mid-game.
 *
 * Exactly one of them is mounted at a time. That's deliberate, not incidental:
 * both consume the pad-state stream, and two live consumers of one controller
 * is the double-input bug this project keeps having to fix. Rust decides which
 * by emitting "overlay-mode" before it shows the window.
 */
export function OverlayRoot() {
  const [mode, setMode] = useState<OverlayMode>("quick");

  useEffect(() => {
    const un = listen<string>("overlay-mode", (event) => {
      setMode(event.payload === "keyboard" ? "keyboard" : "quick");
    });
    return () => { void un.then((f) => f()); };
  }, []);

  if (mode === "keyboard") {
    return <KeyboardOverlay
      variant="dock"
      placeholder="Type, then press Done"
      onDone={(text) => {
        // Order matters: hide first so the dock isn't the foreground surface
        // when the keystrokes land, then type into whatever was underneath.
        void invoke("hide_quick_overlay_command")
          .then(() => invoke("send_text", { text }))
          .catch(() => {});
      }}
      onCancel={() => void invoke("hide_quick_overlay_command")}
    />;
  }
  return <QuickOverlay />;
}
