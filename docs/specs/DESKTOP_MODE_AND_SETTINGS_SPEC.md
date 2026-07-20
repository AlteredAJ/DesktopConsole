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

### Resolved / open
1. **Summon gesture — resolved (AJ):** *"use double share anywhere."* One gesture,
   every context: Home, Desktop Mode, in-app. Don't invent a second one.
   (`SHARE_BUTTON = 0x10` is now hardware-confirmed working.)
2. **Open — needs on-device iteration.** Does the overlay need to become
   *focusable* to type? It's currently `set_ignore_cursor_events(true)` and
   non-focusable. If it takes focus, the target app loses it and keystrokes go
   nowhere. Intended approach: keep the overlay unfocusable and inject to whatever
   holds focus underneath. **AJ has accepted this will need test iteration**
   (*"we can do testing till we land it"*) — treat it as the one item expected to
   need several on-device rounds, not a clean first landing.

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
- [x] Occupies only the bottom band; a browser search field mid-screen stays visible.
      (`KeyboardOverlay variant="dock"` — bottom-anchored, `max-height:33cqh`,
      and no full-screen scrim at all so the page stays visible and usable.)
- [x] Readable over both dark and bright pages. (Dock panel is deliberately
      darker/less transparent than the centred one, since it has to sit over an
      arbitrary page including a bright white one. Goes fully flat under
      `prefers-reduced-transparency`, per the no-glass-on-glass contract.)
- [x] Same key layout/interaction as the Home overlay. (Same `VirtualKeyboard`
      via the new `slim` prop — a second presentation, not a second keyboard.
      Logic untouched; it all lives in `useKeyboardGrid` after C3.)
- [x] In Desktop Mode, typed characters land in the focused app.
      (`send_text.rs` — `SendInput` with `KEYEVENTF_UNICODE`. Summoned by
      double-Share while yielded, per "use double share anywhere".)
      **Build-verified only; needs an on-device pass.**

---

## 3. Settings as a mini system hub

**AJ:** *"settings will be a mini system hub."* Today `SettingsMenu.tsx` is a flat
list. Give it real sections; the PS5 settings model is the reference.

Tabs — **confirmed by AJ**: **System · Display · Audio · Network · Controller ·
Lighting · Performance · About**. Several already exist as rows and just need
grouping.

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

### 3a-ii. About tab — new

**AJ:** *"about being pc specs. launcher about so like whatever a good app would
also have in its about tab."* So it's two halves:

**System / PC specs** (this is the "console spec sheet" half — reads like a
console's System Information page):
- CPU, GPU (+ driver), RAM, motherboard.
- OS build, storage (free/total on the game drives).
- Display: resolution, refresh, HDR state — some of this already exists in
  `display.rs`.
- Connected controller: model, firmware if exposed, battery.

**App about** (the standard half):
- PS5 Mode version + build date + git commit (stamp at build time).
- Tauri / WebView2 runtime versions — genuinely useful, since WebView2 is the
  renderer and a version mismatch is a real failure mode.
- Config path (`%APPDATA%\ps5-mode\config.json`) with a "reveal in Explorer".
- **Credits & attribution** — the hero art is real ArtStation work by named
  artists (the filenames preserve who made each piece). List them. Same for
  Manrope (SIL OFL) and any other third-party assets. This is the right thing to
  do and it costs one screen.
- Licenses / open-source notices (incl. OpenRGB).

Most of this is read-only system info; prefer existing Windows APIs already used
by `display.rs` / `power.rs` over adding new dependencies.

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

**⚠️ OpenRGB isn't running at boot (AJ: *"installed js doesn't open on start"*).**
The SDK server only exists while OpenRGB is running, so the RGB page would find
nothing on a fresh boot. Handle it in the bridge, not by asking AJ to change his
setup:
- On first RGB use, try to connect to `127.0.0.1:6742`.
- If refused, **spawn OpenRGB ourselves in server mode** — it supports
  `--server --startminimized` — then retry the connection with a short backoff.
  `openrgb.rs` already locates `OpenRGB.exe` in the standard install paths, so
  reuse that.
- If it's genuinely absent, keep today's fail-safe: a clear message, no crash.
- Don't force it to autostart with Windows; only start it when lighting is used.

**Staging:** (1) Rust SDK client + enumerate/read (incl. the on-demand server
launch above), (2) set color/mode, (3) the UI, (4) presets on top. Step 1 alone
already beats today's write-only guesswork.

> **Before starting step 1:** the OpenRGB SDK protocol is a raw length-prefixed
> binary TCP protocol (magic bytes + command ID + payload length + payload) —
> exactly the "how do you frame a byte stream into messages" problem covered by
> the network-stack tutorials in the wiki's `Build-Your-Own-X — Curated Learning
> List` page (`E:\Obsidian Vault\Alt3red\wiki\Build-Your-Own-X — Curated
> Learning List.md`). Skim the relevant one before writing the socket client —
> it's the exact shape of the framing/parsing code this step needs, and will
> save reinventing it ad hoc.

**Device coverage:** deliberately not hardcoded — the whole point of the SDK is
that it reports whatever controllers exist (GPU, RAM, board, peripherals). Build
the UI from what's enumerated at runtime.

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


---

## Status update — 2026-07-20

**Built this session:** Performance tab (+ perf HUD), About tab (spec sheet +
derived art credits), and the OpenRGB SDK rebuild (`openrgb.rs` now speaks the
binary protocol on `127.0.0.1:6742` instead of shelling out to the CLI), plus a
Lighting tab listing enumerated devices with per-device mode cycling and the
curated scenes kept as presets on top.

### ✅ The OpenRGB wire parser is VERIFIED (2026-07-20)

Tested against AJ's live SDK server. It found one real bug: a **`vendor`
string sits between `name` and `description`** and was missing from
`parse_device()`, shifting every later field by one string and failing inside
the mode loop with a bogus 23KB length. Fixed and re-verified — the
bounds-checked cursor did its job, surfacing this as a clean error rather than
a panic or silent garbage.

Confirmed enumeration on this machine (protocol 3, 2 controllers):

| Device | Vendor | Type | LEDs | Zones |
|---|---|---|---|---|
| Sony DualSense (BT) | Sony | Gamepad | 6 | Lightbar, Player LEDs |
| ASRock B850M-C | ASRock | Motherboard | 241 | RGB LED 1 Header, Addressable Header 1-3/Audio |

Mode names read correctly too (DualSense: Direct / Mic Off / Mic Pulse; board:
Off, Static, Breathing, Strobe, Spectrum Cycle, Rainbow, Direct, …16 total).

> **⚠️ Security note for AJ:** OpenRGB's SDK server is currently bound to
> **`0.0.0.0`**, i.e. every network interface — anyone on the same network can
> drive your lighting. Our client only ever dials `127.0.0.1`, so setting
> OpenRGB's host to `127.0.0.1` costs us nothing and closes that off. Worth
> doing given this project's own "never expose a local-network port" rule.

<details><summary>Original pre-verification note (kept for history)</summary>

#### The OpenRGB wire parser was UNVERIFIED

`parse_device()` reads a version-dependent binary struct. It could not be tested
this session: OpenRGB was running on this machine **with its SDK server switched
off**, so nothing was listening on 6742 and a read-only probe was refused.

That failure was itself useful — it exposed a real bug that *is* fixed:
`connect_or_start()` originally would have spawned a **second** OpenRGB instance
whenever a connection failed, and two processes driving the same controllers over
USB can wedge the hardware. It now detects a running instance (via `sysinfo`) and
returns an actionable message instead.

**To verify the parser:** in OpenRGB, turn on *Settings > General > Enable SDK
Server* (or relaunch it with `--server`), then open Settings > Lighting. The
device list is the test — real names, types, LED counts and mode names mean the
struct layout is right. Garbled names or an "openrgb: truncated packet" error
mean a field width is wrong for the negotiated protocol version, most likely one
of the version-gated skips in the mode loop.

</details>

### Colour picker — built 2026-07-20
Hue + brightness as two adjustable rows in Settings > Lighting, driven with
d-pad or left stick left/right, Cross to apply to every enumerated device.
Held as **HSV, not RGB**: hue is one continuous axis you scrub, which is what a
stick maps onto — three RGB axes read as nothing to a person. Saturation is
pinned at 1 because a desaturated colour on an LED just looks dimmer, so
exposing it would cost a row and buy nothing perceptible. Hue wraps (it's a
wheel); brightness clamps (0 and 100 are real endpoints). Both rows draw the
actual gradient with a marker so they're readable at 10 feet rather than being
a bare number.

### Not yet built
- Per-zone / per-LED control (backend sets a whole device at once).
- Per-device colour override — the picker currently applies to all devices.
