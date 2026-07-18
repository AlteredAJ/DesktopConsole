// UNIT A/B — grid focus state machine. Consumes D-pad AND touchpad swipes to move
// a focus index across `count` tiles laid out in `cols` columns. Fires a haptic
// confirm pulse ONLY when focus actually moves — a swipe/press at a grid edge
// (no-op) stays silent, which is the whole point: no buzz means "that didn't do
// anything," by design (see rumble.rs).

import { useCallback, useRef, useState } from "react";
import { navFeedback } from "../feedback";

// DualSense hat values (buf[8] low nibble). 8 = neutral.
const HAT_UP = 0;
const HAT_RIGHT = 2;
const HAT_DOWN = 4;
const HAT_LEFT = 6;

export type Direction = "up" | "down" | "left" | "right";

function nextFocus(f: number, count: number, cols: number, dir: Direction): number {
  const row = Math.floor(f / cols);
  const col = f % cols;
  const rows = Math.ceil(count / cols);
  switch (dir) {
    case "left":
      return col > 0 ? f - 1 : f;
    case "right":
      return col < cols - 1 && f + 1 < count ? f + 1 : f;
    case "up":
      return row > 0 ? f - cols : f;
    case "down":
      return row < rows - 1 && f + cols < count ? f + cols : f;
  }
}

export function useGridNav(count: number, cols: number) {
  const [focus, setFocus] = useState(0);
  // Edge-detect the hat so a held direction moves one cell, not many.
  const prevHat = useRef(8);

  const move = useCallback(
    (dir: Direction) => {
      setFocus((f) => {
        const next = nextFocus(f, count, cols, dir);
        if (next !== f) navFeedback();
        return next;
      });
    },
    [count, cols],
  );

  const onDpad = useCallback(
    (hat: number) => {
      if (hat === prevHat.current) return;
      prevHat.current = hat;
      const dir =
        hat === HAT_LEFT ? "left" : hat === HAT_RIGHT ? "right" : hat === HAT_UP ? "up" : hat === HAT_DOWN ? "down" : null;
      if (dir) move(dir);
    },
    [move],
  );

  // Absolute jump (touchpad drag maps swipe distance directly to a target
  // index, not a series of relative hops) — one haptic tick for the whole
  // gesture's net movement, not one per intermediate tile.
  const jumpTo = useCallback((index: number) => {
    setFocus((f) => {
      const clamped = Math.max(0, Math.min(count - 1, index));
      if (clamped !== f) navFeedback();
      return clamped;
    });
  }, [count]);

  return { focus, setFocus, onDpad, move, jumpTo };
}
