// UNIT B — reports raw drag distance since finger-down, continuously, while
// the touchpad is active. The CALLER maps that distance directly to a target
// tile (see Launcher.tsx) — swipe further, land further, in one motion. This
// hook deliberately does NOT decide "how many tiles" itself (that was the bug:
// firing one hop per fixed distance unit felt like stepping through tiles one
// at a time no matter how fast/far you swiped, not a proportional swipe).

import { useRef } from "react";
import { useController, PadState } from "./useController";

export interface DragState {
  dx: number; // total horizontal travel since finger-down
  dy: number; // total vertical travel since finger-down
  active: boolean;
}

// Tap/click deadzone (in raw touchpad units — the pad reports ~1920×1080).
// Like a modern trackpad, we ignore the tiny wobble that happens as a finger
// first lands and presses to click, so a tap doesn't register as a drag and
// nudge the selection. Once travel crosses this, we re-anchor at the crossing
// point so movement begins from there with no sudden jump.
const DRAG_DEADZONE = 14;

export function useTouchpad(onDrag: (drag: DragState) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const moving = useRef(false);
  const cb = useRef(onDrag);
  cb.current = onDrag;

  useController((pad: PadState) => {
    if (!pad.touch_active) {
      if (start.current) {
        start.current = null;
        moving.current = false;
        cb.current({ dx: 0, dy: 0, active: false });
      }
      return;
    }
    if (!start.current) {
      start.current = { x: pad.touch_x, y: pad.touch_y };
      moving.current = false;
    }
    const rawX = pad.touch_x - start.current.x;
    const rawY = pad.touch_y - start.current.y;
    // Still inside the deadzone: finger is down but hasn't committed to a drag.
    if (!moving.current) {
      if (Math.hypot(rawX, rawY) < DRAG_DEADZONE) {
        cb.current({ dx: 0, dy: 0, active: true });
        return;
      }
      // Crossed the threshold — start the drag from here, not from first touch.
      moving.current = true;
      start.current = { x: pad.touch_x, y: pad.touch_y };
      cb.current({ dx: 0, dy: 0, active: true });
      return;
    }
    cb.current({
      dx: pad.touch_x - start.current.x,
      dy: pad.touch_y - start.current.y,
      active: true,
    });
  });
}
