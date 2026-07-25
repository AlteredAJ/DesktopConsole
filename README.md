<!-- Banner: just text for now — drop a PNG later -->
<p align="center">
  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 54' width='64' height='54'%3E%3Cpath fill='none' stroke='%235b9cf5' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round' d='M8 12h48c4 0 4 4 4 4v8c0 16-4 22-14 22-6 0-12-4-14-12-2 8-8 12-14 12C8 46 4 40 4 24v-8c0 0 0-4 4-4Z'/%3E%3Crect x='22' y='14' width='20' height='12' rx='4'/%3E%3Cline x1='24' y1='6' x2='40' y2='6' stroke='%235b9cf5' stroke-width='2.5'/%3E%3Ccircle cx='29' cy='32' r='4'/%3E%3Ccircle cx='35' cy='32' r='4'/%3E%3C/svg%3E" alt="DesktopConsole" />
</p>

<h1 align="center">DesktopConsole</h1>
<p align="center"><strong>A controller-first, 10-foot Windows couch launcher</strong></p>
<p align="center">DualSense-driven · GPU fluid backgrounds · WebGL glass UI · Zero localhost</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/platform-Windows%2011-blue" alt="Platform"></a>
  <a href="#"><img src="https://img.shields.io/badge/built%20with-Tauri%20v2-ffc131" alt="Tauri"></a>
  <a href="#"><img src="https://img.shields.io/badge/framework-React%2019-61dafb" alt="React"></a>
</p>

<br>

---

## What is this?

DesktopConsole turns your Windows PC into a living-room console. Pick up a DualSense, triple-tap the PS button, and your full-screen app launcher appears — game tiles, streaming apps, system settings, all navigable by controller. Launch a game, and the console yields. Double-tap PS mid-game for a glass quick menu. Everything runs on your GPU, nothing leaves your machine.

<br>

## Screenshots

<p align="center">
  <em>Home dashboard — top dock, game tiles, hero art, fluid backgrounds</em>
  <br><br>
  <em>Screenshots coming after next build. Open <a href="demo/">demo/</a> pages in a browser for design previews.</em>
</p>

<br>

## Features

