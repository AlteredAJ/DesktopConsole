# PS5 / Apple-TV Mode

A controller-first, 10-foot Windows couch launcher, opened by **triple-clicking
the PS button** on a DualSense. A tray-resident listener watches the controller
while idle; on the triple-click it spawns a fullscreen, glass-console launcher.
Closing the launcher fully unloads it and returns to the idle listener.

> **Live status:** see [`PROJECT_STATUS.md`](PROJECT_STATUS.md) (or open
> [`BUILD_BOARD.html`](BUILD_BOARD.html)). **Design/behavior contract:**
> [`CLAUDE_FINAL_HANDOFF.md`](CLAUDE_FINAL_HANDOFF.md).

## Two processes

| Process | Role | Resident? |
|---|---|---|
| `listener/` | Tray app. Polls DualSense HID, detects the PS triple-click, spawns the launcher. | Always (boot autostart) |
| `launcher/` | Fullscreen Tauri + React console. Grid nav, touchpad mouse/swipe, tiles, hero art, settings. | Only while in mode |

Both crates build into one shared `target/` (see the workspace `Cargo.toml`) so
the listener finds `ps5-launcher.exe` next to `ps5-listener.exe`.

## Build & run

Prereqs: Windows 11, Rust + Cargo, Node 18+, the Tauri v2 CLI, WebView2 runtime,
and a DualSense for hardware verification.

```powershell
# Frontend only (type-check + production bundle)
cd launcher
npm ci
npx tsc --noEmit && npx vite build

# Full app (dev)
npx tauri dev

# Packaged desktop build — never ship a devUrl/Vite build
npx tauri build --no-bundle     # -> target/release/ps5-launcher.exe

# Listener (rebuild after tray/HID changes)
cd ..\listener
npx tauri build
```

Keep `ps5-listener.exe` alongside `ps5-launcher.exe` in the packaged folder.

## Controller quick controls

- **Triple-press PS** from Windows to open the console entry screen; press **PS**
  once more to enter the dashboard.
- While the console is open, use **Power** for Minimize / Close / Lock / Rest /
  Shut down (each destructive action has a second confirmation).
- **Rest mode** (Power menu) enters the animated idle screen and lowers power use;
  press **PS** to wake.
- Outside the console, **hold the physical touchpad click for 2 s** to toggle
  trackpad mouse mode (stronger pulse = on, lighter = off). A short click is a
  left-click while mouse mode is on.
- When minimized, **two** quick touchpad clicks return to the console; a **third**
  within the window opens Windows' on-screen keyboard. When fully closed,
  triple-click the touchpad for the Windows on-screen keyboard.
- The unstable **Network** Settings tab is intentionally hidden from controller
  navigation; all other tabs are reachable.

## Constraints (non-negotiable)

No DLL injection, process hooks, anti-cheat bypasses, or a public local-network
port. No automatic drive scans (rescan is an explicit Settings action). Packaged
builds must not depend on localhost. See [`PROJECT_STATUS.md`](PROJECT_STATUS.md)
for the full ground rules.
