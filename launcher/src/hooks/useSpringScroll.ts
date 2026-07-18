// Critically-damped scroll follow (apple-design default: damping ~1.0, no
// overshoot) that drives an element's scrollLeft toward a target imperatively
// via requestAnimationFrame.
//
// Why not `el.scrollTo({behavior:"smooth"})`: the native smooth-scroll runs a
// fixed-duration animation that is NOT interruptible — fire it again mid-flight
// (fast D-pad taps, a touchpad swipe scrubbing across many tiles) and it either
// queues or restarts with a visible seam. This always animates from the LIVE
// on-screen position toward the newest target, so retargeting is seamless and
// navigation feels continuous. Writes scrollLeft directly — never triggers a
// React re-render per frame. Honors prefers-reduced-motion by jumping.

import { useCallback, useEffect, useRef } from "react";

// Fraction of the remaining distance closed each frame. ~0.22 @ 60fps reads as a
// snappy, bounce-free settle (~150-200ms) — the Apple-TV dock glide, not a slow
// drift. Tuned for a 60Hz living-room panel.
const FOLLOW = 0.22;
const EPSILON = 0.5; // px; snap-and-stop threshold

export function useSpringScroll(ref: React.RefObject<HTMLElement | null>) {
  const st = useRef({ target: 0, raf: 0, running: false, reduce: false });

  useEffect(() => {
    st.current.reduce =
      typeof window !== "undefined" && !!window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
  }, []);

  const tick = useCallback(() => {
    const el = ref.current;
    if (!el) {
      st.current.running = false;
      return;
    }
    const cur = el.scrollLeft;
    const diff = st.current.target - cur;
    if (Math.abs(diff) < EPSILON) {
      el.scrollLeft = st.current.target;
      st.current.running = false;
      return;
    }
    el.scrollLeft = cur + diff * FOLLOW;
    st.current.raf = requestAnimationFrame(tick);
  }, [ref]);

  const scrollTo = useCallback(
    (target: number, immediate = false) => {
      const el = ref.current;
      if (!el) return;
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      st.current.target = Math.max(0, Math.min(max, target));
      if (immediate || st.current.reduce) {
        el.scrollLeft = st.current.target;
        st.current.running = false;
        return;
      }
      if (!st.current.running) {
        st.current.running = true;
        st.current.raf = requestAnimationFrame(tick);
      }
    },
    [ref, tick],
  );

  useEffect(() => {
    const state = st.current;
    return () => cancelAnimationFrame(state.raf);
  }, []);

  return scrollTo;
}
