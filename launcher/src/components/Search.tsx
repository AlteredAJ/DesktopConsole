// Cross-app fuzzy search-to-launch Ã¢â‚¬â€ spans YouTube/Netflix/Discord/exes/
// launcher apps since it matches over our own config.rs tile list (see
// utils/fuzzy.ts for why this isn't Windows Search instead). Input is a
// D-pad-navigable on-screen keyboard (letter-grid select, not swipe-trace Ã¢â‚¬â€
// that's VirtualKeyboard.tsx's separate Unit B scope) so this doesn't have to
// wait on the swipe-to-type keyboard overlay to be useful today.

import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useController } from "../hooks/useController";
import { useTouchpad } from "../hooks/useTouchpad";
import { ButtonHints } from "./ButtonHints";
import { CodexPanelShell } from "./CodexPanelShell";
import { accentFor, ServiceIcon } from "./icons";
import { fuzzyFilter } from "../utils/fuzzy";
import { selectFeedback, navFeedback } from "../feedback";
import { getControllerSettings } from "../settings";
import type { Panel } from "../App";

interface Tile {
  id: string;
  label: string;
  needsCursor: boolean;
}
interface RawAppTile {
  id: string;
  label: string;
  category: string;
  needs_cursor: boolean;
}
interface RawAppConfig {
  apps: RawAppTile[];
}

// DualSense hat values (buf[8] low nibble) Ã¢â‚¬â€ same convention as useGridNav.ts.
const HAT_UP = 0;
const HAT_RIGHT = 2;
const HAT_DOWN = 4;
const HAT_LEFT = 6;

// Row 3 is special-cased (single wide "space" key) rather than listed here.
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm<"];
// Keyboard swipe travel is intentionally lower-sensitivity than home navigation.
const KEYBOARD_SWIPE_ROW_DISTANCE = 340;
const KEYBOARD_SWIPE_COLUMN_DISTANCE = 420;

