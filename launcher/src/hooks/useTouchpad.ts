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

export function useTouchpad(onDrag: (drag: DragState) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const cb = useRef(onDrag);
  cb.current = onDrag;

  useController((pad: PadState) => {
    if (!pad.touch_active) {
      if (start.current) {
        start.current = null;
        cb.current({ dx: 0, dy: 0, active: false });
      }
      return;
    }
    if (!start.current) start.current = { x: pad.touch_x, y: pad.touch_y };
    cb.current({
      dx: pad.touch_x - start.current.x,
      dy: pad.touch_y - start.current.y,
      active: true,
    });
  });
}
