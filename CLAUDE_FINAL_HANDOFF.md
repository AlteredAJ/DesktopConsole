# PS5 Mode — Final Design Handoff for Claude

**Status:** authoritative implementation/design handoff, 2026-07-15.  
**Design authority:** this document and the running `PS5-Mode-Codex-Final-2026-07-14` desktop package take precedence over the prior Claude/scaffold design. Preserve this visual language, interaction model, and native-overlay direction unless the user explicitly asks for a redesign.

## 1. What this is

PS5 Mode is a controller-first Windows couch launcher. It is a production-mode Tauri v2 application (`Rust + WebView2 + React`) with a small resident DualSense listener. It does **not** depend on a local web server in the packaged build.

The product has two distinct surfaces:

1. **Console Home** — a full-screen, animated dashboard for apps, games, launchers, settings, search, power, and rest mode.
2. **Quick Menu** — a prewarmed, transparent, click-through, topmost window intended for a game/app that currently has focus.

The visual target is **premium console glass**, inspired by contemporary console and living-room interfaces but not a reproduction of Sony assets or UI.

## 2. Non-negotiable design rules

- Keep the dark, cinematic backdrop; colored hero atmosphere belongs to the selected tile.
- Use deep frosted/liquid glass: restrained specular highlights, soft blur, subtle interior light, generous radius, no flat-card dashboard look.
- Icons for apps/games/launchers should retain the raised glass / polished app-icon posture.
- Focus is obvious but elegant: small scale lift, white keyline, accent-colored bloom, short motion. Do not use heavy rectangular focus outlines.
- The home dock is the primary content. It remains bottom anchored and horizontally browsable.
- Utility controls remain top-right. Settings must use a **cog**, never a sun. Power uses a standard power glyph.
- Quick Menu is context-specific: game wording/content differs from app wording/content. It must not look like a miniature copy of Home.
- Do not re-introduce the old generic blue-gradient browser page, basic pill-only navigation, or plain gradient hero art.

## 3. Final interaction contract

### Console lifecycle

- From Windows, the resident listener uses the configured **PS-button triple press** to open the console entry experience.
- The entry/idle screen is animated; pressing PS enters Home.
- Power menu includes Minimize console, Close console, Lock, Rest mode, and Shut down. Every destructive action has a second confirmation.
- Rest mode returns to the animated idle presentation; PS wakes it.
- When Home launches an external app/game, Home is explicitly yielded/minimized. Do not infer yielded state from WebView focus events.

### Quick Menu and input isolation

- While yielded to an app/game, **double-press PS within the short gesture window** toggles Quick Menu.
- Quick Menu receives controller events only while it is visible. Home must receive none while yielded. This prevents double navigation/activation.
- Circle dismisses Quick Menu. Resume dismisses it. Returning Home restores the main dashboard deliberately.
- The Quick Menu is mouse click-through and does not take keyboard/mouse focus from the game.
- Supported target is desktop + borderless/windowed games. Exclusive fullscreen can cover any non-injected ordinary Windows overlay; do not use DLL injection, hooks, or anti-cheat workarounds.

### Controller and touchpad

- D-pad and left stick perform discrete controller navigation.
- Haptic/audio feedback is applied on navigation and selection when enabled in settings.
- Hold physical touchpad click for 2 seconds outside the console to toggle mouse mode; haptics indicate on/off.
- Multi-click touchpad gestures are reserved for returning to console / Windows on-screen keyboard per the implemented listener logic. Do not casually remap these gestures.
- Home swipe sensitivity and keyboard swipe sensitivity are separate persisted settings. Keyboard sensitivity is deliberately lower.

## 4. Current UI behavior

### Home

- Tabs: Apps, Games, Launchers.
- Top utility row: Wi-Fi, Search, Settings, Power, **DualSense battery**, clock.
- Battery is a proper outlined meter, not a dash. DualSense exposes coarse ten-step charge data; label it `~NN%`, not an exact percentage.
- Clock and controller battery are distinct top-right status elements; do not merge them into one generic pill.
- Search is a navigable button, not just a keyboard shortcut.
- Networking settings tab was intentionally removed from controller navigation because it was unstable.

### Quick Menu

Seven frosted cards: Resume/Back to app, Sound, Controller, Game Base, Capture, RGB, Console Home.

- Sound: Cross toggles master mute; D-pad Up/Down changes master volume when Sound is selected.
- RGB: this is a custom in-overlay control, not an OpenRGB GUI launcher. Cross cycles Ice, Violet, Warm, and Off scenes via the local OpenRGB CLI bridge.
- Game Base: intentionally an honest placeholder. It needs a chosen provider (recommended decision: Discord first; then consider Steam identity/status). Do not fake social functionality.
- Header: current time plus DualSense outlined meter and approximate charge.

## 5. Source map

