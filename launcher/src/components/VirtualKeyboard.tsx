import { useMemo, useState } from "react";
import { useController } from "../hooks/useController";
import { useEdges } from "../hooks/useEdges";
import { useKeyboardGrid } from "../hooks/useKeyboardGrid";
import { ButtonHints } from "./ButtonHints";
import { CodexPanelShell } from "./CodexPanelShell";

const ACTIONS = ["Shift", "Space", "Delete", "Done"] as const;
const LAYOUTS = {
  lower: ["qwertyuiop", "asdfghjkl", "zxcvbnm"],
  upper: ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"],
  symbols: ["1234567890", "!@#$%^&*()", "-_+=[]{}\\|"],
} as const;
type Layout = keyof typeof LAYOUTS;
interface VirtualKeyboardProps { onDone: (text: string) => void; onCancel?: () => void; title?: string; subtitle?: string; placeholder?: string; secret?: boolean; bare?: boolean; slim?: boolean; }

/**
 * Controller-first text entry for search, Wi-Fi, and other console actions.
 * `bare` skips the full-screen CodexPanelShell chrome so KeyboardOverlay can
 * mount just the grid+logic inside its own dimmed, floating panel.
 * `slim` shrinks the same grid for the bottom-docked Desktop Mode bar, which
 * has to stay under about a third of the screen so a browser field mid-page
 * is still visible while typing. Identical layout and input either way — it's
 * a second presentation, not a second keyboard.
 */
export function VirtualKeyboard({ onDone, onCancel, title = "Keyboard", subtitle = "D-pad, left stick, or touchpad to choose a key.", placeholder = "Type something...", secret = false, bare = false, slim = false }: VirtualKeyboardProps) {
  const [text, setText] = useState(""); const [layout, setLayout] = useState<Layout>("lower");
  // Edges via the shared tracker — the keyboard is summoned mid-press
  // (double-Share), so its baseline must come from the first real pad frame.
  const edges = useEdges();
  // Letter rows plus the action row, as the flat shape useKeyboardGrid wants.
  const rows = useMemo(() => [...LAYOUTS[layout].map((letters) => [...letters]), [...ACTIONS]], [layout]);
  const grid = useKeyboardGrid(rows, (value, r) => {
    if (r < 3) { setText((current) => current + value); return; }
    if (value === "Shift") setLayout((current) => current === "lower" ? "upper" : current === "upper" ? "symbols" : "lower");
    else if (value === "Space") setText((current) => current + " ");
    else if (value === "Delete") setText((current) => current.slice(0, -1));
    else onDone(text);
  });
  useController((pad) => {
    const edge = edges.sync(pad); // always sample first — never behind a return
    grid.navigate(pad, edge);
    if (edge.rising("square")) setText((value) => value.slice(0, -1));
    if (edge.rising("circle")) onCancel?.();
  });
  const key = (value: string, r: number, c: number) => <button key={`${r}-${c}-${value}`} className={grid.isSelected(r, c) ? "is-selected" : ""} style={{ minWidth: r === 3 ? (value === "Space" ? "13rem" : "7rem") : "3.7rem" }} onClick={() => grid.setCell(r, c)}><span>{value}</span></button>;
  const visibleText = secret && text ? "•".repeat(text.length) : text;
  const content = <div className={slim ? "codex-keyboard is-slim" : "codex-keyboard"}><div className="codex-keyboard-value">{visibleText || <span>{placeholder}</span>}</div><div className="codex-keyboard-layout">{layout === "lower" ? "abc" : layout === "upper" ? "ABC" : "123"}</div><div className="codex-keyboard-grid">{LAYOUTS[layout].map((letters, r) => <div key={`${layout}-${letters}`}>{[...letters].map((letter, c) => key(letter, r, c))}</div>)}<div>{ACTIONS.map((action, c) => key(action, 3, c))}</div></div><ButtonHints hints={[{ glyph: "dpad", label: "Navigate" }, { glyph: "cross", label: "Enter" }, { glyph: "square", label: "Delete" }, { glyph: "circle", label: "Back" }]} /><style>{CSS}</style></div>;
  if (bare) return content;
  return <CodexPanelShell eyebrow="TEXT INPUT" title={title} subtitle={subtitle}>{content}</CodexPanelShell>;
}
const CSS = `.codex-keyboard{display:flex;flex-direction:column;min-height:100%;gap:1.25cqh}.codex-keyboard-value{min-height:7cqh;padding:1.6cqh 1.5cqw;border:1px solid rgba(255,255,255,.15);border-radius:1.4cqh;background:rgba(4,6,10,.38);font-size:2.25cqh;box-shadow:inset 0 1px rgba(255,255,255,.12)}.codex-keyboard-value span{color:rgba(255,255,255,.43)}.codex-keyboard-layout{font:800 1.1cqh/1 "Manrope",sans-serif;letter-spacing:.12em;color:rgba(255,255,255,.55);text-transform:uppercase}.codex-keyboard-grid{display:flex;flex-direction:column;gap:.9cqh}.codex-keyboard-grid>div{display:flex;gap:.65cqw}.codex-keyboard-grid button{height:6cqh;border:1px solid rgba(255,255,255,.1);border-radius:1.1cqh;background:rgba(255,255,255,.055);color:#fff;font:700 1.7cqh "Manrope",sans-serif;cursor:pointer}.codex-keyboard-grid button.is-selected{border:2px solid #fff;background:linear-gradient(135deg,rgba(255,255,255,.24),rgba(70,127,212,.32));box-shadow:0 0 0 .25cqh rgba(255,255,255,.16),0 0 2cqh rgba(92,150,255,.55)}
/* Slim (bottom-docked Desktop Mode bar). Same grid, ~30cqh instead of ~40cqh
   so a browser field in the middle of the page stays visible while typing.
   Units stay screen-relative (the dock panel deliberately does NOT open its
   own size container) so these read as real on-screen sizes, not fractions of
   a short panel. */
.codex-keyboard.is-slim{gap:.55cqh}
.codex-keyboard.is-slim .codex-keyboard-value{min-height:0;padding:.75cqh 1.2cqw;font-size:1.6cqh;border-radius:.9cqh}
.codex-keyboard.is-slim .codex-keyboard-layout{font-size:.95cqh}
.codex-keyboard.is-slim .codex-keyboard-grid{gap:.5cqh}
.codex-keyboard.is-slim .codex-keyboard-grid>div{gap:.45cqw}
.codex-keyboard.is-slim .codex-keyboard-grid button{height:4.4cqh;font-size:1.45cqh;border-radius:.8cqh}`;
