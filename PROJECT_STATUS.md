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
  builder (has the Exit menu). ⚠️ **Needs a `cargo`/`tauri` build to take effect.**
- apple-design polish — glass-on-glass modal scrim fix; `prefers-reduced-motion
  / -transparency / -contrast` queries.
- Removed dead UI (`Launcher.tsx`, `Tile.tsx`, `entries/CodexHome.tsx`).
- Repo now under git (local-only, private); `.gitignore` added.

## Open threads

- **Needs AJ's build:** run `cd listener && npx tauri build` to activate the tray
  fix, then `cd ..\launcher && npx tauri dev` to see atmosphere + spring together.
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
- **`docs/archive/`** — superseded scaffold-era handoffs, kept for history
  (`HANDOFF.md`, `AI_CURRENT_STATE.md`, `AI_CONTINUATION_PROTOCOL.md`,
  `README_FIRST_FOR_CLAUDE.md`, `GEMINI_RESEARCH_REQUEST.md`).

---

## Change log

Format per entry: Intent · Changed · Files · Verified · Next/limits.

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
