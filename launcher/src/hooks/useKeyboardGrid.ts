// C3 — the one keyboard core.
//
// Search.tsx and VirtualKeyboard.tsx each carried their own copy of the same
// grid: identical row/column clamping, identical hat + left-stick navigation,
// identical touchpad swipe-select, identical commit-on-cross/touchpad. Two
// keyboards that would drift apart the moment either was tuned — and the
// Desktop Mode bar would have made three.
//
// The grid lives here once. A caller supplies its key rows and says what a
// committed key means; everything else (where the cursor is, how it moves,
// how a swipe maps to a cell) is this hook's business.
//
// Navigation is deliberately NOT wrapped in its own useController. The caller
// already runs one, and each keyboard binds extra buttons of its own (Search
// uses shoulders for results and triangle to launch; VirtualKeyboard uses
// square to delete and circle to cancel). So the caller syncs the shared edge
// tracker once and hands the frame here — one tracker, one sample per frame,
// per useEdges' contract. Two trackers over one pad is exactly the
// double-consumption bug this project keeps having to fix.

import { useRef, useState } from "react";
import { useTouchpad } from "./useTouchpad";
import { MOTION } from "../motion";
import { getControllerSettings } from "../settings";
import { selectFeedback } from "../feedback";
import type { PadState } from "./useController";
import type { EdgeFrame } from "./useEdges";

const HAT_UP = 0;
const HAT_RIGHT = 2;
const HAT_DOWN = 4;
const HAT_LEFT = 6;
/// Left stick must leave this much of centre before it counts as a direction.
const STICK_DEADZONE = 52;

export type KeyRows = readonly (readonly string[])[];

export interface KeyboardGrid {
  row: number;
  col: number;
  /** Selection test for rendering — also the click handler's target. */
  isSelected: (row: number, col: number) => boolean;
  /** Direct selection, for mouse/touch clicks on a key. */
  setCell: (row: number, col: number) => void;
  /**
   * Feed one controller frame. Call from inside the caller's own
   * `useController`, after `edges.sync(pad)`, passing that frame.
   */
  navigate: (pad: PadState, edge: EdgeFrame) => void;
}

export function useKeyboardGrid(rows: KeyRows, onCommit: (key: string, row: number, col: number) => void): KeyboardGrid {
  const [row, setRow] = useState(0);
  const [col, setCol] = useState(0);
  // Stick direction is analog-derived, so it can't come from useEdges (which
  // tracks discrete buttons) — it keeps a local previous-direction ref.
  const prevStick = useRef<"up" | "down" | "left" | "right" | null>(null);
  const dragStart = useRef<{ row: number; col: number } | null>(null);
  // Kept in refs so `navigate` never closes over a stale layout or handler —
  // VirtualKeyboard swaps its whole row set when Shift changes the layout.
  const rowsRef = useRef(rows);
  const commitRef = useRef(onCommit);
  rowsRef.current = rows;
  commitRef.current = onCommit;

  const lastRow = () => rowsRef.current.length - 1;
  const rowLength = (r: number) => rowsRef.current[r]?.length ?? 1;

  function move(direction: number) {
    if (direction === HAT_LEFT) setCol((value) => Math.max(0, value - 1));
    else if (direction === HAT_RIGHT) setCol((value) => Math.min(rowLength(row) - 1, value + 1));
    else if (direction === HAT_UP) setRow((value) => {
      const next = Math.max(0, value - 1);
      setCol((current) => Math.min(current, rowLength(next) - 1));
      return next;
    });
    else if (direction === HAT_DOWN) setRow((value) => {
      const next = Math.min(lastRow(), value + 1);
      setCol((current) => Math.min(current, rowLength(next) - 1));
      return next;
    });
  }

  function navigate(pad: PadState, edge: EdgeFrame) {
    const hat = edge.hat();
    if (hat !== null) move(hat);

    const stick = Math.abs(pad.lx - 128) > STICK_DEADZONE
      ? (pad.lx > 128 ? "right" : "left")
      : Math.abs(pad.ly - 128) > STICK_DEADZONE
        ? (pad.ly > 128 ? "down" : "up")
        : null;
    if (stick !== prevStick.current) {
      prevStick.current = stick;
      if (stick === "left") move(HAT_LEFT);
      if (stick === "right") move(HAT_RIGHT);
      if (stick === "up") move(HAT_UP);
      if (stick === "down") move(HAT_DOWN);
    }

    if (edge.rising("cross") || edge.rising("touchpad_btn")) {
      selectFeedback();
      const key = rowsRef.current[row]?.[col];
      if (key !== undefined) commitRef.current(key, row, col);
    }
  }

  // Swipe-select: a drag maps to a cell offset from wherever the drag started,
  // so the cursor tracks the thumb instead of accumulating drift. Travel per
  // cell is deliberately larger than home navigation's (MOTION.keyboard) —
  // keys are small targets and an over-sensitive grid is unusable.
  useTouchpad((drag) => {
    if (!drag.active) { dragStart.current = null; return; }
    if (!dragStart.current) dragStart.current = { row, col };
    const start = dragStart.current;
    const sensitivity = getControllerSettings().keyboardSwipeSensitivity;
    const nextRow = Math.max(0, Math.min(lastRow(), start.row + Math.round(drag.dy / (MOTION.keyboard.swipeRowDistance / sensitivity))));
    const nextCol = Math.max(0, Math.min(rowLength(nextRow) - 1, start.col + Math.round(drag.dx / (MOTION.keyboard.swipeColumnDistance / sensitivity))));
    setRow(nextRow);
    setCol(nextCol);
  });

  return {
    row,
    col,
    isSelected: (r, c) => r === row && c === col,
    setCell: (r, c) => { setRow(r); setCol(c); },
    navigate,
  };
}
