// Cross-app fuzzy search-to-launch Ã¢â‚¬â€ spans YouTube/Netflix/Discord/exes/
// launcher apps since it matches over our own config.rs tile list (see
// utils/fuzzy.ts for why this isn't Windows Search instead). Input is a
// D-pad-navigable on-screen keyboard (letter-grid select, not swipe-trace Ã¢â‚¬â€
// that's VirtualKeyboard.tsx's separate Unit B scope) so this doesn't have to
// wait on the swipe-to-type keyboard overlay to be useful today.

import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useController } from "../hooks/useController";
import { useEdges } from "../hooks/useEdges";
import { useKeyboardGrid } from "../hooks/useKeyboardGrid";
import { ButtonHints } from "./ButtonHints";
import { CodexPanelShell } from "./CodexPanelShell";
import { accentFor, ServiceIcon } from "./icons";
import { fuzzyFilter } from "../utils/fuzzy";
import { selectFeedback, navFeedback } from "../feedback";
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


const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm<"];
// Last row is a single wide space key. Hat/stick/swipe navigation and the
// swipe-travel constants now live in useKeyboardGrid, shared with
// VirtualKeyboard so the two keyboards can't drift apart.
const GRID_ROWS: readonly (readonly string[])[] = [...KEY_ROWS.map((keys) => [...keys]), [" "]];

export function Search({ onOpen }: { onOpen: (p: Panel) => void }) {
  const [query, setQuery] = useState("");
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [resultIndex, setResultIndex] = useState(0);
  // Button/d-pad/shoulder edges come from the shared tracker (baseline seeded
  // from the first real pad frame).
  const edges = useEdges();

  useEffect(() => {
    void invoke<RawAppConfig>("get_config").then((cfg) => {
      setTiles(cfg.apps.map((t) => ({ id: t.id, label: t.label, needsCursor: t.needs_cursor })));
    });
  }, []);

  const results = useMemo(() => fuzzyFilter(query, tiles, (t) => t.label), [query, tiles]);
  useEffect(() => setResultIndex(0), [query]);

  // Letter rows plus a single wide space key as the last row.
  const grid = useKeyboardGrid(GRID_ROWS, (key) => {
    if (key === " ") setQuery((q) => q + " ");
    else if (key === "<") setQuery((q) => q.slice(0, -1));
    else setQuery((q) => q + key);
  });

  function launch(tile?: Tile) {
    if (!tile) return;
    selectFeedback();
    if (tile.id === "youtube") return onOpen("youtube");
    void invoke("launch_app", { target: tile.id, needsCursor: tile.needsCursor });
  }
  useController((pad) => {
    const padEdge = edges.sync(pad); // always sample first — never behind a return
    grid.navigate(pad, padEdge);

    // Shoulders cycle the highlighted result instead of switching tabs here
    // (that's the Launcher grid's meaning for L1/R1 Ã¢â‚¬â€ Search repurposes them
    // since there's no tab row in this panel).
    const edge = padEdge.shoulderEdge();
    if (results.length > 0) {
      if (edge & 0x01) setResultIndex((i) => (navFeedback(), Math.max(0, i - 1)));
      if (edge & 0x02) setResultIndex((i) => (navFeedback(), Math.min(results.length - 1, i + 1)));
    }

    if (padEdge.rising("triangle")) launch(results[resultIndex]);
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
                background: grid.isSelected(r, c) ? "var(--tile-focus)" : "var(--tile)",
                border: grid.isSelected(r, c) ? "2px solid var(--accent)" : "2px solid transparent",
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
            background: grid.row === 3 ? "var(--tile-focus)" : "var(--tile)",
            border: grid.row === 3 ? "2px solid var(--accent)" : "2px solid transparent",
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
