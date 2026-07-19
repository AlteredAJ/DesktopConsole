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

## Open threads

- **Rebuilding:** run `.\rebuild.ps1` (puts cargo on PATH, stops the running exes,
  builds the launcher via the Tauri CLI + the listener, restarts the listener).
  The **launcher must be built with `tauri build`** — a plain `cargo build` points
  its window at the dev server (`localhost`) and shows a connection-refused page.
- **Next up:** wire per-game 4K hero art (see `ART_SHOPPING_LIST.md` — 8 games +
  Disney+); delete ~1.5 MB of unused non-4K `keyart/*.jpg` dupes; touchpad
  momentum / true 1:1 drag (Option B — wants live controller testing).
- **Future:** authentic per-game accent colors (vs the hash fallback); backend
  TODOs (`get_controller_state` snapshot, `app_launch`, HID `buf[0]` offset);
  perf/DPR check on the real panel; `native-overlay-poc` graduation gate;
  `unreal-scaffold` role decision.
- **Designed but not built** (full detail in `docs/archive/HANDOFF.md`):
  hold-2s **swipe-to-type keyboard overlay**; cross-app **"continue" / jump-back-in
  row**; **launch-by-search**.

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
- **`rebuild.ps1`** — one-shot rebuild (cargo on PATH, stop exes, build launcher via
  Tauri CLI + listener, restart the listener).
- **`docs/archive/`** — superseded scaffold-era handoffs, kept for history
  (`HANDOFF.md`, `AI_CURRENT_STATE.md`, `AI_CONTINUATION_PROTOCOL.md`,
  `README_FIRST_FOR_CLAUDE.md`, `GEMINI_RESEARCH_REQUEST.md`).

---

## Change log

Format per entry: Intent · Changed · Files · Verified · Next/limits.

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
