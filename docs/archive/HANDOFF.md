# Handoff — for Fable

This repo is **scaffolded, not finished.** Every file is a skeleton with the structure,
byte offsets, and reuse references filled in. Your job is to complete it **one unit at a
time** (A → B → C → D), verifying each on real hardware before the next.

## Do this first (blocks everything)

The listener and launcher both read the DualSense over HID. Two byte assumptions are
**unverified** — the existing haptics codebase never parses them:

1. **PS button** — assumed `buf[10] & 0x01` (`listener/…/hid.rs` `PS_BUTTON_MASK`,
   `launcher/…/hid.rs` `MISC_PS`).
2. **Options button** — assumed `buf[10] & 0x20` (`MISC_OPTIONS`) — may actually live in
   `buf[9]`. Verify.
3. **Touchpad X/Y** — assumed packed 12-bit pairs ~`buf[33..36]` (Unit B only).

Build the listener in debug, plug in the pad, watch the `dump_raw_report` output
(`eprintln!` under `#[cfg(debug_assertions)]`), press PS alone, and confirm the bit.
Then delete `dump_raw_report` and fix the masks. **Do not skip this** — the whole trigger
depends on it.

Also port the exact **report offset** (`report_offset`) from the reference
`hid.rs` — the current USB=0 / BT=1 guess off `buf[0]` should be checked against how the
reference computes `off` (it also validates the report id).

## Reference source (read-only — do NOT edit)

`C:\Users\AlteredAJ\Downloads\Compressed\dualsense-haptics-windows-src\src-tauri\src\hid.rs`

- `find_dualsense()` / device open → `:2895-2905`
- read loop (`read_timeout`) → `:2683`
- button parsing / face+shoulder masks → `:2558-2562`, `:2596-2619`
- `aim_loop` mouse injection (port for touchpad cursor) → `:2827-2885`
- config persistence pattern → `settings.rs:1-28`

## Unit checklist

### Unit A — foundation (make this fully work before touching B/C/D)
- [ ] Verify PS/Options bits (above), fix masks, remove debug dump
- [ ] `listener`: triple-click spawns `launcher`; `SESSION_ACTIVE` re-arms on exit
- [ ] `listener`: tray icon + Exit; autostart enabled on first run
- [ ] `launcher`: fullscreen borderless window shows; `pad-state` events stream
- [ ] `launcher`: D-pad moves grid focus (`useGridNav`), Cross opens a tile
- [ ] PS+Options exits cleanly, tray reappears, second triple-click relaunches
- [ ] Idle listener < 50 MB / < 1% CPU (check `appcontrol` or Task Manager)
- [ ] Provide `icons/icon.ico` for both crates (currently referenced, not present)

### Unit B — touchpad
- [ ] Confirm touchpad X/Y offset, populate `PadState.touch_*` in `launcher/hid.rs`
- [ ] Spawn `mouse_inject::cursor_loop` on a thread; feed it touch deltas (diff while finger down)
- [ ] Wire `swipe.rs` / `useTouchpad` → grid nav; show `SwipeIndicator`
- [ ] `VirtualKeyboard`: real path-trace typing (nearest-key-on-path)

### Unit C — streaming grid
- [ ] `get_config` command → `Launcher` loads tiles from `config.rs`
- [ ] YouTube embed plays; external launches work (Netflix/Discord/Steam URI schemes)
- [ ] On external launch, hide launcher window; PS+Options re-summons it
- [ ] (Optional) Windows Credential Manager for any auto-login; **never a plaintext file**

### Unit D — display modes
- [ ] `list_display_modes` returns only monitor-supported modes (already coded — test it)
- [ ] Apply mode works; **force-kill mid-session and confirm the panic hook restores** the desktop

## Already handled (don't redo)
- ✅ Top-level `Cargo.toml` workspace (`ps5-mode/Cargo.toml`) — both crates build into
  one shared `target/`, so `launcher_exe_path()` in `listener/…/launch.rs` finds
  `ps5-launcher.exe` right next to `ps5-listener.exe` under `target/debug|release`.
- ✅ Placeholder `icons/icon.ico` in both crates (plain colored circle — swap for real
  branding whenever, not a blocker).
- ✅ `listener/dist-noop/index.html` exists so `frontendDist` resolves — the tray app
  has no window/UI, this file is inert, just satisfies Tauri's build check.

## Known scaffold gaps (intentional)
- `get_controller_state` command is a stub returning `default()` — the event stream is the
  real source; only implement the command if a panel needs a synchronous snapshot.

