import { useEffect, useRef, useState } from "react";

/**
 * Frame-time HUD. Settings > Performance.
 *
 * Every motion change in this project so far has been accepted on "looks
 * fine" — this is what makes the claims checkable. It reports the numbers that
 * actually matter for a 10-foot UI on a 1440p panel: the frame budget you're
 * over, not just an averaged FPS that hides every hitch.
 *
 * - **p95 frame time** is the headline, not the mean. A dropped frame every
 *   second averages away to nothing but is exactly what reads as "janky".
 * - **Dropped frames** counts frames that missed the display's budget, derived
 *   from the observed refresh rate rather than an assumed 60Hz — this panel
 *   runs at 1440p and may well be 120/144.
 *
 * Deliberately cheap: no React state per frame (that would itself cost frames).
 * rAF writes into a ref-held ring buffer and the visible text is refreshed on a
 * timer, so the HUD costs roughly one text update a second regardless of
 * framerate.
 */

const SAMPLES = 240; // ~2-4s of history depending on refresh rate

export function PerfHud() {
  const [text, setText] = useState("measuring…");
  const times = useRef<Float32Array>(new Float32Array(SAMPLES));
  const count = useRef(0);
  const dropped = useRef(0);
  const total = useRef(0);
  // Longest frame budget observed, used to infer the refresh rate. Starts at a
  // 60Hz-ish guess and converges down on a faster panel.
  const budget = useRef(1000 / 60);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let running = true;

    const tick = (now: number) => {
      if (!running) return;
      const delta = now - last;
      last = now;
      // Ignore absurd gaps (tab hidden, window restored) — they aren't jank.
      if (delta > 0 && delta < 500) {
        times.current[count.current % SAMPLES] = delta;
        count.current++;
        total.current++;
        // Infer the panel's real frame budget from the fastest frames we see.
        if (delta > 1 && delta < budget.current) budget.current = Math.max(delta, 1000 / 480);
        if (delta > budget.current * 1.5) dropped.current++;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const report = window.setInterval(() => {
      const n = Math.min(count.current, SAMPLES);
      if (n < 10) return;
      const window_ = Array.from(times.current.slice(0, n)).sort((a, b) => a - b);
      const p50 = window_[Math.floor(n * 0.5)];
      const p95 = window_[Math.floor(n * 0.95)];
      const fps = 1000 / p50;
      setText(`${fps.toFixed(0)} fps · p50 ${p50.toFixed(1)}ms · p95 ${p95.toFixed(1)}ms · dropped ${dropped.current}/${total.current}`);
    }, 1000);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      clearInterval(report);
    };
  }, []);

  return <div className="codex-perf-hud" role="status" aria-live="off">
    <style>{CSS}</style>
    {text}
  </div>;
}

const CSS = `
.codex-perf-hud{position:fixed;top:.6cqh;left:50%;transform:translateX(-50%);z-index:40;pointer-events:none;
  padding:.45cqh 1cqw;border-radius:.9cqh;
  font:700 1.05cqh/1 "Manrope",ui-monospace,monospace;letter-spacing:.02em;
  font-variant-numeric:tabular-nums;
  color:rgba(255,255,255,.92);background:rgba(4,6,10,.72);border:1px solid rgba(255,255,255,.14);
  /* No backdrop-filter here on purpose: a blur behind the perf overlay would
     itself cost frames and corrupt the thing being measured. */
}
`;
