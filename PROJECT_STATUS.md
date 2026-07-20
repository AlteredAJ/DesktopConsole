# PS5 Mode — Project Status

**The current source of truth.** Live status plus the durable maps and rules.
For the *visual / interaction design contract*, see `CLAUDE_FINAL_HANDOFF.md`.
For an at-a-glance board, open `BUILD_BOARD.html`.

- **What:** a controller-first Windows couch launcher. Two Tauri v2 (Rust +
  WebView2 + React) processes — `listener/` (tray-resident; polls the DualSense,
  detects a PS triple-click, spawns the launcher) and `launcher/` (the fullscreen
  console). Packaged builds do **not** run a localhost server.
- **Where:** `C:\Users\Altered\Documents\Projects\ps5-mode-codex-rebuild`.
  The original `C:\Users\Altered\Documents\Projects\ps5-mode` is read-only
  reference — never edit it.
- **Machine notes:** target display is **1440p**. The frontend can be built in
  automated shells via the codex-runtime Node
  (`…\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`);
  `cargo`/`tauri` builds must run in AJ's interactive shell.

---

## Snapshot — 2026-07-18

**Shipped & frontend-verified this session** (`tsc && vite build` pass):
- Shared **living Atmosphere** (`components/Atmosphere.tsx` + `.atmos*` in
  `styles.css`) — compositor-only drift/breathe; replaces per-component
  duplicated orbs **and** the remote `fluid.krackeddevs.com` iframe the panels
  embedded (Settings / Search / Wi-Fi keyboard now work offline).
- **Critically-damped spring** dock scroll (`hooks/useSpringScroll.ts`) replacing
  native `scrollTo({behavior:smooth})` — interruptible, glide-y navigation.
- **Listener single tray icon** — removed the duplicate declarative `trayIcon`
  from `listener/src-tauri/tauri.conf.json`; kept the programmatic `tray.rs`
  builder (has the Exit menu). ✓ **Built & live on device (2026-07-19).**
- apple-design polish — glass-on-glass modal scrim fix; `prefers-reduced-motion
  / -transparency / -contrast` queries.
- Removed dead UI (`Launcher.tsx`, `Tile.tsx`, `entries/CodexHome.tsx`).
- Repo now under git (local-only, private); `.gitignore` added.

**Built 2026-07-19, pending your rebuild + on-device test** (`tsc && vite build` pass):
- **Hero parallax on focus** — hero art + atmosphere pan at different depths (`--px`).
- **Boot chime + entry haptics** — WebAudio arpeggio + two-stage rumble on entering Home.
- **Touchpad momentum** — velocity-projected flick that spring-snaps to the landing tile.
- **Cross-app "Continue" tab** — new first tab (default view stays Apps) showing recent
  launches + running apps (`recents.ts`, localStorage). Touchpad momentum + Continue want
  a controller test.
