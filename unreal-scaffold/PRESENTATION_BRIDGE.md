# Unreal presentation bridge

Unreal is kept as the premium **presentation** option, not the always-on-top
in-game controller overlay. That separation preserves stable input and a light
baseline while still giving the project room for liquid-glass scenes, reactive
particles, depth, and high-end transitions.

## Responsibility boundary

| Layer | Owns | Must not own |
|---|---|---|
| Rust/Tauri host | controller listener, haptics, game/app lifecycle, focus, quick-menu visibility | Unreal scene state or a second HID reader |
| Native overlay POC / future renderer | transparent topmost surface and presentation-frame timing | launching games, scanning games, input arbitration |
| Unreal plugin | optional Home/Idle scenes, particle fields, 3D cards, visual reactions | global input, game process hooks, overlay guarantees |

## Bridge protocol

`OverlayContract.json` is the versioned semantic contract. The next real
bridge is a local Windows named pipe created by the Rust host and consumed by
the Unreal plugin. Messages are state updates, not raw controller events:

- `scene.set` — Home, game or idle scene plus accent/theme.
- `overlay.show` / `overlay.hide` — visual state only.
- `input.hint` — optional visual feedback after the Rust owner already acted.

The host remains authoritative. If Unreal crashes, takes too long to start, or
is disabled, the launcher and Quick Menu continue without it.

## Recommended next implementation

1. Add a `UGameInstanceSubsystem` that connects to the named pipe on a worker
   thread and marshals JSON to the game thread.
2. Map `scene.set` to Niagara/material parameters and a small set of Camera
   transitions; do not mirror every DOM control in Unreal.
3. Start Unreal only for Console Home/Idle presentation, prewarm it, and hide
   it immediately before launching a game.
4. Measure cold start, RAM/VRAM, and return-to-home latency. Keep it optional
   unless it stays within the agreed idle budget.

## Effects worth using Unreal for

- slow parallax particle fields and illuminated sparkles;
- refractive liquid-glass depth behind a home dock;
- physically smooth camera drift during idle-to-home transitions;
- reactive ambient light driven by selected app/game accent.

Do not use Unreal merely to draw the Quick Menu: the native/Tauri path is
lighter and is the resilient fallback for games, anti-cheat, and failures.
