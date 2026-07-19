# Spec — System Map & Consolidation

**Status:** planned, not started · **Created:** 2026-07-19
**Source:** AJ — *"any processes we can internalize/solidify? kinda like slimming
down moving parts or securing a loose package. also making sure we know what
systems are what so that if one fails we know what we're looking at."*

Two halves: **(1) the system map** — name every subsystem, its contract, and its
failure signature, so a bug points at an owner; **(2) consolidation** — collapse
duplicated moving parts into single sources of truth.

---

# Part 1 — System map

Seven systems. Each has one owner, one contract, and a known failure signature.

### S1. Input
- **Owns:** DualSense HID → pad state → edge detection → whichever consumer has focus.
- **Files:** `listener/src-tauri/src/hid.rs`, `triple_click.rs`;
  `launcher/src-tauri/src/hid.rs`; `hooks/useController.ts`, `useTouchpad.ts`,
  `useGridNav.ts`, `useSpringScroll.ts`.
- **Contract:** exactly **one** consumer owns input at a time. Edges are true
  false→true transitions.
- **Failure signature:** actions fire that you didn't press, or presses do
  nothing / need two goes. → Look at edge baselines (see C1).
- **Known debt:** six hand-rolled `prev*` implementations. Cause of two shipped bugs.

### S2. Launch & context
- **Owns:** turning a tile id into a running app, and tracking what's foreground.
- **Files:** `app_launch.rs` (`exe:` / `lnk:` / `browser:` / scheme ids),
  `commands.rs` (`launch_app`, `OVERLAY_CONTEXT`, yield/restore), `game_scan.rs`.
- **Contract:** id prefix decides the launch strategy; context becomes
  `desktop` / `app:<id>` / `game:<id>`.
- **Failure signature:** app doesn't start (bad path/prefix), or the Quick Menu
  shows the wrong item set (context wrong).

### S3. App identity & art
- **Owns:** everything visual *about an app* — icon, hero art, logo lockup, tile
  surface, tagline, accent.
- **Files:** `gameLogos.ts`, `components/heroArt/*`, `components/icons.tsx`.
- **Contract:** *currently* — a raw tile-id string is looked up in **nine separate
  registries**.
- **Failure signature:** **a blank square tile or no hero backdrop** = the id
  missed a registry. This is the most likely cause of AJ's "block logo".
- **Known debt:** the big one. See C2.

### S4. Motion & feel
- **Owns:** every animation, spring, and timing constant.
- **Files:** `styles.css`, per-component inline `CSS` strings, `useSpringScroll.ts`,
  scattered `*_MS` constants in 7 files.
- **Contract:** compositor-only steady state; blur time-boxed to transitions;
  reduced-motion honoured.
- **Failure signature:** jank, or a filter/`will-change` left applied at idle.
- **Known debt:** constants scattered; AJ tunes feel constantly and there's no one
  place to tune. See C4.

### S5. Windows & surfaces
- **Owns:** the three surfaces — **listener** (tray, no window), **launcher**
  (fullscreen), **overlay** (always-on-top, click-through, `?overlay=1`).
- **Files:** `listener/src-tauri/src/{lib,tray,launch}.rs`,
  `launcher/src-tauri/src/{lib,commands}.rs`, `QuickOverlay.tsx`.
- **Contract:** the launcher never runs a localhost server in packaged builds; the
  overlay never takes focus or mouse.
- **Failure signature:** "localhost refused to connect" = built with plain
  `cargo build` instead of the Tauri CLI. Overlay stealing input = focus flags.

### S6. Config & preferences
- **Owns:** persisted state, **shared across two processes**.
- **Files:** `config.rs` (`%APPDATA%/ps5-mode/config.json` — tiles,
  `cursor_sensitivity`, display), `settings.ts`, `theme.ts`, `recents.ts`
  (localStorage).
- **Contract:** on-disk `config.json` **wins over** seeded defaults; both listener
  and launcher read `cursor_sensitivity`.
- **Failure signature:** a change to `config.rs` seeded defaults appears to do
  nothing → because the live file already exists and wins.
- **Known debt:** three storage backends (JSON / localStorage / in-memory) with no
  stated rule for which to use.

### S7. Hardware bridges
- **Owns:** the outside world — RGB, audio, network, bluetooth, display, power.
- **Files:** `openrgb.rs`, `audio.rs`, `network.rs`, `bluetooth.rs`, `display.rs`,
  `power.rs`, `mouse_inject.rs`.
- **Contract:** every bridge **fails safe** — missing dependency must degrade, not crash.
- **Failure signature:** silent no-op. Nothing surfaces to the UI today.
- **Known debt:** no health/diagnostics surface. See C6.

---

# Part 2 — Consolidation work

### C1. One input primitive — `useEdges` *(already specced)*
Full detail in `POST_REBUILD_FIXES_SPEC.md` §A+B. Collapses six bespoke `prev*`
implementations into one hook with two invariants (always sample; seed the
baseline from the first real pad frame). **Highest value — fixes two live bugs.**