export function Search({ onOpen }: { onOpen: (p: Panel) => void }) {
  const [query, setQuery] = useState("");
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [row, setRow] = useState(0);
  const [col, setCol] = useState(0);
  const [resultIndex, setResultIndex] = useState(0);
  const prevHat = useRef(8);
  const prevCross = useRef(false);
  const prevTouchpadButton = useRef(false);
  const prevShoulders = useRef(0);
  const prevTriangle = useRef(false);
  const prevStick = useRef<"up" | "down" | "left" | "right" | null>(null);
  const dragStart = useRef<{ row: number; col: number } | null>(null);

  useEffect(() => {
    void invoke<RawAppConfig>("get_config").then((cfg) => {
      setTiles(cfg.apps.map((t) => ({ id: t.id, label: t.label, needsCursor: t.needs_cursor })));
    });
  }, []);

  const results = useMemo(() => fuzzyFilter(query, tiles, (t) => t.label), [query, tiles]);
  useEffect(() => setResultIndex(0), [query]);

  function rowLen(r: number): number {
    return r === 3 ? 1 : KEY_ROWS[r].length;
  }

  function commitKey() {
    if (row === 3) {
      setQuery((q) => q + " ");
      return;
    }
    const key = KEY_ROWS[row][col];
    if (key === "<") setQuery((q) => q.slice(0, -1));
    else setQuery((q) => q + key);
  }

  function launch(tile?: Tile) {
    if (!tile) return;
    selectFeedback();
    if (tile.id === "youtube") return onOpen("youtube");
    void invoke("launch_app", { target: tile.id, needsCursor: tile.needsCursor });
  }
  function moveDirection(direction: number) {
    if (direction === HAT_LEFT) setCol((c) => Math.max(0, c - 1));
    else if (direction === HAT_RIGHT) setCol((c) => Math.min(rowLen(row) - 1, c + 1));
    else if (direction === HAT_UP) setRow((r) => { const next = Math.max(0, r - 1); setCol((c) => Math.min(c, rowLen(next) - 1)); return next; });
    else if (direction === HAT_DOWN) setRow((r) => { const next = Math.min(3, r + 1); setCol((c) => Math.min(c, rowLen(next) - 1)); return next; });
  }

  useController((pad) => {
    if (pad.dpad !== prevHat.current) { prevHat.current = pad.dpad; moveDirection(pad.dpad); }
    const stick = Math.abs(pad.lx - 128) > 52 ? (pad.lx > 128 ? "right" : "left") : Math.abs(pad.ly - 128) > 52 ? (pad.ly > 128 ? "down" : "up") : null;
    if (stick !== prevStick.current) { prevStick.current = stick; if (stick === "left") moveDirection(HAT_LEFT); if (stick === "right") moveDirection(HAT_RIGHT); if (stick === "up") moveDirection(HAT_UP); if (stick === "down") moveDirection(HAT_DOWN); }

    const selectPressed = (pad.cross && !prevCross.current) || (pad.touchpad_btn && !prevTouchpadButton.current);
    if (selectPressed) { selectFeedback(); commitKey(); }
    prevCross.current = pad.cross;
    prevTouchpadButton.current = pad.touchpad_btn;

    // Shoulders cycle the highlighted result instead of switching tabs here
    // (that's the Launcher grid's meaning for L1/R1 Ã¢â‚¬â€ Search repurposes them
    // since there's no tab row in this panel).
    const shoulders = (pad.buttons >> 8) & 0xff;
    const edge = shoulders & ~prevShoulders.current;
    prevShoulders.current = shoulders;
    if (results.length > 0) {
      if (edge & 0x01) setResultIndex((i) => (navFeedback(), Math.max(0, i - 1)));
      if (edge & 0x02) setResultIndex((i) => (navFeedback(), Math.min(results.length - 1, i + 1)));
    }

    if (pad.triangle && !prevTriangle.current) launch(results[resultIndex]);
    prevTriangle.current = pad.triangle;
  });

  useTouchpad((drag) => {
    if (!drag.active) { dragStart.current = null; return; }
    if (!dragStart.current) dragStart.current = { row, col };
    const start = dragStart.current;
    const sensitivity = getControllerSettings().keyboardSwipeSensitivity;
    const nextRow = Math.max(0, Math.min(3, start.row + Math.round(drag.dy / (KEYBOARD_SWIPE_ROW_DISTANCE / sensitivity))));
    const nextCol = Math.max(0, Math.min(rowLen(nextRow) - 1, start.col + Math.round(drag.dx / (KEYBOARD_SWIPE_COLUMN_DISTANCE / sensitivity))));
    setRow(nextRow);
    setCol(nextCol);
  });
  return (
    <CodexPanelShell eyebrow="LIBRARY" title="Search" subtitle="Find an app, game, or launcher from the couch."><div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div
        style={{
          fontSize: "2rem",
          minHeight: "3rem",
          marginBottom: "1.5rem",
          borderBottom: "2px solid var(--muted)",
          display: "flex",
          alignItems: "center",
        }}
      >
        {query || <span style={{ color: "var(--muted)" }}>search apps, games, launchers...</span>}
      </div>

      <div style={{ display: "flex", gap: "1.5rem", marginBottom: "2rem", minHeight: "5rem" }}>
        {results.map((t, i) => (
          <div
            key={t.id + t.label}
            style={{
              width: "8rem",
              padding: "0.8rem 0.5rem",
              borderRadius: "0.8rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.5rem",
              background: i === resultIndex ? "var(--tile-focus)" : "var(--tile)",
              border: i === resultIndex ? "2px solid var(--accent)" : "2px solid transparent",
            }}
          >
            <div style={{ width: "2.4rem", height: "2.4rem", color: accentFor(t.id) }}>
              <ServiceIcon id={t.id} />
            </div>
            <span style={{ fontSize: "0.85rem", textAlign: "center" }}>{t.label}</span>
          </div>
        ))}
        {query && results.length === 0 && (
          <span style={{ color: "var(--muted)", fontSize: "1rem" }}>no matches</span>
        )}
      </div>

      {KEY_ROWS.map((keys, r) => (
        <div key={r} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          {[...keys].map((k, c) => (
            <div
              key={k}
              style={{
                width: "3.5rem",
                height: "3.5rem",
                display: "grid",
                placeItems: "center",
                background: r === row && c === col ? "var(--tile-focus)" : "var(--tile)",
                border: r === row && c === col ? "2px solid var(--accent)" : "2px solid transparent",
                borderRadius: "0.5rem",
                fontSize: "1.4rem",
              }}
            >
              {k}
            </div>
          ))}
        </div>
      ))}
      <div style={{ display: "flex", marginBottom: "0.5rem" }}>
        <div
          style={{
            width: "20rem",
            height: "3.5rem",
            display: "grid",
            placeItems: "center",
            background: row === 3 ? "var(--tile-focus)" : "var(--tile)",
            border: row === 3 ? "2px solid var(--accent)" : "2px solid transparent",
            borderRadius: "0.5rem",
            fontSize: "1rem",
            color: "var(--muted)",
          }}
        >
          space
        </div>
      </div>

      <ButtonHints
        hints={[
          { glyph: "dpad", label: "Move" },
          { glyph: "cross", label: "Type key" },
          { glyph: "L1/R1", label: "Cycle results" },
          { glyph: "triangle", label: "Launch selected" },
          { glyph: "circle", label: "Back" },
        ]}
      />
    </div></CodexPanelShell>
  );
}
