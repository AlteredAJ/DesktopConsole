# Research brief: PS5 Mode overlay, performance, and system UX

Act as a senior Windows graphics/overlay engineer and console UX researcher. Produce a source-backed decision memo for a personal Windows “PS5 Mode” launcher. This is not a request for game cheating, DLL injection, bypassing anti-cheat, or copying proprietary assets. Favor safe, supported Windows approaches.

## Current project

- Windows 11 personal launcher built with **Rust + Tauri v2 + WebView2 + React**.
- A resident DualSense HID listener opens the console with a PS-button gesture.
- The console launches apps/games, then hides its full-screen window.
- A new transparent, borderless, always-on-top, click-through Tauri Quick Menu is controlled through the same HID stream. It is prewarmed at startup and intended to appear while a game/app has focus.
- It is lightweight and standalone; it must not need a localhost server.
- Observed pain points: occasional freezes during repeated launch/close cycles and transitions between full console and Quick Menu. The current target is desktop + borderless/windowed games; ordinary Windows overlays can be covered by exclusive fullscreen.
- Future option: Unreal Engine only for optional premium 3D home/idle backgrounds. Native code should remain owner of global input, haptics, focus, launching, and the actual overlay.

Read `OVERLAY_ARCHITECTURE.md` and `unreal-scaffold/OverlayContract.json` in the supplied source handoff before responding.

## What to research

### 1. A safe, robust in-game overlay on Windows

Compare these approaches for this exact personal launcher:

1. Current Tauri/WebView2 transparent topmost window.
2. Rust native Win32 + DirectComposition/D3D11 or D3D12 overlay window (no injection).
3. Windows Game Bar / Xbox Game Bar widgets or other officially supported Windows surfaces.
4. Steam-style/in-process rendering only as a technical comparison: explain anti-cheat, maintenance, security, and compatibility risks; do **not** provide injection or bypass instructions.
5. Unreal or Godot as an overlay host versus as a separate optional presentation app.

For each, score 1–5 and explain: exclusive-fullscreen coverage, borderless support, anti-cheat safety, input pass-through, controller/global hotkey control, GPU/CPU/RAM cost, cold-open latency, HDR/VRR/multi-monitor behavior, Windows 11 compatibility, packaging complexity, and maintenance cost.

Explicitly distinguish what is guaranteed, what is best-effort, and what cannot be achieved safely without an in-process overlay. Explain whether exclusive fullscreen is still meaningful on current Windows 11/DX12 games and what user-facing fallback behavior is appropriate when the overlay cannot appear.

### 2. Performance diagnosis and architecture

Analyze likely stalls in this stack:

- WebView2 startup and a second webview/window.
- Fullscreen/topmost/minimize/restore compositor changes.
- React input rendering at controller polling rates.
- HID contention between listener, launcher, and haptics writer.
- Windows focus changes, DWM composition, GPU process lifecycle, and background throttling.

Recommend a lean architecture with explicit state machine(s) for `console`, `yielded`, `overlay`, `rest`, and `exiting`; event coalescing/debouncing; telemetry; watchdogs; graceful fallback; and a repeatable stress-test matrix. Recommend concrete latency/frame-time budgets for menu open, close, navigation, and app launch. Identify whether Unreal would reduce or increase these specific stalls.

### 3. PS5 system UI/UX reference study

Research the behavior and visual grammar of the real PS5 system UI from official PlayStation materials, manuals, support pages, developer talks, and reputable first-hand analyses. Do not recommend copying Sony assets, sounds, logos, or proprietary fonts.

Document:

- Startup, user entry, idle/rest, home, game switch, and return-to-game flows.
- Control Center / quick-menu hierarchy, card layout, focus behavior, transition pacing, backdrop treatment, and dismiss behavior.
- Controller conventions: PS, Cross/Circle, D-pad/stick, touchpad, haptic/audio cues, hold versus tap, and error/recovery behavior.
- UX principles that translate well to a Windows couch launcher: focus retention, interruption handling, safe system power actions, status visibility, accessibility, and user feedback.
- A clearly labeled “inspired by, not copied” visual design system: spacing, elevation, blur, color, motion curves, and motion duration ranges.

### 4. Unreal readiness

Recommend the smallest possible Unreal role. Specify:

- What must remain native/Tauri.
- What Unreal can own later (3D backgrounds, particles, animated scene graph, video/hero art).
- A low-risk local IPC contract (named pipe preferred; no public port), lifecycle, crash isolation, and a fallback when Unreal is unavailable.
- Whether Unreal should be launched as a separate fullscreen scene, embedded, or avoided for this project phase.

## Required output

1. **Executive recommendation**: choose a primary path and a fallback path.
2. **Evidence table**: every important claim has a direct official/primary URL and access date. Prefer Microsoft, Tauri, Epic, Godot, Valve, PlayStation, and standards/vendor documentation.
3. **Decision matrix** for all overlay approaches with the scored criteria above.
4. **90-day staged roadmap** with three small validation milestones, not a big rewrite.
5. **Concrete changes to this repository**: file/module boundaries, state transitions, performance instrumentation, and test cases. Do not invent APIs without marking them as proposed.
6. **Risks and kill criteria**: what observations would mean we should abandon Tauri overlay, avoid Unreal, or narrow support to borderless mode.
7. **PS5-inspired interaction spec** for the first polished Control Center pass.

Be precise, skeptical, and concise. Separate verified facts from inference. Do not make up benchmark numbers; label estimates and explain their basis.