### C2. One app-identity registry ⭐ *the biggest structural win*

**Today:** adding one tile means touching up to **nine** registries —
`KEY_ART`, `KEY_ART_SET`, `KEY_ART_LOGO`, `KEY_ART_LOGO_LOCKUP`, `POSTER_ART`,
`REAL_LOGOS`, `TAGLINE`, `CYCLING_IDS`, `RIGHT_LOGO_IDS` — plus `logoSurfaceFor()`
and the `ServiceIcon` prefix chain, across 3 files with ~55 hardcoded id strings.
Adding the `lnk:` tiles this session required edits in 4 of them; **missing one
fails silently as a blank square.**

**Target:** one record per app.
```ts
// appRegistry.ts
interface AppIdentity {
  key: string;            // stable, machine-independent (e.g. "hulu", "fortnite")
  match: (id: string) => boolean;   // maps any config id -> this identity
  logo?: string; artSet?: string[]; art?: string; lockup?: string;
  surface?: string; tagline?: string; accent?: string;
  logoPosition?: "left" | "right"; cycleLogo?: boolean;
}
```
`heroArtFor()` / `ServiceIcon()` / `TAGLINE` all read from this one place.

**Critical design point — stable keys.** Ids are currently machine-specific
absolute paths (`exe:E:\...`, `lnk:C:\Users\Altered\...`) hardcoded into frontend
source. **Move a game and its art silently breaks.** The registry should match on
a *normalised* key (filename stem / known brand), so art survives a path change.

> **No migration needed:** keep `config.json` ids exactly as they are; the registry
> derives its key *from* them. Nothing about AJ's live config or `recents` changes.

**Bonus:** replaces `ServiceIcon`'s blank-square fallback with a deliberate
branded placeholder — so an unmatched app looks intentional, not broken (and
likely resolves bug C outright).

### C3. One keyboard core
`KEYBOARD_SWIPE_ROW_DISTANCE = 340` / `COLUMN_DISTANCE = 420` are **duplicated
verbatim** in `Search.tsx` and `VirtualKeyboard.tsx` — two keyboards that will
drift apart the moment either is tuned. Extract the grid + swipe-select + commit
logic once; Search, the Home overlay, and the Desktop Mode bar become three
presentations of it. (Also unblocks the slim bottom bar in
`DESKTOP_MODE_AND_SETTINGS_SPEC.md` §2.)

### C4. Motion tokens
Timings live in 7 files (`MOMENTUM_MS`, `ROTATE_MS`, `SLIDE_MS`, `FADE_MS`,
`TILE_DISTANCE`, `DRAG_DEADZONE`, spring `FOLLOW`, plus inline `.26s` / `.22s` /
`2.6cqw` / `blur(5px)`). Put durations, easings, travel distances and blur amounts
in one `motion.ts` + matching CSS custom properties. AJ tunes feel every single
session; this makes tuning one file instead of a scavenger hunt.

### C5. One verify command
Every check is currently manual and easy to half-do (this session shipped a commit
whose Rust wasn't checked because `cargo` wasn't on PATH in that shell). Add
`verify.ps1`: `tsc --noEmit` + `vite build` + `cargo check` on **both** crates,
one exit code. Rule: **no commit without a green `verify.ps1`.**

### C6. Diagnostics surface — *directly answers "if one fails we know what we're looking at"*
Nothing currently reports subsystem health; bridges fail silently. Add a
**Settings → System → Diagnostics** page showing, per system:

| System | Shows |
|---|---|
| Input | Controller connected? battery, last input age, active consumer |
| Launch | Current `OVERLAY_CONTEXT`, last launch target + result |
| Identity/Art | Tiles matched vs **unmatched** (the blank-square canary), art counts per set |
| Windows | Launcher/overlay alive, overlay prewarmed? |
| Config | Resolved `config.json` path, loaded-vs-seeded, tile count |
| Bridges | OpenRGB reachable, audio/network/bluetooth ok, OpenRGB device count |

Plus one consistent rule: **every bridge returns a typed result the UI can show**,
instead of swallowing errors. Pairs naturally with the Performance tab.

### C7. Document the map
Fold Part 1 into `PROJECT_STATUS.md` so the architecture table names *systems*
with failure signatures, not just files.

---

## Suggested order
1. **C1** (fixes live bugs) → 2. **C5** (cheap; protects everything after) →
3. **C2** (biggest structural win; likely fixes bug C) → 4. **C4** (unblocks feel
tuning) → 5. **C3** (unblocks the Desktop Mode keyboard) → 6. **C6** → 7. **C7**.

## Constraints
- Pure refactors must be **behaviour-preserving** — verify before/after, no visual change.
- Do **not** change `config.json` ids or `recents` keys; derive stable keys instead.
- Work only in `ps5-mode-codex-rebuild`; never edit the original `…\ps5-mode`.
- Never route controller events to two consumers at once.
