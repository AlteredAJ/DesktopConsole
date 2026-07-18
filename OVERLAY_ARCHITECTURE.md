# Native quick overlay architecture

## First delivery

The launcher now owns two Tauri windows:

- `main`: the existing full-screen PS5 Mode console.
- `overlay`: a lazily-created transparent, borderless, always-on-top, click-through Quick Menu.

When the console has yielded focus to an app/game, one **PS** press toggles the overlay. The HID thread keeps sending controller state only while the overlay is visible, which prevents the minimized dashboard from reacting to in-game navigation. **Circle** or another PS press hides the overlay. The overlay never requests mouse or keyboard focus.

## Constraints deliberately kept

- No DLL injection, hooks, or game-process modification.
- No public localhost server or network port.
- Borderless/windowed games are the supported overlay target. Exclusive fullscreen can obscure ordinary Windows windows.
- Tauri owns system input, haptics, and overlay state. Unreal is presentation-only in the next phase.

## References

- Tauri supports separate webview windows and `alwaysOnTop`: https://tauri.app/reference/javascript/api/namespacewebviewwindow/
- Windows layered windows with `WS_EX_TRANSPARENT` pass mouse events to the window underneath: https://learn.microsoft.com/en-us/windows/win32/winmsg/window-features

## Unreal handoff

`unreal-scaffold/` is a plugin skeleton plus `OverlayContract.json`. The planned bridge is a local named pipe carrying scene and overlay-state messages. Do not make Unreal the always-on-top overlay surface; let it render optional home/idle/game scenes launched by the native console.
