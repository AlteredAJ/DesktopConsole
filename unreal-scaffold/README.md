# PS5 Mode Unreal scaffold

This is an Unreal plugin skeleton for the future animated presentation layer.
It does **not** inject into games and does not replace the native Tauri overlay.

## Ownership

- **Native/Tauri:** owns the global controller listener, transparent quick overlay, Windows focus, haptics, and app/game launching.
- **Unreal:** will own optional 3D backgrounds, reactive particles, and premium dashboard scenes.
- **Bridge:** the documented JSON messages in `OverlayContract.json`; use a local named pipe in the next pass, never a public network port.

The native overlay intentionally remains the always-on-top surface. Unreal can be launched as a fullscreen scene from Console Home without affecting in-game controls.