- **Controller-first** — D-pad, left stick, touchpad gestures. Cross to select, Circle to back, L1/R1 to switch tabs.
- **DualSense integration** — Haptic feedback, lightbar color sync, battery meter, trackpad-as-mouse mode.
- **GPU fluid backgrounds** — Live WebGL simulations via [Fluid by KrackedDevs](https://fluid.krackeddevs.com). Three presets (Midnight / Ember / Void). Completely free, renders on the viewer's GPU.
- **Glass UI** — Deep frosted glass, specular bloom, accent-glow focus indicators. Apple- and console-inspired visual language.
- **Tauri v2** — Rust backend + React frontend in WebView2. No Electron, no localhost server, < 5 MB backend binary.
- **Two processes** — A tray-resident `listener` watches for the PS triple-click. A fullscreen `launcher` opens on demand and fully unloads when closed.
- **Quick Menu** — Double-tap PS mid-game for a transparent overlay: volume, RGB, controller settings, Game Base, capture, and Console Home.
- **Power menu** — Right-edge slide panel: minimize, close, lock, rest mode, shutdown. Confirmation required for destructive actions.
- **Game detail panels** — Box art, hero keyart rotation, action buttons, and an info carousel (playtime / install / per-game settings).
- **OpenRGB control** — Cycle and set RGB scenes on your DualSense lightbar and motherboard LEDs directly from the Quick Menu or Settings.
- **On-screen keyboard** — D-pad or touchpad swipe-to-type. Double-Share anywhere (Desktop Mode) types into the foreground app.
- **Settings hub** — Appearance, Controller sensitivity, Audio mixer, Network, Bluetooth, Display modes, RGB Lighting, Performance toggles, System info, and About page with art credits.
- **Lazy art loading** — 76 MB of hero keyart loads on first tile focus instead of at startup. Cold launch is near-instant.
- **Gaming-first** — When yielded to a game, the console's HID thread throttles to ~25 Hz so it never competes for CPU.
- **No DLL injection** — The Quick Menu uses a transparent click-through window. No hooks, no anti-cheat bypasses, no public ports.

<br>

## Quick Start

### Prerequisites

- **Windows 11**
- **DualSense controller** (USB or Bluetooth)
- **Node.js 18+**
- **Rust** (via [rustup](https://rustup.rs))
- **WebView2 runtime** (included in Windows 11)
- **Tauri CLI v2**: `cargo install tauri-cli --version "^2"`

### Build & Run

```powershell
cd launcher
npm ci
npx tauri build --no-bundle
```

This produces:
- `target/release/ps5-launcher.exe` — the fullscreen console
- `listener/src-tauri/target/release/ps5-listener.exe` — the tray-resident trigger

Keep both side by side. The listener looks for `ps5-launcher.exe` next to itself.

### Dev Iteration

```powershell
cd launcher
npx tauri dev
```

Or use the project's convenience scripts:

```powershell
.\verify.ps1         # Type-check + cargo check (fast, no linking)
.\rebuild.ps1        # Full production build + restart listener
.\rebuild.ps1 -Dev   # Fast build (skip LTO, for iteration)
```

<br>

## Controls

| Gesture | Action |
|---------|--------|
| **Triple-tap PS** (from Windows) | Open the console entry screen |
| **Press PS** (on entry screen) | Enter the dashboard |
| **D-pad / Left stick** | Navigate tiles, menus, settings |
| **Cross (&#x2715;)** | Select / Launch / Confirm |
| **Circle (&#x25CB;)** | Back / Cancel |
| **Square** | Close running app (when tile focused) |
| **L1 / R1** | Switch tabs |
| **Double-tap PS** (in-game) | Toggle Quick Menu overlay |
| **Double-tap Share** | Open on-screen keyboard (Desktop Mode types into foreground app) |
| **Double-tap Share** (on dashboard) | Open keyboard overlay |
| **Touchpad click (hold 2s)** | Toggle trackpad-as-mouse mode |
| **Options (triple-click)** | Exit console (also PS + Options hold) |
| **Power menu** | Up/Down to choose, Cross to select, Circle to cancel |

<br>

## Architecture

```
DesktopConsole/
├── launcher/                    Fullscreen Tauri + React console
│   ├── src/                     React frontend
│   │   ├── components/          All UI: CodexLauncher, QuickOverlay,
│   │   │                         SettingsMenu, GameDetailPanel, etc.
│   │   ├── hooks/               useController, useEdges, useGridNav,
│   │   │                         useSpringScroll, useTouchpad
│   │   ├── appRegistry.ts       Per-app identity: keyart, logos, colors
│   │   ├── settings.ts          Persisted settings stores
│   │   ├── motion.ts            Animation timing tokens
│   │   ├── theme.ts             Accent palettes
│   │   └── assets/logos/        Keyart, icons, lockups
│   └── src-tauri/               Rust backend
│       └── src/
│           ├── hid.rs            DualSense HID parsing, input loop
│           ├── commands.rs       Tauri IPC surface
│           ├── config.rs         Persisted tile list
│           ├── app_launch.rs     Shell out to games/apps
│           ├── active_apps.rs    Running process detection
│           ├── openrgb.rs        OpenRGB SDK client
│           ├── rumble.rs         Haptic feedback
│           ├── mouse_inject.rs   Trackpad-as-cursor
│           ├── display.rs        Resolution / refresh mode control
│           ├── network.rs        Wi-Fi profile management
│           ├── audio.rs          Master volume / mute
│           ├── power.rs          Power plans / idle
│           └── live_backdrop.rs  Running app window capture
├── listener/                    Tray-resident PS-button watcher
│   └── src-tauri/src/
│       ├── hid.rs                DualSense HID poll loop
│       ├── cursor_mode.rs        Trackpad mouse mode (outside console)
│       ├── triple_click.rs       PS triple-click detection
│       ├── launch.rs             Spawn / kill the launcher
│       └── tray.rs               System tray icon + Exit
├── demo/                        Design mockups (open in browser)
│   ├── game-page-a1.html         Home dashboard
│   ├── game-page-a1-idle.html    Idle / rest screen
│   ├── game-page-a1-search.html  Search
│   ├── game-page-a1-settings.html Settings
│   ├── game-page-a1-power.html   Power menu
│   ├── game-page-a1-quickmenu.html Quick Menu
│   └── game-page-a1-keyboard.html Keyboard
├── docs/specs/                   Feature specs
├── ISSUES.md                     Bug & feature tracker
├── OPTIMIZATION_PLAN.md          14-item performance roadmap
└── ART_PROMPTS.md                Image generation prompts
```

<br>

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Desktop shell** | [Tauri v2](https://tauri.app) (Rust + WebView2) |
| **Frontend** | React 19 + TypeScript, Vite 5 |
| **Animation** | CSS `@keyframes` + `will-change` (compositor-only) |
| **Fluid backgrounds** | [Fluid by KrackedDevs](https://fluid.krackeddevs.com) (WebGL) |
| **Controller HID** | Raw HID API (Rust `hidapi`) |
| **RGB** | OpenRGB SDK binary protocol |
| **Ty…graphy** | Manrope variable font (200–800 weight axis) |
| **Build** | Tauri CLI, Vite, Cargo workspace |

<br>

## Design Philosophy

- **Compositor-only animations** — Everything that moves uses `transform` and `opacity`. No paint triggers, no layout thrash, sub-1 ms per frame.
- **Container query layout** — UI scales proportionally on any display via `cqw`/`cqh` units. Designed for 1440p, works on 1080p–4K.
- **Dual surface isolation** — Controller events never route to both Home and the Quick Menu at the same time. Each surface owns its own HID stream.
- **Dark only** — The console is a living-room device. It never blasts white light at the viewer.
- **No network ports** — Zero listeners on localhost or LAN. The launcher is a local app, not a server.

<br>

## License

MIT — see [LICENSE](LICENSE).

Built by [AJ Apau-Kese](https://github.com/AlteredAJ). ArtStation pieces used for hero keyart are credited in Settings > About.
