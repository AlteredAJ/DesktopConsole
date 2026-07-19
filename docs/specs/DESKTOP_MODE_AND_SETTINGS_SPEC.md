# Spec — Desktop Mode & Settings as a System Hub

**Status:** planned, not started · **Created:** 2026-07-19
**Source:** AJ, 2026-07-19 (post-rebuild direction).

Three connected pieces: name and finish **Desktop Mode**, reshape the **keyboard**
for it, and grow **Settings** into the console's system hub (Performance tab +
real RGB controls).

---

## 1. Desktop Mode — naming an idea that half-exists

**AJ:** *"normal 'desktop mode' usage. that's what we will call when we are not in
launcher using the regular windows. so like browser apps and those chrome apps."*

**Definition (adopt this term project-wide):**
> **Desktop Mode** — controller-driven use of ordinary Windows, *outside* the
> launcher: browser windows, Chrome PWAs (Hulu / Disney+ / FMHY), and any app the
> launcher handed off to. The launcher is hidden; PS5 Mode is still the input layer.

### What already exists (this is less new work than it sounds)
| Piece | Where | State |
|---|---|---|
| Touchpad-as-cursor | `listener/src-tauri/src/cursor_mode.rs`, `launcher/src-tauri/src/mouse_inject.rs` | Works; `cursor_sensitivity` in config, read by both processes |
| Per-tile cursor opt-in | `AppTile.needs_cursor` | Set true for all browser/`lnk:` tiles |
| Context tracking | `commands.rs` `OVERLAY_CONTEXT` → `"desktop"` / `"app:<id>"` / `"game:<id>"` | Works; `lnk:` correctly lands in `app:` |
| Quick Menu, desktop variant | `QuickOverlay.tsx` — a distinct item set when `context === "desktop"` ("Back to app", `minimize_console`) | Works |

**So Desktop Mode is ~70% built and simply unnamed.** The gap is *text entry* and
*search* while out there.

### What to build
- **Adopt the term** in `PROJECT_STATUS.md`, code comments, and the Quick Menu
  copy, so the three contexts are explicit: **Launcher / Desktop Mode / In-Game**.
- **Make the keyboard reachable in Desktop Mode** (see §2). Today `KeyboardOverlay`
  only mounts inside `CodexLauncher`, so it dies the moment the launcher hides —
  exactly when you need it most (typing in a browser).
  - It must live in the **overlay window** (the always-on-top, click-through
    surface the Quick Menu already uses), not in the launcher window.
  - Typed text has to reach the *foreground app*, not the launcher. That means
    synthesising real keystrokes to the OS — the same class of thing
    `mouse_inject.rs` already does for the cursor. **Constraint: use documented
    Win32 input synthesis (`SendInput`) only — no DLL injection, no hooks into
    other processes.** That stays inside the project's ground rules.
- **Search in Desktop Mode** — AJ: *"search is good but also just normal desktop
  mode usage."* Summon the same search surface over the desktop; selecting a
  result launches it and returns to Desktop Mode.

### Open questions
1. Summon gesture for the keyboard **in Desktop Mode** — reuse double-Share, or
   keep double-Share for Home and give Desktop Mode its own?
2. Does the overlay need to become *focusable* to type (it's currently
   `set_ignore_cursor_events(true)` and non-focusable)? If it takes focus, the
   target app loses it and keystrokes go nowhere. Likely answer: keep the overlay
   unfocusable and inject to whatever holds focus underneath.

---

## 2. Keyboard redesign — slim, bottom-docked, translucent

**AJ:** *"the keyboard will be used in browser so it needs to be v
streamlined/slimmed and moved down. transparency is a good move tho."*

### Current shape (wrong for this)
`KeyboardOverlay` floats a **centred glass panel** over Home. In a browser that
covers the very content you're typing into — search fields, address bars, login
forms all sit mid-screen.

### Target shape
- **Docked to the bottom edge**, full width — like a console/TV on-screen
  keyboard. Never covers the vertical centre.
- **Slim:** shrink key height and vertical padding; drop the big title/subtitle
  block and the tall preview field (or reduce the preview to a single compact
  line). Target roughly **⅓ of the screen height or less**.
- **Keep and lean into transparency** — the existing glass, tuned so page content
  stays readable behind it. One caveat from the design contract: **no
  glass-on-glass**; if it sits over the Quick Menu's glass, one of them must go
  flat.
