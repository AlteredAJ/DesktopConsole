// UNIT C â€” embedded YouTube (the ONE service that works in a WebView; Widevine L3,
// no Verified Media Path requirement). youtube.com/tv is the 10-foot leanback UI.
//
// Cookie jar persists across launches (WebView profile), so login sticks â€” no custom
// credential storage needed here.

import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ButtonHints } from "./ButtonHints";

export function YouTubeEmbed() {
  // Touchpad drives the OS cursor here instead of grid-nav swipes â€” see
  // mouse_inject.rs's CURSOR_MODE gate.
  useEffect(() => {
    void invoke("set_cursor_mode", { enabled: true });
    return () => void invoke("set_cursor_mode", { enabled: false });
  }, []);

  return (
    <>
      <iframe
        src="https://www.youtube.com/tv"
        title="YouTube"
        allow="autoplay; encrypted-media; fullscreen"
        style={{ border: "none", width: "100vw", height: "100vh" }}
      />
      <ButtonHints
        hints={[
          { glyph: "circle", label: "Back to grid" },
          { glyph: "options", label: "Menu" },
        ]}
      />
    </>
  );
}