## Design: global trackpad mouse (DONE) + hold-2s keyboard overlay (NOT built yet)

**Mouse mode — implemented in `listener/src-tauri/src/cursor_mode.rs`.** Lives in
the listener (not the launcher) because it needs to work whenever the launcher
grid *isn't* foreground — including when the launcher was never even launched.
Gating uses `GetForegroundWindow` + `QueryFullProcessImageNameW` (raw FFI, no
new crate) to check the real OS foreground process is not `ps5-launcher.exe`;
if the grid has focus, the gesture is inert so it doesn't fight swipe-nav.
Triple-click on the touchpad's physical click (buf[10]&0x02, 600ms window,
reuses `triple_click::ClickTracker`) toggles `MOUSE_MODE`. While on, touchpad
drag moves the real cursor (same accumulator pattern as
`launcher/mouse_inject.rs`'s `aim_loop` port) and a quick tap (<220ms) is a
left-click. `MOUSE_MODE` is force-cleared when a PS-triple-click spawns the
launcher, so a stray mouse-mode flag never lingers into a grid session.

**Keyboard overlay — designed, not implemented.** Trigger: hold the touchpad
click (not tap) for 2000ms, tracked the same way `cursor_mode::State` already
tracks `press_started` (the tap-vs-hold branch point already exists there —
this is the "hold" arm that currently does nothing).

Proposed shape:
1. On hold-complete, listener spawns a small **borderless, always-on-top,
   click-through-disabled** Tauri window (a second window in the *listener*
   process — simplest, avoids needing the launcher process to be running at
   all) sized ~40% of screen height, docked to the bottom, similar posture to
   a Steam/console on-screen keyboard overlay.
2. That window hosts a trimmed copy of `VirtualKeyboard.tsx`'s existing QWERTY
   layout (already stubbed in `launcher/src/components/VirtualKeyboard.tsx`),
   built as its own tiny frontend bundle (or reuse the launcher's `dist` and
   just route to a `?panel=keyboard` query param — cheaper than a 3rd Vite app).
3. Swipe-to-type: feed the same `touch_x/touch_y` stream `cursor_mode.rs`
   already parses into a path-trace buffer; nearest-key-under-point per
   sample, de-duped consecutive repeats, gets you the traced letter sequence
   (matches the "no predictive ML, just the traced sequence" scope already
   noted in `VirtualKeyboard.tsx`). Emit each committed letter via a Tauri
   event to whatever window/field has real OS focus — needs `SendInput`
   (Win32) to inject the actual keystrokes into the focused app, since this
   overlay isn't a real text field itself.
4. Hide condition: same touchpad-click-triple-click gesture (symmetric with
   mouse mode) OR 2s idle with no touch contact.
5. Interaction with mouse mode: mutually exclusive — entering keyboard mode
   should force `MOUSE_MODE` off (same as the launcher-spawn clear already
   does), since both consume the same touchpad surface for different things.

Not started: the overlay window/bundle, the path-tracer, and the `SendInput`
keystroke injection. Flagged as its own unit rather than folded into mouse
mode because `SendInput` keystroke synthesis is a materially different (and
more failure-prone — focus-stealing, IME edge cases) surface than
`mouse_event`.

## Functional differentiator vs. Steam Big Picture

Two features Steam doesn't do that are cheap given pieces already in place:

1. **Cross-app "continue" row.** `active_apps.rs` already polls what's
   running; extend it (or a small watcher) to remember *last used* per tile
   (timestamp in `config.rs`'s `AppConfig`, one more field) and render a
   "Jump back in" shelf at the top of the grid — YouTube video you tabbed away
   from, the game you Alt-F4'd out of, Discord. Steam's Big Picture only
   really unifies Steam-installed games; this spans YouTube/Netflix/Discord/
   arbitrary `.exe`s, which Steam has no concept of.
2. **One-shot cross-app search-by-launch.** Since `config.rs` tiles are just
   `id`/`label`/`category` now (post persistence wiring), a search-as-you-type
   panel (D-pad/touchpad-driven, reusing the new swipe-keyboard once built)
   that fuzzy-matches tile labels and jumps straight to launch is something
   Big Picture doesn't offer for non-Steam content — Steam's search is
   Steam-library-only.

Both are additive on top of what's already built (`config.rs` persistence,
`active_apps.rs` polling) rather than new subsystems — reasonable next units
once the swipe-keyboard lands, since the search panel wants it.
