# Native overlay — 20-toggle benchmark

**Run:** 2026-07-15, local desktop compositor  
**Command:** `cargo run --release -- --benchmark`  
**Surface:** dependency-free Win32 topmost, translucent, click-through,
no-activation proof window. Each sample uses `DwmFlush` after show/hide, so it
measures compositor completion rather than only a Rust API call.

| Metric | Result |
|---|---:|
| Show average | 19.55 ms |
| Show p95 | 31.13 ms |
| Show maximum | 31.18 ms |
| Hide average | 18.94 ms |
| Hide p95 | 31.20 ms |
| Hide maximum | 31.41 ms |

## Interpretation

The Stage 1 native window mechanics are comfortably within a 60 Hz frame on
average and within two frames at p95. This proves that a native click-through
surface can toggle cleanly on this PC. It does **not** prove a visual win over
the prewarmed Tauri Quick Menu yet: this proof has no production glass renderer,
controller bridge, or equivalent UI workload.

`GetGuiResources` changed after window destruction in this short run; treat it
as a telemetry observation rather than a leak verdict. The next native gate is
a longer 100-toggle run with creation/destruction and a same-workload Tauri
comparison. Do not integrate the proof into production based on this result.

## Coverage boundary

The test covered the desktop compositor/window mechanics only. It works over
desktop and borderless/windowed targets. It does not—and must not claim to—show
above Fortnite in exclusive fullscreen. No injection, hooks, anti-cheat
workarounds, or process modification are part of this project.