| Area | Primary files |
|---|---|
| Full Home visual/design | `launcher/src/components/CodexLauncher.tsx`, `icons.tsx`, `heroArt.tsx` |
| Quick Menu | `launcher/src/components/QuickOverlay.tsx` |
| App routing / start, idle, entry | `launcher/src/App.tsx` |
| Controller frontend stream | `launcher/src/hooks/useController.ts`, `useTouchpad.ts` |
| Persisted interaction settings | `launcher/src/settings.ts`, `components/SettingsMenu.tsx` |
| Haptic/audio feedback | `launcher/src/feedback.ts`, `src-tauri/src/rumble.rs`, `audio.rs` |
| HID parsing, gestures, event routing | `launcher/src-tauri/src/hid.rs` |
| Explicit yielded state + overlay window | `launcher/src-tauri/src/commands.rs` |
| Tauri boot/prewarm | `launcher/src-tauri/src/lib.rs` |
| OpenRGB adapter | `launcher/src-tauri/src/openrgb.rs` |
| Tauri window config | `launcher/src-tauri/tauri.conf.json` |

## 6. Architecture constraints to preserve

- Package builds with `tauri build --no-bundle` embed `launcher/dist`; they must run without `localhost` or a Vite server.
- The main and overlay windows are prewarmed separately. Avoid destroying/recreating the overlay during normal toggles.
- `YIELDED` changes only through explicit yield/restore commands. A temporary focus change caused by the click-through overlay must never mutate console state.
- Coalesce HID data to logical UI events. Do not push raw poll-rate state into costly React renders unnecessarily.
- Do not allow controller events to reach both Home and Quick Menu at the same time.
- No injection, Present hooks, anti-cheat bypasses, or public local-network ports.
- OpenRGB is optional: show a clear unavailable/failure message if `C:\Program Files\OpenRGB\OpenRGB.exe` is absent.
- Appearance settings persist through local storage and synchronize between Home and Quick Menu via `BroadcastChannel`. Current accent choices are Blue, Purple, Green, Amber, and Rose.
- Game scans must run only from Settings > System > Rescan Games. Never automatically scan a drive during startup or when entering the Games tab.
- Power is a vertical controller menu: Up/Down selects Minimize, Close, Lock, Rest, or Shut down; Cross confirms; Circle backs out.

## 7. Unreal position

`unreal-scaffold/` is preparation only. Unreal is **not** the overlay host.

- Native Rust/Tauri owns input, haptics, app launching, state, focus, Windows overlay behavior, and recovery.
- Unreal may later render optional 3D home/idle backgrounds, particles, video/hero scenes.
- Use the existing `unreal-scaffold/OverlayContract.json` as the proposed message shape. Future integration uses a local named pipe, not HTTP/localhost.
- The scaffold now includes `UPS5ModePresentationSubsystem`, a Blueprint-facing semantic state endpoint. Start with `UNREAL_SETUP.md`; compile it only after selecting/installing UE 5.x.
- Keep Unreal a separately launched visual process with crash isolation and a 2D static fallback. Do not embed it in Quick Menu or keep it resident during games.

## 8. Build, package, and verify

Prerequisites: Windows 11, Rust/Cargo, Node, WebView2 runtime, and a DualSense for hardware verification.

```powershell
cd launcher
npm ci
npx tauri build --no-bundle
```

Use the production executable at `target/release/ps5-launcher.exe`; do **not** distribute a dev build configured with `devUrl`. Keep `ps5-listener.exe` alongside it in the desktop package.

Minimum validation before a handoff:

1. Launch only one listener and one launcher; confirm no listener on TCP 1420.
2. Repeat app launch → yielded → double-PS Quick Menu → Circle/resume → Home at least 20 times.
3. Confirm focus never navigates both Quick Menu and Home.
4. Confirm controller navigation, touchpad mouse mode, keyboard gesture, and haptics with the physical pad.
5. Confirm battery renders as an outlined meter plus `~` value, not a dash/exact claim.
6. Confirm OpenRGB card opens the actual installed application and that missing OpenRGB does not crash the launcher.

## 9. Documentation cleanup instruction for Claude

Retain older `HANDOFF.md`, `README.md`, and `OVERLAY_ARCHITECTURE.md` only as historical context. Before making new work, update them to point to this file and remove any statement that conflicts with Sections 2–8. In particular, older notes claiming one-press Quick Menu, scaffold-only status, a sun settings icon, an exact battery percentage, or an Unreal overlay are obsolete.

## 10. Next work in order (do not redesign first)

1. Implement `LIVE_APP_BACKDROP_SPEC.md`: native preflight/capture proof for eligible desktop apps, with Hero art held until a prepared source crossfades in.
2. Hardware-test the DualSense charge parsing against USB and Bluetooth and improve it only if reports prove wrong.
3. Decide and integrate one Game Base provider; Discord is the pragmatic first choice.
4. Add state-machine telemetry and stress tests for repeated yield/overlay cycles.
5. Build a tiny native Win32/DirectComposition overlay proof of concept before committing to a rewrite. Keep Tauri Home intact while testing it.
