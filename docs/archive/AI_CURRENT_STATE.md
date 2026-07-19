# PS5 Mode — current state

**Last updated:** 2026-07-15 16:14 America/New_York  
**Current release:** `C:\Users\Altered\Desktop\PS5-Mode-Codex-Final-2026-07-14`  
**Launcher binary:** `ps5-launcher.exe`, built 2026-07-15 16:13:03  
**Runtime:** one `ps5-listener.exe` + one `ps5-launcher.exe`; no localhost listener.

## Last completed

- Power menu is compact, vertical, scrollbar-free, and now uses deeper layered frosted/liquid glass.
- Quick Menu has custom OpenRGB scene controls, persistent cross-window accents, separate time/battery elements, and context-aware Resume behavior.
- Game scanning is explicit only: Settings > System > Rescan Games.
- Home no longer runs a remote animated iframe or automatic drive scan at entry.
- Controller messages are coalesced to browser paint cadence; HID gestures remain native.
- Live App Backdrop Stage 1 is implemented: a native `PrintWindow` snapshot is
  prepared only for an unambiguous, visible, non-minimized selected app window.
  It crossfades over Hero only after the frame has passed validation.
- `native-overlay-poc/` now contains a buildable dependency-free Win32
  click-through/no-activation/topmost window proof. It is still isolated from
  production input and the shipping Quick Menu.
- `unreal-scaffold/PRESENTATION_BRIDGE.md` now defines Unreal's optional
  premium Home/Idle presentation boundary and local named-pipe contract.
- Native Stage 1 benchmark completed: 20 compositor-flushed show/hide cycles
  averaged 19.55/18.94 ms, p95 ~31 ms. See
  `native-overlay-poc/BENCHMARK_2026-07-15.md`; this is not yet an equal-
  workload comparison against Tauri.
- Unreal has an initial usable plugin endpoint:
  `UPS5ModePresentationSubsystem` exposes scene/accent/theme state to UMG,
  materials, and Niagara through a Blueprint event. UE is not installed on
  this PC, so compilation waits for the selected UE 5.x install.
- Native 100-toggle follow-up passed with 19.86 ms show average / 31.36 ms p95
  and 20.90 ms hide average / 31.15 ms p95. See
  `native-overlay-poc/BENCHMARK_100_2026-07-15.md`.
- A separate UE 5.8 project is now implemented and compiled successfully at
  `C:\Users\Altered\Documents\Projects\PS5Mode-Presentation-Unreal`.
  It launches a working PS5 Mode Idle/Home presentation and includes the
  `PS5ModeOverlay` plugin endpoint. Read that project's `README.md` and
  `AI_HANDOFF.md` before changing it.
- UE quality foundation is working: Performance, Balanced, and High Quality
  change effects/Niagara/bloom budgets while keeping output UI at native
  resolution; ray tracing is disabled in every profile. The initial launch
  was visually validated on 2026-07-15.
- The Unreal Idle/Home prototype now has a live fade-in, drifting sparkle
  field, eased Idle-to-Home blend, and persisted local presentation settings.
- The discarded flat Unreal Home carousel has been removed. The Unreal
  presentation now starts from a PS-button gate; its restrained sparkle/pulse
  language is the direction to preserve as authored UMG/material/Niagara and
  Sequencer work replaces the current code-native placeholder.
- Launcher entry is intentionally two-stage: the existing deliberate external
  PS gesture opens the dark JS gate, then one PS edge in that visible gate
  triggers haptic feedback and the 760 ms sparkles/float/fade into Home. The
  gate copy is now “Press the PS button to start.” Do not change the external
  gesture to a global single PS press: it would steal controller input from
  games.
- The entry/idle visual is the sparse centered `PS 5 MODE` wordmark over the
  cool-black constellation; do not restore the discarded generic controller
  circle. `CodexLauncher` must keep both the null-config fallback and the
  explicit `liveBackdrop && activeTile` check: comparing two optional values
  alone made `undefined === undefined` true and crashed first paint.

## Next implementation — do not improvise the behavior

Next target: replace the Unreal `NativePaint` placeholder with authored
UMG/material/Niagara assets and an Idle-to-Home Level Sequence. Keep
native/Tauri in charge of quick overlay, controller input, haptics, focus,
and app lifecycle.

- It is a native, best-effort feature for eligible desktop/windowed apps.
- Preflight the exact app source offscreen; show only hero art until a valid source is ready.
- Then crossfade once. No flicker, no late fallback flash, no guessing among multiple app windows.
- Hero art remains the silent fallback for fullscreen, protected, minimized, black, missing, or ambiguous sources.
- The native proof stays isolated until it has an equal-workload Tauri
  comparison and a 100-toggle resource run. It will not cover exclusive
  fullscreen Fortnite without unsafe techniques this project does not use.

## Fast verification commands

```powershell
cd C:\Users\Altered\Documents\Projects\ps5-mode-codex-rebuild\launcher
node node_modules\typescript\bin\tsc --noEmit
node node_modules\@tauri-apps\cli\tauri.js build --no-bundle
```

Use the bundled runtime Node path documented in `CLAUDE_FINAL_HANDOFF.md` if `node` is unavailable. After release swapping, verify one launcher, one listener, and no port 1420 listener.
