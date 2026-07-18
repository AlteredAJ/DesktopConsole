# Unreal target — first usable presentation slice

The `PS5ModeOverlay` plugin now includes a concrete Blueprint-facing
`UPS5ModePresentationSubsystem`. It is the endpoint for the semantic scene
state defined in `OverlayContract.json`; it is **not** an in-game input or
overlay owner.

## What exists now

- Runtime plugin module and a Game Instance subsystem.
- `ApplyNativeState(scene, accent, theme, enabled, quality)` Blueprint API.
- `OnPresentationChanged` multicast event for a UMG Home/Idle widget,
  materials, Camera rigs, and Niagara effects.
- `home`, `idle`, and `game` semantic scenes with the existing five themes.

## First Unreal editor pass

1. Install UE 5.x, create a blank desktop project, and copy this folder to
   `<Project>/Plugins/PS5ModeOverlay`.
2. Enable **PS5 Mode Presentation Bridge**, regenerate project files, then
   compile.
3. Make `WBP_PS5ModePresentation` and bind it to `OnPresentationChanged` from
   the Game Instance subsystem.
4. Build only three effects at first: dark cinematic base, slow particles, and
   accent-driven refractive dock glow. Keep all menu controls in Tauri.
5. Add the local named-pipe adapter only after the static scene and measured
   warm-start behavior are good. Its only input is `OverlayContract.json`
   semantic state, never raw HID/controller events.

## Why it is not compiled here

Unreal Engine is not installed on this PC, so this source is prepared but not
locally compiled. The existing Rust/Tauri release remains entirely functional.
The first UE owner should compile the plugin in the chosen UE 5.x version and
record the engine version plus RAM/VRAM measurements in this folder.
