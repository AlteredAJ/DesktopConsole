# Native overlay proof — isolated experiment

This folder is **not part of the shipping launcher**. It exists to answer one question with measurement:

> Can a small native Win32 composition surface beat the prewarmed Tauri Quick Menu enough to justify replacing only that surface?

## Scope

The first proof draws one transparent, no-activation, click-through, topmost test window. It is intentionally separate from game launching, HID, haptics, Tauri, Unreal, and the shipped package.

## What success means

1. It shows/hides cleanly over desktop and at least three borderless games.
2. It remains click-through; mouse/keyboard focus remains with the game.
3. It can be toggled 100 times without leaking handles or stalling the game.
4. Its measured first visible frame and repeated toggle time materially beat the prewarmed WebView2 overlay on this PC.
5. Its steady memory/GPU cost is lower enough to justify the added native maintenance.

If it does not meet those criteria, keep the optimized Tauri overlay. This is a test, not a promised migration.

## Planned stages

1. **Window mechanics:** native transparent topmost/click-through window with no focus steal.
2. **Composition:** D3D11 + Windows.UI.Composition/DirectComposition panel, opacity, scale, and one blur experiment.
3. **Input bridge:** local process message from the existing Rust HID owner; never a public port and never a second HID reader.
4. **Comparison:** record open/close latency, memory, GPU cost, frame pacing, and recovery under a repeatable 100-toggle test.

No DLL injection, `Present` hook, process modification, anti-cheat bypass, or exclusive-fullscreen claim belongs in this experiment.

## Current Stage 1 implementation

`src/main.rs` is now a real, dependency-free Win32 proof. It creates one
topmost, translucent, no-activation, click-through HUD window. It proves the
critical window behavior without starting another controller listener or
touching game processes. Press `Esc` to close the test window (the window does
not receive normal mouse focus by design).

It is **not** the production Quick Menu yet: it has no D3D renderer, blur,
named-pipe bridge, animation system, or controller toggle. Those come only if
the measured Stage 1 comparison earns the additional native complexity.

## Build

```powershell
cd native-overlay-poc
cargo run --release
```

Run the repeatable 20-toggle compositor benchmark with:

```powershell
cargo run --release -- --benchmark
```

The first recorded results are in `BENCHMARK_2026-07-15.md` and
`BENCHMARK_100_2026-07-15.md`. They are a gate for further native work, not a
production performance claim.

Keep it isolated while measuring. Add dependencies only after agreeing on
Stage 1's exact metrics.
