# PS5 / Apple-TV Mode

Couch/bed-accessible entertainment mode for Windows, triggered by **triple-clicking the PS button** on a DualSense controller. A lightweight tray listener sniffs the controller while idle; on the triple-click it spawns a fullscreen, controller-first launcher. Closing the launcher fully unloads it and returns to the idle listener.

> **New project — do NOT edit `dualsense-haptics-windows-src`.** That's the commercial, license-gated haptics product. This project only *copies patterns* out of it (see the Reuse Map in the plan).

## Two processes

| Process | Role | Resident? |
|---|---|---|
| `listener/` | Tray app. Polls DualSense HID, detects PS triple-click, spawns launcher. | Always (boot autostart) |
| `launcher/` | Fullscreen Tauri+React UI. Grid nav, touchpad mouse/swipe, streaming tiles, resolution settings. | Only while in mode |

## Build order (each unit independently testable — see plan `Verification Per Unit`)

- **Unit A** — listener + launcher skeleton (triple-click detection, tray, fullscreen window, D-pad grid nav, PS+Options exit). **Start here.**
- **Unit B** — touchpad-as-mouse + swipe nav + swipe-to-type keyboard.
- **Unit C** — streaming/app grid (YouTube embed + external launches for Netflix/Discord/Steam).
- **Unit D** — resolution/refresh-rate settings (EDID enumeration + crash-safe restore).

## ⚠️ Verify-before-coding hardware assumptions (Unit A step 1, Unit B step 1)

Two byte offsets are **assumed, not confirmed** in the existing codebase. Run the debug hex-dump (`hid::dump_raw_report`, enabled under `debug_assertions`) and confirm on real hardware **before** writing logic against them:

- **PS button** — assumed `buf[10] & 0x01`. Press PS alone, watch which bit of `buf[10]` toggles.
- **Touchpad X/Y** — assumed packed 12-bit pairs around `buf[33..39]`. Drag a finger, watch which bytes change.

Confirmed offsets (read directly from `dualsense-haptics-windows-src/src-tauri/src/hid.rs`):
`buf[1..4]`=sticks · `buf[5..6]`=triggers · `buf[8]`=face buttons · `buf[9]`=shoulders/L3/R3 · `buf[10] & 0x02`=touchpad click.

## Source of reusable patterns

`C:\Users\AlteredAJ\Downloads\Compressed\dualsense-haptics-windows-src\src-tauri\src\hid.rs`

| Target | Pattern | Location |
|---|---|---|
| `listener/hid.rs` | `find_dualsense()`, read loop | `hid.rs:2895-2905`, `:2683` |
| `launcher/hid.rs` | Button byte parsing | `hid.rs:2558-2562` |
| `launcher/mouse_inject.rs` | `aim_loop` / `mouse_event` binding | `hid.rs:2827-2885` |
| `launcher/config.rs` | Serde config + `dirs` | `settings.rs:1-28` |

## Prereqs

- Rust + Cargo, Node 18+, Tauri v2 CLI (`cargo install tauri-cli --version '^2'`)
- A DualSense controller (USB or Bluetooth)

See `C:\Users\AlteredAJ\.claude\plans\refactored-seeking-alpaca.md` for the full plan.

## Controller quick controls

- Triple-press **PS** from Windows to open the console. While the console is open, use **Power** for **Minimize console** or **Close console**; this avoids competing triple-PS behavior.
- Outside the console, hold the physical **touchpad click** for **2 seconds** to toggle trackpad mouse mode. The controller gives a stronger pulse for on and a lighter pulse for off. A short click remains a left-click while mouse mode is on.
- When the console is minimized, **two** quick physical trackpad clicks return to it; a **third** click inside the short window opens Windows' on-screen keyboard instead. When the console is fully closed, triple-click the physical trackpad to open Windows' on-screen keyboard.
## Console entry and rest mode

- Triple-press **PS** from Windows to open the console entry screen, then press **PS** once more to enter the dashboard.
- **Rest mode** in the Power menu enters the animated idle screen and lowers power use. Press **PS** to wake.
- The unstable **Network** Settings tab is intentionally hidden from controller navigation; all other Settings tabs remain available.