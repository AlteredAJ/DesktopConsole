# Live App Backdrop — required behavior

## Goal

When the focused Home tile represents a running compatible desktop app, replace its static hero art with that **specific app's** live/snapshot backdrop beneath the existing frosted-glass treatment.

This is never allowed to flicker or visibly make a decision after the user has focused the tile.

## Preflight state machine

`Hero` → `Checking` → `Ready` → `Crossfade` → `Live`

- **Hero:** static hero art is the only visible source.
- **Checking:** run asynchronously/offscreen. Keep Hero fully visible. Do not alter opacity, layout, focus, or the atmosphere.
- **Ready:** only reached after a source window is confirmed, a valid frame/thumbnail exists, and it passes eligibility checks.
- **Crossfade:** use a single 220–320 ms opacity/scale transition from Hero to the prepared backdrop.
- **Live:** refresh at a bounded rate appropriate to the chosen capture method. If a later refresh fails, retain the last valid frame; do not flash back to Hero.

If preflight fails, times out, detects protected/DRM/black content, a minimized source, exclusive fullscreen, or an ambiguous window match, remain in `Hero`. The fallback is invisible to the user.

## Source selection — never show another app

1. Resolve the focused tile to its known process name or direct executable path.
2. Enumerate only visible top-level windows belonging to that process.
3. Reject launcher-owned, tool, child, cloaked, minimized, zero-size, and non-user-facing windows.
4. Prefer the app window that was most recently foreground/yielded; otherwise require one unambiguous eligible main window.
5. If more than one eligible main window remains, do not guess: stay on Hero.

The last yielded foreground window should be captured before Home regains foreground, so opening Home does not make the launcher itself appear to be the app source.

## Capture strategy

Current Stage 1: a native `PrintWindow` snapshot bridge is used behind the
existing HTML/CSS atmosphere. It is one prepared PNG per eligible focused tile;
it does not capture the desktop, create a public port, inject, hook, or run a
continuous browser capture loop. It rejects missing/black/ambiguous windows.

Possible Stage 2: native DWM thumbnail or native frame source directed into the
launcher HWND. Consider it only after measuring Stage 1. Do not use a remote
capture service, injection, hooks, or a public port.

Windows supports associating a selected top-level source window with an owned destination window through `DwmRegisterThumbnail`; the destination must belong to this process. [Microsoft documentation](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/nf-dwmapi-dwmregisterthumbnail)

Windows Graphics Capture is a second option when a richer native capture pipeline is needed, but it has user-consent/system-UI and capture-frame lifecycle constraints. [Microsoft documentation](https://learn.microsoft.com/en-us/windows/apps/develop/media-authoring-processing/screen-capture)

## Performance limits

- Debounce a tile-focus change for ~120 ms before starting a check.
- Cancel an in-flight check whenever focus changes.
- Preflight deadline: 350 ms. Timeout means Hero, not a late visual change.
- Cap snapshot/live refresh; no browser-side per-frame image encoding.
- Cache one last valid image/thumbnail per tile and release it when the process exits.

## Acceptance tests

1. Multiple running apps: focusing Discord cannot show Spotify, browser, or launcher content.
2. Focus rapid-scroll: no preview flashes while moving across tiles.
3. Eligible app: static Hero crossfades exactly once into frosted live content.
4. Minimized/protected/exclusive app: remains on Hero without warning or layout jump.
5. Returning to an already-cached tile: instant crossfade or current cached frame, no blank state.
