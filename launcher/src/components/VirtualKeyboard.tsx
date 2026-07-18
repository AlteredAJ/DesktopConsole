import { useRef, useState } from "react";
import { useController } from "../hooks/useController";
import { useTouchpad } from "../hooks/useTouchpad";
import { ButtonHints } from "./ButtonHints";
import { CodexPanelShell } from "./CodexPanelShell";
import { selectFeedback } from "../feedback";
import { getControllerSettings } from "../settings";

const HAT_UP = 0; const HAT_RIGHT = 2; const HAT_DOWN = 4; const HAT_LEFT = 6;
const ACTIONS = ["Shift", "Space", "Delete", "Done"] as const;
const KEYBOARD_SWIPE_ROW_DISTANCE = 340;
const KEYBOARD_SWIPE_COLUMN_DISTANCE = 420;
const LAYOUTS = {
  lower: ["qwertyuiop", "asdfghjkl", "zxcvbnm"],
  upper: ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"],
  symbols: ["1234567890", "!@#$%^&*()", "-_+=[]{}\\|"],
} as const;
type Layout = keyof typeof LAYOUTS;
interface VirtualKeyboardProps { onDone: (text: string) => void; title?: string; subtitle?: string; placeholder?: string; secret?: boolean; }

/** Controller-first text entry for search, Wi-Fi, and other console actions. */
export function VirtualKeyboard({ onDone, title = "Keyboard", subtitle = "D-pad, left stick, or touchpad to choose a key.", placeholder = "Type something...", secret = false }: VirtualKeyboardProps) {
  const [text, setText] = useState(""); const [row, setRow] = useState(0); const [col, setCol] = useState(0); const [layout, setLayout] = useState<Layout>("lower");
  const prevHat = useRef(8); const prevStick = useRef<"up" | "down" | "left" | "right" | null>(null); const prevCross = useRef(false); const prevTouchpadButton = useRef(false); const prevSquare = useRef(false); const dragStart = useRef<{ row: number; col: number } | null>(null);
  const rowLength = (r: number) => r === 3 ? ACTIONS.length : LAYOUTS[layout][r as 0 | 1 | 2].length;
  function move(direction: number) {
    if (direction === HAT_LEFT) setCol((value) => Math.max(0, value - 1));
    else if (direction === HAT_RIGHT) setCol((value) => Math.min(rowLength(row) - 1, value + 1));
    else if (direction === HAT_UP) setRow((value) => { const next = Math.max(0, value - 1); setCol((current) => Math.min(current, rowLength(next) - 1)); return next; });
    else if (direction === HAT_DOWN) setRow((value) => { const next = Math.min(3, value + 1); setCol((current) => Math.min(current, rowLength(next) - 1)); return next; });
  }
  function commit() {
    if (row < 3) { setText((value) => value + LAYOUTS[layout][row as 0 | 1 | 2][col]); return; }
    const action = ACTIONS[col];
    if (action === "Shift") setLayout((value) => value === "lower" ? "upper" : value === "upper" ? "symbols" : "lower");
    else if (action === "Space") setText((value) => value + " ");
    else if (action === "Delete") setText((value) => value.slice(0, -1));
    else onDone(text);
  }
  useController((pad) => { if (pad.dpad !== prevHat.current) { prevHat.current = pad.dpad; move(pad.dpad); } const stick = Math.abs(pad.lx - 128) > 52 ? (pad.lx > 128 ? "right" : "left") : Math.abs(pad.ly - 128) > 52 ? (pad.ly > 128 ? "down" : "up") : null; if (stick !== prevStick.current) { prevStick.current = stick; if (stick === "left") move(HAT_LEFT); if (stick === "right") move(HAT_RIGHT); if (stick === "up") move(HAT_UP); if (stick === "down") move(HAT_DOWN); } if ((pad.cross && !prevCross.current) || (pad.touchpad_btn && !prevTouchpadButton.current)) { selectFeedback(); commit(); } if (pad.square && !prevSquare.current) setText((value) => value.slice(0, -1)); prevCross.current = pad.cross; prevTouchpadButton.current = pad.touchpad_btn; prevSquare.current = pad.square; });
  useTouchpad((drag) => { if (!drag.active) { dragStart.current = null; return; } if (!dragStart.current) dragStart.current = { row, col }; const start = dragStart.current; const sensitivity = getControllerSettings().keyboardSwipeSensitivity; const nextRow = Math.max(0, Math.min(3, start.row + Math.round(drag.dy / (KEYBOARD_SWIPE_ROW_DISTANCE / sensitivity)))); const nextCol = Math.max(0, Math.min(rowLength(nextRow) - 1, start.col + Math.round(drag.dx / (KEYBOARD_SWIPE_COLUMN_DISTANCE / sensitivity)))); setRow(nextRow); setCol(nextCol); });
  const key = (value: string, r: number, c: number) => <button key={`${r}-${c}-${value}`} className={r === row && c === col ? "is-selected" : ""} style={{ minWidth: r === 3 ? (value === "Space" ? "13rem" : "7rem") : "3.7rem" }} onClick={() => { setRow(r); setCol(c); }}><span>{value}</span></button>;
  const visibleText = secret && text ? "•".repeat(text.length) : text;
  return <CodexPanelShell eyebrow="TEXT INPUT" title={title} subtitle={subtitle}><div className="codex-keyboard"><div className="codex-keyboard-value">{visibleText || <span>{placeholder}</span>}</div><div className="codex-keyboard-layout">{layout === "lower" ? "abc" : layout === "upper" ? "ABC" : "123"}</div><div className="codex-keyboard-grid">{LAYOUTS[layout].map((letters, r) => <div key={`${layout}-${letters}`}>{[...letters].map((letter, c) => key(letter, r, c))}</div>)}<div>{ACTIONS.map((action, c) => key(action, 3, c))}</div></div><ButtonHints hints={[{ glyph: "dpad", label: "Navigate" }, { glyph: "cross", label: "Enter" }, { glyph: "square", label: "Delete" }, { glyph: "circle", label: "Back" }]} /><style>{CSS}</style></div></CodexPanelShell>;
}
const CSS = `.codex-keyboard{display:flex;flex-direction:column;min-height:100%;gap:1.25cqh}.codex-keyboard-value{min-height:7cqh;padding:1.6cqh 1.5cqw;border:1px solid rgba(255,255,255,.15);border-radius:1.4cqh;background:rgba(4,6,10,.38);font-size:2.25cqh;box-shadow:inset 0 1px rgba(255,255,255,.12)}.codex-keyboard-value span{color:rgba(255,255,255,.43)}.codex-keyboard-layout{font:800 1.1cqh/1 "Manrope",sans-serif;letter-spacing:.12em;color:rgba(255,255,255,.55);text-transform:uppercase}.codex-keyboard-grid{display:flex;flex-direction:column;gap:.9cqh}.codex-keyboard-grid>div{display:flex;gap:.65cqw}.codex-keyboard-grid button{height:6cqh;border:1px solid rgba(255,255,255,.1);border-radius:1.1cqh;background:rgba(255,255,255,.055);color:#fff;font:700 1.7cqh "Manrope",sans-serif;cursor:pointer}.codex-keyboard-grid button.is-selected{border:2px solid #fff;background:linear-gradient(135deg,rgba(255,255,255,.24),rgba(70,127,212,.32));box-shadow:0 0 0 .25cqh rgba(255,255,255,.16),0 0 2cqh rgba(92,150,255,.55)}`;
