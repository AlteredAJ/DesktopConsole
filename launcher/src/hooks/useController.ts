// UNIT A — subscribe to the backend "pad-state" event stream.

import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";

export interface PadState {
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  buttons: number;
  dpad: number; // hat 0..8 (8 = neutral)
  cross: boolean;
  circle: boolean;
  square: boolean;
  triangle: boolean;
  touchpad_btn: boolean;
  ps: boolean;
  options: boolean;
  battery_percent?: number | null;
  charging?: boolean;
  // Unit B
  touch_active: boolean;
  touch_x: number;
  touch_y: number;
}

/**
 * Calls `onPad` on every controller frame. The callback is kept in a ref so
 * subscribers don't need to memoize it.
 */
export function useController(onPad: (pad: PadState) => void) {
  const cb = useRef(onPad);
  const pending = useRef<PadState | null>(null);
  const frame = useRef<number | null>(null);
  cb.current = onPad;

  useEffect(() => {
    // Native code already reduces HID traffic to ~60Hz. Coalescing once more at
    // the browser's paint boundary prevents a busy game/GPU from making React
    // process a backlog of stale controller frames; button edges still arrive
    // in the newest state on the very next frame.
    const flush = () => {
      frame.current = null;
      const next = pending.current;
      pending.current = null;
      if (next) cb.current(next);
    };
    const un = listen<PadState>("pad-state", (e) => {
      pending.current = e.payload;
      if (frame.current === null) frame.current = requestAnimationFrame(flush);
    });
    return () => {
      un.then((f) => f());
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      pending.current = null;
    };
  }, []);
}
