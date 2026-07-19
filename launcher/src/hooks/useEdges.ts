// Shared controller edge detection.
//
// Every consumer used to hand-roll its own `prev*` refs, and two shipped bugs
// came from the same two mistakes:
//
//   1. NOT SAMPLING EVERY FRAME. CodexLauncher returned early on `!inputEnabled`
//      (and again inside each modal branch) *before* updating its prev refs. The
//      refs went stale while the user was actually pressing buttons, so the
//      moment input re-enabled, a still-held button read as a fresh press and
//      fired an action nobody asked for — "the first command closes the launcher".
//
//   2. SEEDING THE BASELINE FROM ZERO. QuickOverlay initialised its refs to
//      "nothing is pressed", but it's summoned by a double-PS with a hand on the
//      pad. A button already down at mount looked like a new press, so the first
//      input got eaten establishing the baseline — "Console Home needs two
//      presses".
//
// This hook owns both invariants so no consumer can get them wrong again:
//
//   * `sync(pad)` is called on EVERY frame, before any early return or mode
//     branch. "What was pressed last frame" is always truthful.
//   * The first observed frame ARMS the tracker: it adopts the pad's real state
//     and reports no edges. A button already held when a component mounts is
//     never mistaken for a press.
//
// Usage:
//   const edges = useEdges();
//   useController((pad) => {
//     const e = edges.sync(pad);          // always, unconditionally
//     if (!inputEnabled) return;          // safe: state was still sampled
//     if (e.rising("cross")) ...
//     const dir = e.hat();                // d-pad edge, null if unchanged
//   });

import { useRef } from "react";
import { PadState } from "./useController";

/** Buttons we track edges for. */
export type EdgeButton = "cross" | "circle" | "square" | "triangle" | "ps" | "options" | "touchpad_btn";

const HAT_NEUTRAL = 8;

export interface EdgeFrame {
  /** True only on a genuine false -> true transition since the last frame. */
  rising: (button: EdgeButton) => boolean;
  /** True only on a genuine true -> false transition. */
  falling: (button: EdgeButton) => boolean;
  /** Current d-pad value if it changed this frame, else null. 8 = neutral. */
  hat: () => number | null;
  /** Bits in the shoulder byte that went 0 -> 1 this frame. */
  shoulderEdge: () => number;
  /** Raw shoulder byte this frame. */
  shoulders: () => number;
  /**
   * False on the very first frame after mount/reset, when the baseline is being
   * adopted from the real pad. No edges are ever reported while unarmed.
   */
  armed: boolean;
}

interface Snapshot {
  buttons: Record<EdgeButton, boolean>;
  dpad: number;
  shoulders: number;
}

const BUTTONS: EdgeButton[] = ["cross", "circle", "square", "triangle", "ps", "options", "touchpad_btn"];

function snapshot(pad: PadState): Snapshot {
  const buttons = {} as Record<EdgeButton, boolean>;
  for (const b of BUTTONS) buttons[b] = !!pad[b];
  return { buttons, dpad: pad.dpad, shoulders: (pad.buttons >> 8) & 0xff };
}

const NO_EDGES: EdgeFrame = {
  rising: () => false,
  falling: () => false,
  hat: () => null,
  shoulderEdge: () => 0,
  shoulders: () => 0,
  armed: false,
};

export function useEdges() {
  const prev = useRef<Snapshot | null>(null);

  /**
   * Sample this frame and return its edges. MUST be called on every controller
   * frame, before any early return — that is what keeps the baseline truthful.
   */
  function sync(pad: PadState): EdgeFrame {
    const now = snapshot(pad);
    const before = prev.current;
    prev.current = now;

    // First frame after mount/reset: adopt reality, report nothing.
    if (!before) return { ...NO_EDGES, shoulders: () => now.shoulders };

    return {
      rising: (b) => now.buttons[b] && !before.buttons[b],
      falling: (b) => !now.buttons[b] && before.buttons[b],
      hat: () => (now.dpad !== before.dpad ? now.dpad : null),
      shoulderEdge: () => now.shoulders & ~before.shoulders,
      shoulders: () => now.shoulders,
      armed: true,
    };
  }

  /**
   * Drop the baseline so the next frame re-arms from the real pad. Call when a
   * surface takes over input mid-press (e.g. an overlay opening) and must not
   * inherit an in-flight button as a fresh press.
   */
  function reset() {
    prev.current = null;
  }

  return { sync, reset, HAT_NEUTRAL };
}