- **Same input model** — swipe-to-select, D-pad/stick, Cross commit, Square
  delete, Circle cancel. No relearning. (Already built; don't touch the logic.)
- Reuse the existing `bare` prop — this is a second presentation of the same
  keyboard, not a second keyboard.

### Acceptance
- [ ] Occupies only the bottom band; a browser search field mid-screen stays visible.
- [ ] Readable over both dark and bright pages.
- [ ] Same key layout/interaction as the Home overlay.
- [ ] In Desktop Mode, typed characters land in the focused app.

---

## 3. Settings as a mini system hub

**AJ:** *"settings will be a mini system hub."* Today `SettingsMenu.tsx` is a flat
list. Give it real sections; the PS5 settings model is the reference.

Proposed tabs: **System · Display · Audio · Network · Controller · Lighting ·
Performance · About**. (Exact split to confirm — several already exist as rows and
just need grouping.)

### 3a. Performance tab — new
Home for the **perf HUD toggle** (roadmap item 6) plus related switches:
- **Perf HUD** — on/off. Frame time, FPS, dropped-frame counter. This is the thing
  that lets us *verify* motion claims instead of eyeballing them; every animation
  change so far has been accepted on "looks fine".
- **Reduce motion** — an in-app switch, independent of the OS
  `prefers-reduced-motion` the UI already honours.
- **Hero art rotation** — on/off + interval, since it's now a constant background
  crossfade.
- **Idle art rotation** — on/off + idle timeout (currently a hardcoded 10 min).
- Possibly: background-blur quality / atmosphere density for lower-power runs.

Settings persist via the existing `settings.ts` + `config.json` pattern.

### 3b. RGB controls — rebuild properly
**AJ:** *"ur rgb controls suck also btw. u should js add a way for headed controls
in the ui itself. it's open source code anyway."* — Correct, and here's why:

`openrgb.rs` is **34 lines**. It has exactly two functions: `open_gui()` (shells
out to OpenRGB.exe) and `set_scene()`, which maps four hardcoded names to four
hardcoded hex colors and fires `--mode static --color X` at **every device at
once**. There is no device list, no per-device control, no mode selection, no
brightness, and **no feedback** — the UI can't even tell you what your lighting
is currently doing.

**Plan: talk to OpenRGB's SDK server instead of its CLI.** OpenRGB ships a
documented, open network protocol (default `localhost:6742`) that exposes exactly
what's missing: enumerate controllers, read their modes/zones/LEDs, set per-device
mode and per-LED color, apply.

> **Ground-rule check:** this is a **client connecting out to localhost**, not us
> opening a listening port. The "no public local-network port" rule is not
> violated. Bind/connect to `127.0.0.1` only, and fail safe when OpenRGB isn't
> running (the current fail-safe behaviour is good and must be kept).

**UI to build (controller-first, 10-foot):**
- Device list with detected name/type, live current color swatch.
- Per-device **mode** picker (Static / Breathing / Rainbow / whatever the device
  reports — read them, don't hardcode).
- **Color picker** usable with a stick/d-pad — a hue strip + brightness, not a
  mouse-only 2D gradient.
- **All devices** master row, plus per-device override.
- Keep the curated scenes as one-press presets, but as a shortcut *on top of* real
  control, not instead of it.
- Match the accent theme so lighting presets can follow the UI accent.

**Staging:** (1) Rust SDK client + enumerate/read, (2) set color/mode, (3) the UI,
(4) presets on top. Step 1 alone already beats today's write-only guesswork.

### Acceptance
- [ ] Settings is grouped into tabs, not one flat list.
- [ ] Performance tab toggles the perf HUD live.
- [ ] RGB page lists real detected devices and reflects their current state.
- [ ] Per-device color + mode changes apply and persist.
- [ ] OpenRGB absent/closed → clear message, no crash (unchanged behaviour).

---

## Constraints
- Work only in `ps5-mode-codex-rebuild`; never edit the original `…\ps5-mode`.
- **No DLL injection or process hooks.** Keyboard input synthesis must use
  documented Win32 `SendInput`, same posture as the existing mouse injection.
- No public local-network port; OpenRGB SDK is a `127.0.0.1` client connection.
- Never route controller events to two consumers at once — Desktop Mode keyboard
  and the Quick Menu must not both own input.
- Verify with `tsc && vite build` + `cargo check`; rebuild via `.\rebuild.ps1`.
