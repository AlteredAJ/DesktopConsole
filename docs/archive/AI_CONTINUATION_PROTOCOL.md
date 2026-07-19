# AI continuation protocol

This file is the required operating procedure for any AI or new workspace that continues PS5 Mode.

## Read order — required before touching code

1. `README_FIRST_FOR_CLAUDE.md`
2. `CLAUDE_FINAL_HANDOFF.md` — authoritative visual and behavior contract
3. `PERFORMANCE_AND_NATIVE_PLAN.md` — architecture and optimization decisions
4. This file
5. The relevant module(s) in `launcher/src` and `launcher/src-tauri/src`

The original project is read-only reference material:

`C:\Users\Altered\Documents\Projects\ps5-mode`

All Codex work belongs in:

`C:\Users\Altered\Documents\Projects\ps5-mode-codex-rebuild`

## Current known-good release

- Desktop package: `C:\Users\Altered\Desktop\PS5-Mode-Codex-Final-2026-07-14`
- Launcher release binary build timestamp: **2026-07-15 10:12:33**
- Claude handoff: `C:\Users\Altered\Desktop\PS5-Mode-Claude-Final-Handoff-2026-07-15.zip`
- Runtime model: exactly one `ps5-listener.exe` + one `ps5-launcher.exe`; packaged app must not listen on localhost.

## Ground rules

- Preserve the final Codex visual system and controller contract. Do not replace it with an old/scaffold design.
- Do not edit the original project. Work only in the rebuild unless the user explicitly changes scope.
- Do not use DLL injection, process hooks, anti-cheat bypasses, or a public local-network port.
- Use production builds (`tauri build --no-bundle`) for the desktop package. Do not distribute a `devUrl`/Vite build.
- Do not automatically scan game drives. Rescan only by explicit Settings action.
- Treat DualSense battery as approximate ten-step status data, not an exact charge measurement.
- Never route controller commands to Home and Quick Menu at the same time.

## Change procedure — required every meaningful task

1. State the intended behavioral outcome before modifying code.
2. Identify the authoritative source file(s) and the user-visible behavior affected.
3. Make the smallest coherent change.
4. Run at least the relevant type/build check.
5. For release changes, create a production build and only then replace the package executable.
6. Verify process count, no localhost listener, and package hash if the app was restarted.
7. Update **this file** and `CLAUDE_FINAL_HANDOFF.md` when behavior, architecture, controls, packaging, or known limits change.
8. Refresh `PS5-Mode-Claude-Final-Handoff-2026-07-15.zip` after source/documentation changes intended for handoff.

## Required handoff note format

Append a new entry under **Change log** with:

```md
### YYYY-MM-DD — short title
- Intent:
- Changed:
- Files:
- Verified:
- Known limitation / next validation:
- Package / handoff refreshed: yes|no
```

## Validation matrix

| Area | Minimum check |
|---|---|
| Home | Entry animation, D-pad/stick, tabs, Search, Settings, Power |
| Power | Up/Down selection; Minimize, Close, Rest; Circle cancels; Cross confirms |
| Yielded app/game | Home is hidden; controller does not navigate it |
| Quick Menu | Double PS opens; Circle/Resume closes; no dual input |
| Custom RGB | Cross on RGB cycles a scene; missing OpenRGB fails safely |
| Themes | Change accent in Settings; Home and prewarmed Quick Menu update/persist |
| Game scan | No startup/enter-Games scan; Settings > System > Rescan Games only |
| Battery | Separate outlined meter; uses `~NN%` wording |
| Packaging | One listener + one launcher, no port 1420 listener |

## Current architecture map

- Visual Home: `launcher/src/components/CodexLauncher.tsx`
- Quick Menu: `launcher/src/components/QuickOverlay.tsx`
- Theme persistence/cross-window sync: `launcher/src/theme.ts`
- Settings controls: `launcher/src/components/SettingsMenu.tsx`
- Controller event coalescing: `launcher/src/hooks/useController.ts`
- HID, gestures, event routing: `launcher/src-tauri/src/hid.rs`
- Explicit state/yield/overlay window: `launcher/src-tauri/src/commands.rs`
- OpenRGB local CLI adapter: `launcher/src-tauri/src/openrgb.rs`
- Native overlay experiment only: `native-overlay-poc/`

## Change log

### 2026-07-15 — final baseline and continuity setup
- Intent: establish a stable, documented custom Windows couch launcher baseline.
- Changed: final glass Home/Quick Menu, input isolation, power actions, approximate battery meter, custom OpenRGB scenes, persisted cross-window accent options, explicit game rescan, and performance safeguards.
- Files: see Current architecture map; design contract in `CLAUDE_FINAL_HANDOFF.md`.
- Verified: TypeScript type checks passed before each packaged build; desktop runtime restarted as one listener + one launcher with no localhost listener.
- Known limitation / next validation: physical DualSense battery behavior must be checked under USB and Bluetooth; native-overlay POC is deliberately not integrated.
- Package / handoff refreshed: yes.

### 2026-07-15 — compact Power glass + live-backdrop specification
- Intent: remove the Power scrollbar, strengthen its glass treatment, and define the no-flicker app-preview behavior before implementation.
- Changed: compact vertical Power rows, layered liquid glass; added `LIVE_APP_BACKDROP_SPEC.md`, `AGENTS.md`, and `AI_CURRENT_STATE.md`.
- Files: `launcher/src/components/CodexLauncher.tsx`, `LIVE_APP_BACKDROP_SPEC.md`, continuity documents.
- Verified: TypeScript check passed; packaged launcher built 10:12:33 and restarted with one listener + one launcher and no localhost listener.
- Known limitation / next validation: Live App Backdrop is specified but not implemented; begin with a native DWM-thumbnail proof.
- Package / handoff refreshed: pending final resume handoff refresh.

### 2026-07-15 — native 20-toggle baseline and Unreal subsystem
- Intent: measure actual native overlay window mechanics before increasing scope, then make Unreal a real optional presentation target.
- Changed: added `--benchmark` to the isolated native proof and captured a 20-cycle compositor-flushed result; added the Blueprint-facing `UPS5ModePresentationSubsystem` and Unreal setup instructions.
- Files: `native-overlay-poc/src/main.rs`, `native-overlay-poc/BENCHMARK_2026-07-15.md`, `unreal-scaffold/Source/PS5ModeOverlay/Private/PS5ModePresentationSubsystem.*`, `unreal-scaffold/UNREAL_SETUP.md`.
- Verified: `cargo run --release -- --benchmark` passed. Show avg/p95 19.55/31.13 ms; hide avg/p95 18.94/31.20 ms. UE compilation is unverified because UE is not installed.
- Known limitation / next validation: compare a same-workload Tauri menu, run the native 100-toggle resource test, then compile this plugin in the selected UE 5.x version and build Home/Idle presentation only.
- Package / handoff refreshed: pending current handoff refresh.
