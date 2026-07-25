# Contributing to DesktopConsole

Thank you for your interest in contributing! Every contribution matters — whether it's fixing a typo, reporting a bug, or building a new console feature.

---

## Code of Conduct

By participating, you agree to maintain a respectful and inclusive environment. Be kind and constructive in all interactions.

---

## Ways to Contribute

- **Report bugs** — Found something broken? Open an issue with reproduction steps (controller used, Windows build, trigger sequence).
- **Suggest features** — Have an idea for the console UX? Open a Feature Request issue.
- **Improve documentation** — Fix typos, clarify setup steps, add GIF demos.
- **Write code** — Fix bugs, add controller support, improve the Quick Menu, or extend settings.
- **Design feedback** — The `demo/` folder contains static HTML mockups. Open them in a browser and suggest improvements.

---

## Getting Started

### Prerequisites

- **Windows 11** (required)
- **DualSense controller** (USB or Bluetooth)
- **Node.js 18+**
- **Rust** (via [rustup](https://rustup.rs))
- **WebView2 runtime** (included in Windows 11)
- **Tauri CLI v2**: `cargo install tauri-cli --version "^2"`

### Setup

```powershell
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/<your-username>/DesktopConsole.git
cd DesktopConsole

# 3. Install launcher dependencies
cd launcher
npm ci

# 4. Build the listener
cd ../listener
cargo build

# 5. Dev mode (launcher with hot reload)
cd ../launcher
npx tauri dev
```

> **Note:** The listener detects triple-PS-button taps. Keep the listener running in the background (`ps5-listener.exe`) for a full end-to-end test.

### Dev Iteration

```powershell
.\verify.ps1         # Type-check + cargo check (fast, no linking)
.\rebuild.ps1        # Full production build + restart listener
.\rebuild.ps1 -Dev   # Fast build (skip LTO, for iteration)
```

---

## Development Workflow

### Branching

```powershell
git checkout main
git pull upstream main
git checkout -b feat/your-feature-name
```

| Prefix | Purpose |
|---|---|
| `feat/` | New feature (Quick Menu item, Settings page, tile type) |
| `fix/` | Bug fix |
| `docs/` | Documentation only |
| `refactor/` | Code restructuring (no behavior change) |
| `perf/` | Performance improvements (compositor, render, HID) |
| `ui/` | Visual design, CSS, motion, layout changes |

### Commit Messages

Follow Conventional Commits:

```
<type>(<scope>): <short summary>

[optional body]
```

Examples:
```
feat(launcher): add Steam library integration tile
fix(listener): correct PS triple-click debounce timing
ui(quickmenu): adjust volume slider step size
refactor(hid): extract DualSense parsing into shared crate
```

---

## Project Structure

```
DesktopConsole/
├── launcher/                    # Fullscreen Tauri + React console
│   ├── src/                     # React frontend
│   │   ├── components/          # All UI — CodexLauncher, QuickOverlay,
│   │   │                         # SettingsMenu, GameDetailPanel, etc.
│   │   ├── hooks/               # useController, useEdges, useGridNav,
│   │   │                         # useSpringScroll, useTouchpad
│   │   ├── appRegistry.ts       # Per-app identity — keyart, logos, colors
│   │   ├── settings.ts          # Persisted settings stores
│   │   ├── motion.ts            # Animation timing tokens
│   │   ├── theme.ts             # Accent palettes
│   │   └── assets/logos/        # Keyart, icons, lockups
│   └── src-tauri/               # Rust backend
│       └── src/
│           ├── hid.rs            # DualSense HID parsing, input loop
│           ├── commands.rs       # Tauri IPC surface
│           ├── config.rs         # Persisted tile list
│           ├── app_launch.rs     # Shell out to games/apps
│           ├── active_apps.rs    # Running process detection
│           ├── openrgb.rs        # OpenRGB SDK client
│           ├── rumble.rs         # Haptic feedback
│           ├── mouse_inject.rs   # Trackpad-as-cursor
│           ├── display.rs        # Resolution / refresh mode control
│           ├── network.rs        # Wi-Fi profile management
│           ├── audio.rs          # Master volume / mute
│           ├── power.rs          # Power plans / idle
│           └── live_backdrop.rs  # Running app window capture
├── listener/                    # Tray-resident PS-button watcher
│   └── src-tauri/src/
│       ├── hid.rs                # DualSense HID poll loop
│       ├── cursor_mode.rs        # Trackpad mouse mode (outside console)
│       ├── triple_click.rs       # PS triple-click detection
│       ├── launch.rs             # Spawn / kill the launcher
│       └── tray.rs               # System tray icon + Exit
├── demo/                        # Design mockups (open in browser)
│   ├── game-page-a1.html         # Home dashboard
│   ├── game-page-a1-quickmenu.html # Quick Menu
│   ├── game-page-a1-settings.html  # Settings
│   ├── game-page-a1-power.html     # Power menu
│   └── game-page-a1-keyboard.html  # On-screen keyboard
├── docs/specs/                   # Feature specifications
├── ISSUES.md                     # Bug & feature tracker
├── OPTIMIZATION_PLAN.md           # 14-item performance roadmap
└── ART_PROMPTS.md                # Image generation prompts
```

---

## Code Quality

```powershell
# Frontend (TypeScript)
cd launcher
npx tsc --noEmit       # Type check
npm run lint           # ESLint (if configured)

# Backend (Rust)
cd launcher/src-tauri
cargo fmt --check
cargo clippy -- -D warnings
cargo test

# Fast pre-commit check
.\verify.ps1
```

---

## Testing

- **Unit tests**: `cargo test` in each `src-tauri/` directory.
- **Integration**: Run the listener + launcher together. Triple-tap PS from Windows; verify the console opens.
- **Overlay**: Launch any game, then double-tap PS to verify the Quick Menu overlay appears transparently.
- **Design review**: Open `demo/game-page-a1.html` in a browser at 1920×1080 to preview UI changes.

---

## Design Philosophy

Before contributing UI changes, understand these principles:

- **Compositor-only animations** — Use `transform` and `opacity` only. No paint triggers, no layout thrash. Target sub-1 ms per frame.
- **Container query layout** — UI scales via `cqw`/`cqh` units. Design for 1440p; verify on 1080p and 4K.
- **Dual surface isolation** — Controller events never route to both Home and Quick Menu simultaneously.
- **Dark only** — The console is a living-room device. It never blasts white light.
- **No network ports** — Zero listeners on localhost or LAN. The launcher is a local app, not a server.
- **No DLL injection** — The Quick Menu uses transparent click-through windows. No hooks, no anti-cheat bypasses.

---

## Submitting Changes

### Opening an Issue

Before working on a significant change, open an issue to discuss the approach.

When reporting a bug, include:
- Windows build number
- Controller model and connection type (USB / Bluetooth)
- Steps to reproduce (exact button sequence)
- Expected vs. actual behavior
- Whether the listener or launcher crashed

### Pull Request Process

1. Keep PRs focused — one logical change per PR.
2. Test with a physical DualSense if your change touches HID, input, or controller UX.
3. Verify both the launcher and listener build successfully.
4. Update docs if your change affects user-facing behavior.
5. Fill in the PR template — describe what your change does and why.

---

## First-Time Contributors

Good areas to start:

- **Documentation** — Fix typos, add setup GIFs, improve spec docs
- **Demo designs** — Improve the static HTML mockups in `demo/`
- **Error handling** — Better user feedback when controller disconnects, HID errors
- **Accessibility** — High-contrast modes, larger text options, screen reader support
- **RGB profiles** — Add new OpenRGB scene presets
- **App registry** — Add new game or media app entries to `appRegistry.ts`

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