- **Keyboard overlay** (`docs/specs/KEYBOARD_OVERLAY_SPEC.md`) — `KeyboardOverlay.tsx`
  floats `VirtualKeyboard`'s existing swipe-select core (new `bare` prop skips its
  full-screen panel shell) in a dimmed glass panel over Home, summoned by a **double
  press of Share/Create** (chosen with AJ 2026-07-19 — it's unbound elsewhere).
  Home's own controller/touchpad handlers early-return while it's open, same pattern
  as the Power panel. **Wants a controller test**, specifically:
  - The Share/Create bit (`CodexLauncher.tsx`'s `SHARE_BUTTON = 0x10`) is
    **confirmed working on hardware** (AJ, 2026-07-19) — no longer a guess.
  - No consumer wired yet — `onDone` just closes the overlay (typed text is
    discarded). First real use case (Wi-Fi password? rename?) still open — AJ
    deferred that decision when the spec was scoped.
  - Search's own separate inline keyboard (`Search.tsx`) was deliberately left
    untouched per AJ ("leave low-risk for now") — folding it into this shared core
    is a possibility for a future session, not started.

## ▶ BATCH STATUS — Phases 1 & 2 DONE (2026-07-19), Phase 3 next

**Phase 1 — bugs. ✅ Complete, verified, not yet on-device.**
1. ✅ `useEdges` — one edge primitive, six consumers migrated. Fixes "first
   command closes the launcher" and "Console Home needs two presses".
2. ✅ Shuffle bag — every image once before repeats; re-selection advances.
3. ✅ Art fills the screen (removed triple dimming), tab motion raised
   (6cqw / 12px blur), 14 sub-1440p files culled.

**Phase 2 — foundation. ✅ Complete, verified.**
4. ✅ `verify.ps1` — one gate, one exit code. **No commit without it green.**
5. ✅ App-identity registry — 9 id-keyed maps → 1 entry per app, matched on a
   stable fragment instead of machine paths. Blank-square fallback gone.
6. ✅ `motion.ts` — all feel constants in one file.

**Phase 3 — features. IN PROGRESS.** See `DESKTOP_MODE_AND_SETTINGS_SPEC.md`.

1. ✅ **C3 — one keyboard core** (`hooks/useKeyboardGrid.ts`). Search and
   VirtualKeyboard each had their own copy of the same grid: row/col clamping,
   hat + stick nav, touchpad swipe-select, commit-on-cross, and duplicate
   swipe-travel constants. Now one hook; both are presentations of it.
   Navigation is fed from the caller's existing `useController` + shared edge
   tracker rather than opening a second one — one tracker, one sample a frame.
2. ✅ **Slim bottom-docked keyboard** — `KeyboardOverlay variant="dock"` +
   `VirtualKeyboard slim`. Bottom-anchored, `max-height:33cqh`, no full-screen
   scrim, so a browser field mid-page stays visible. Darker glass than the
   centred panel (has to be legible over a bright page); flat under
   `prefers-reduced-transparency`.
3. ✅ **Desktop Mode text entry** — `send_text.rs`, `SendInput` +
   `KEYEVENTF_UNICODE` (layout-independent, emoji-safe, one batched call).
   Summoned by **double-Share while yielded** ("use double share anywhere").
   The prewarmed overlay window now hosts both in-game surfaces through
   `OverlayRoot`, which mounts exactly one of Quick Menu / keyboard dock.
4. ✅ **Settings hub** — **Performance** tab (perf HUD, in-app reduce-motion,
   hero/idle rotation switches) and **About** tab (CPU/GPU/RAM/OS spec sheet,
   app + WebView2 versions, config path, ArtStation credits derived from art
   filenames, third-party licenses). **Lighting** tab added with the RGB work.
5. ✅ **RGB rebuild** — `openrgb.rs` now speaks OpenRGB's SDK binary protocol
   on `127.0.0.1:6742` (client connecting out, never a listening port).
   Enumerates devices with their real modes and LED counts, sets mode and
   colour; the four curated scenes stay as presets on top.
   **⚠️ The wire parser is UNVERIFIED** — OpenRGB was running here with its SDK
   server switched off, so it couldn't be tested. Turn on *Enable SDK Server*
   in OpenRGB and open Settings > Lighting: real device names/LED counts mean
   the struct layout is right; garbled text or "truncated packet" means a
   version-gated field width is wrong. See the spec's status note.
   That probe did catch a real bug: the fail-safe would have spawned a *second*
   OpenRGB instance, and two processes driving the same controllers over USB
   can wedge the hardware. Fixed — it now detects a running instance.
6. ✅ **Colour picker** — hue + brightness rows in Settings > Lighting, scrubbed
   with d-pad or left stick, Cross applies to all devices. HSV rather than RGB
   because hue is a single axis a stick maps onto; saturation pinned at 1 since
   desaturating an LED just reads as dimmer. Both rows draw the real gradient
   with a position marker, not a bare number.
   Still open: per-zone/per-LED control, and per-device colour override
   (the picker applies to everything at once).

**⚠️ Everything in Phases 1–3 is build-verified only — none of it has run on the
panel yet.** The input rewrite in particular changes behaviour that only a
controller can confirm, and the Desktop Mode keyboard has never been typed on.

## Open threads

- **Rebuilding:** run `.\rebuild.ps1` (puts cargo on PATH, stops the running exes,
  builds the launcher via the Tauri CLI + the listener, restarts the listener).
  The **launcher must be built with `tauri build`** — a plain `cargo build` points
  its window at the dev server (`localhost`) and shows a connection-refused page.
  Add **`-Dev`** for iteration (skips the release profile's LTO/codegen-units=1,
  much faster — same profile `verify.ps1` already uses for `cargo check`);
  reserve a plain release rebuild for sessions where you're judging real
  feel/perf on the panel.
- **Next up:** wire per-game 4K hero art (see `ART_SHOPPING_LIST.md` — 8 games +
  Disney+); delete ~1.5 MB of unused non-4K `keyart/*.jpg` dupes; touchpad
  momentum / true 1:1 drag (Option B — wants live controller testing).
- **Future:** authentic per-game accent colors (vs the hash fallback); backend
  TODOs (`get_controller_state` snapshot, `app_launch`, HID `buf[0]` offset);
  perf/DPR check on the real panel; `native-overlay-poc` graduation gate;
  `unreal-scaffold` role decision.
- **Specced, not built** (self-contained handoffs in `docs/specs/`):
  - `docs/specs/HOME_MOTION_SPEC.md` — "alive when switching" motion pass: tab
    slide + tasteful **motion-blur** streak, compositor-safe.
- **Designed but not built** (full detail in `docs/archive/HANDOFF.md`):
  **launch-by-search** (the Continue row and a first keyboard now exist).

---

## Architecture map (durable)

| Area | Primary file(s) |
|---|---|
| Home (visual + nav) | `launcher/src/components/CodexLauncher.tsx` |
| Living background | `launcher/src/components/Atmosphere.tsx` |
| Per-app hero art | `launcher/src/components/heroArt/*`, `gameLogos.ts` |
| Panels (shared shell) | `CodexPanelShell.tsx` → `SettingsMenu.tsx`, `Search.tsx`, `VirtualKeyboard.tsx` |
| Quick Menu (in-game overlay) | `launcher/src/components/QuickOverlay.tsx` (mounted via `?overlay=1`) |
| App routing / start / idle | `launcher/src/App.tsx`, `StartupScreen.tsx`, `IdleScreen.tsx` |
| Icons / accents / taglines | `launcher/src/components/icons.tsx` |
| Controller + input hooks | `hooks/useController.ts`, `useTouchpad.ts`, `useGridNav.ts`, `useSpringScroll.ts` |
| Theme / feedback | `theme.ts`, `feedback.ts`, `sound.ts`, `settings.ts` |
| Launcher backend | `launcher/src-tauri/src/{lib,commands,config,game_scan,live_backdrop,display,audio,network,bluetooth,power,mouse_inject,openrgb}.rs` |
| HID parsing / gestures | `launcher/src-tauri/src/hid.rs` |
| Listener | `listener/src-tauri/src/{lib,hid,triple_click,launch,tray,cursor_mode,rumble,bt_wake}.rs` |
| Native overlay proof (isolated) | `native-overlay-poc/` |
| Unreal presentation (optional, separate) | `unreal-scaffold/` |

## Ground rules (do not violate)

- Preserve the final Codex glass visual system and the controller/input contract
  (`CLAUDE_FINAL_HANDOFF.md`). No redesign without an explicit request.
- Work only in this rebuild; never edit the original `…\ps5-mode`.
- No DLL injection, process hooks, anti-cheat bypasses, or a public
  local-network port. Ever.
- Packaged desktop builds use `tauri build --no-bundle` and must not depend on a
  localhost / Vite server.
- Never automatically scan game drives — rescan only via Settings > System.
- DualSense battery is coarse ten-step data: label it `~NN%`, never an exact %.
- Never route controller events to Home and Quick Menu at the same time.
- Small change → verify (at least a type/build check) → update this file's change
  log.

## Validation matrix

| Area | Minimum check |
|---|---|
| Home | Entry animation; D-pad/stick; tabs; Search; Settings; Power |
| Power | Up/Down select; Minimize/Close/Rest; Circle cancels, Cross confirms |
| Yielded app/game | Home hidden; controller does not navigate it |
| Quick Menu | Double-PS opens; Circle/Resume closes; no dual input |
| RGB | Cross cycles a scene; missing OpenRGB fails safely |
| Themes | Change accent; Home + prewarmed Quick Menu update/persist |
| Game scan | No startup/enter-Games scan; explicit rescan only |
| Battery | Outlined meter; `~NN%` wording |
| Packaging | One listener + one launcher; no port-1420 listener |

---

## Document index

- **`PROJECT_STATUS.md`** (this) — live status, maps, rules, change log.
- **`CLAUDE_FINAL_HANDOFF.md`** — authoritative visual/interaction design contract.
- **`BUILD_BOARD.html`** — visual status board (open in a browser).
- **`README.md`** — project overview, build/run, controls.
- **`AGENTS.md`** — AI agent read order + rules.
- **`PERFORMANCE_AND_NATIVE_PLAN.md`** — perf decisions, WebView2 practices, native-proof gate.
- **`OVERLAY_ARCHITECTURE.md`** — Quick Menu (two-window) overlay design.
- **`LIVE_APP_BACKDROP_SPEC.md`** — live app-backdrop state machine (Stage 1 implemented).
- **`ART_SHOPPING_LIST.md`** — 4K hero-art audit + per-game wiring recipe.
- **`docs/specs/`** — self-contained build specs for planned features
  (`KEYBOARD_OVERLAY_SPEC.md`, `HOME_MOTION_SPEC.md`,
  `POST_REBUILD_FIXES_SPEC.md`, `DESKTOP_MODE_AND_SETTINGS_SPEC.md`,
  `ARCHITECTURE_AND_CONSOLIDATION_SPEC.md` — the system map + failure signatures;
  `PRIOR_ART_AND_SOUND_SPEC.md` — GitHub survey + audio design).
- **`verify.ps1`** — the single correctness gate (tsc + vite + cargo check on both
  crates, one exit code; puts cargo on PATH itself). **No commit without it green.**
  `-Frontend` for a fast UI-only loop.
- **`rebuild.ps1`** — one-shot rebuild (cargo on PATH, stop exes, build launcher via
  Tauri CLI + listener, restart the listener).
- **`docs/archive/`** — superseded scaffold-era handoffs, kept for history
  (`HANDOFF.md`, `AI_CURRENT_STATE.md`, `AI_CONTINUATION_PROTOCOL.md`,
  `README_FIRST_FOR_CLAUDE.md`, `GEMINI_RESEARCH_REQUEST.md`).

---

## Change log

Format per entry: Intent · Changed · Files · Verified · Next/limits.

### 2026-07-19 — rotating per-app hero art (Netflix / Disney+ / Epic)
- **Intent:** use AJ's ArtStation collections as living per-app backdrops.
- **Changed:** `KEY_ART_SET` in `gameLogos.ts`, globbed from
  `assets/logos/keyart/{netflix,disney,epic}/` — **drop more art into a folder and
  the rotation picks it up automatically**. `KeyArtHero` gained an `arts` prop:
  A/B crossfade (9s hold / 1.2s fade) that preloads the next frame before
  flipping, mounting only two `<img>` layers regardless of set size;
  reduced-motion holds frame one. Disney+ dropped its logo-on-plate PosterHero and
  Epic dropped the hand-drawn EpicHero — both have real wide art now.
- **Quality call:** originals embedded as-is; no re-compression (already lossy
  JPEG/WebP — re-encoding would only cost quality). Epic and Fortnite are kept as
  **separate pools** per AJ (Epic ships its own art over time).
- **Counts:** netflix 10 (Arcane), disney 12, epic 32 → `dist` ≈ 74 MB.
- **Verified:** tsc + vite build clean; 63 art files bundled.
- **Next/limits:** exe grows with the art — prune or downscale (the two Disney
  files are 8K; invisible past ~2560px at 1440p) if size ever matters. Fortnite
  still uses its single `fortnite-4k.jpg`; give it a pool if wanted.

### 2026-07-19 — app tiles + lnk launch + touchpad deadzone
- **Intent:** wire AJ's streaming apps as clean PWA windows; fix touchpad clicks.
- **Changed:** new `lnk:<path>` launch target (ShellExecute a Windows shortcut) so
  Chrome/Edge PWA app windows launch chromeless. Tiles: Netflix →
  `browser:.../browse` (WebView2 can't play it; browser = best quality), Disney+ /
  Hulu → `lnk:` PWA shortcuts in `Desktop\Apps`, **new** FMHY (`lnk:`, custom neon
  play-triangle `fmhy.svg`) + Cinebolt (`browser:`). Re-keyed `gameLogos.ts` /
  `icons.tsx` so new ids keep logos/hero/surfaces. `useTouchpad.ts` gained a
  14-unit tap/drag deadzone (re-anchor on cross) — laying a finger to click no
  longer nudges the selection.
- **On-device (outside repo):** moved the 3 `.lnk`s into `Desktop\Apps`; updated
  live `%APPDATA%\ps5-mode\config.json` to match.
- **Files:** `app_launch.rs`, `config.rs`, `gameLogos.ts`, `icons.tsx`,
  `hooks/useTouchpad.ts`, `assets/logos/fmhy.svg`.
- **Verified:** tsc+vite + cargo check clean; config.json parses (25 tiles).
- **Next/limits:** eyeball the FMHY neon icon + touchpad feel on device; Cinebolt
  uses the generic browser icon (no art supplied); Disney+ still has no hero art.

### 2026-07-19 — warnings cleared + ambient idle art
- **Intent:** zero-warning backend; make the idle state feel alive.
- **Changed:** removed unused `tauri::Manager` imports (listener `lib.rs`, `tray.rs`);
  `#[allow(dead_code)]` on the intended-but-unwired `toggle_minimize`. Added a
  PS5-style **idle-screen art slideshow** — real 4K hero art (`IDLE_ART` in
  `gameLogos.ts`) ken-burns behind the wordmark and slowly crossfades
  (9s hold / 1.6s fade), compositor-only, scrim keeps text legible,
  `prefers-reduced-motion` holds one static frame. True idle only, not the splash.
- **Files:** `listener/src-tauri/src/{lib,tray}.rs`, `launcher/src-tauri/src/commands.rs`,
  `launcher/src/components/IdleScreen.tsx`, `gameLogos.ts`, `styles.css`.
- **Verified:** launcher `tsc`+`vite build` clean; both `cargo check` clean (0 warnings).
- **Next/limits:** slideshow art = the same wired hero set; grows automatically as
  `ART_SHOPPING_LIST.md` games get art. Lands on the next launcher build.

### 2026-07-19 — tray Exit fix + cleanup
- **Intent:** make the tray "Exit" actually quit; remove dead weight.
- **Changed:** listener `ExitRequested` guard now only calls `prevent_exit()` for
  implicit window-close requests (`code.is_none()`); an explicit `app.exit(n)` from
  the tray Exit item passes through, so Exit terminates the process (no more manual
  kill). Deleted 9 unreferenced non-4K `keyart/*.jpg` dupes (~1.5 MB).
- **Files:** `listener/src-tauri/src/lib.rs`, `launcher/src/assets/logos/keyart/*`.
- **Verified:** no src references/globs to the removed files; frontend build unaffected.
  The Exit fix takes effect after a **listener rebuild** (`.\rebuild.ps1`).
- **Next/limits:** controller tray icon + this fix both land on the next listener build.

### 2026-07-19 — feel + feature pass
- **Intent:** make Home feel alive on entry and add a couch "jump back in" flow.
- **Changed:** hero parallax on focus; boot chime + two-stage entry haptics; touchpad
  momentum (velocity projection + spring snap); cross-app Continue tab.
- **Files:** `CodexLauncher.tsx`, `sound.ts`, `feedback.ts`, `App.tsx`, `recents.ts`, `styles.css`.
- **Verified:** `tsc && vite build` pass.
- **Next/limits:** touchpad momentum + the Continue tab need a live controller test.

### 2026-07-19 — first on-device build of the refine pass
- **Intent:** get the session's changes running on the real panel and remove build friction.
- **Changed:** built the launcher via the Tauri CLI (embeds the frontend — a plain
  `cargo build` had pointed the window at the dev server → localhost error); rebuilt
  and restarted the listener (single tray icon confirmed). Added `rebuild.ps1`;
  refreshed `BUILD_BOARD.html`.
- **Verified:** launcher opens to the living atmosphere + spring dock on the 1440p
  panel; one tray icon.
- **Next/limits:** two harmless Rust warnings remain (unused `tauri::Manager` import
  in `listener/src-tauri/src/lib.rs`; dead `toggle_minimize` in `commands.rs`) — cosmetic.

### 2026-07-18 — refine/optimize pass + doc consolidation
- **Intent:** make the launcher feel alive and cheaper, fix the double tray, and
  replace scattered handoff docs with one source of truth.
- **Changed:** living Atmosphere component; spring dock scroll; removed the remote
  panel iframe; listener single-tray config; glass-on-glass + a11y queries;
  deleted dead UI; git init + `.gitignore`; added `BUILD_BOARD.html`,
  `ART_SHOPPING_LIST.md`, this file; archived 5 stale docs.
- **Files:** `Atmosphere.tsx`, `useSpringScroll.ts`, `styles.css`,
  `CodexLauncher.tsx`, `CodexPanelShell.tsx`, `listener/src-tauri/tauri.conf.json`,
  `README.md`, `AGENTS.md`.
- **Verified:** `tsc && vite build` pass (exit 0). Rust/Tauri backend (tray fix)
  still needs a local `cargo`/`tauri` build.
- **Next/limits:** activate the tray fix with a listener build; wire 4K hero art;
  touchpad momentum needs live controller testing.

*Earlier change-log entries (2026-07-15 baseline, Power glass, native benchmark,
Unreal subsystem) are preserved in `docs/archive/AI_CONTINUATION_PROTOCOL.md`.*
