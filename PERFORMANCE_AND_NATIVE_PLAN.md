# Performance and native-overlay plan

## Decision

Keep **Tauri/WebView2 for Console Home and the current Quick Menu**. Optimize first; investigate a native overlay only as an isolated measured proof. Do not pursue Xbox Game Bar, injection, or Unreal as an in-game overlay host.

## Applied in this pass

- Removed the remote `fluid.krackeddevs.com` iframe from the Home backdrop. Home now uses only local CSS/React assets, eliminating network, another renderer/document, and unpredictable animation cost from the entry path.
- Removed automatic `sync_game_library` (whole-drive scan) from startup and the Games tab. It now runs only from the explicit Settings > System > Rescan Games action, so Home navigation never starts drive I/O unexpectedly.
- Coalesced frontend controller delivery to `requestAnimationFrame`; React consumes the newest state once per visual frame instead of processing stale queued messages.
- Kept HID edge/gesture processing native and unthrottled. Native emits only changed state at roughly 60Hz, and routes it only to the active surface.
- Made Quick Menu stylesheet injection idempotent so a recovery/remount cannot accumulate style tags.

## Why these are the right first moves

Microsoft recommends avoiding redundant WebView2 instances, reusing already-created controls, keeping GPU acceleration enabled, batching native/web communication, avoiding layout thrash, and using CSS rather than JavaScript for animations. The current prewarmed overlay and these changes follow that guidance. [WebView2 performance best practices](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance?tabs=dotnetcsharp) (accessed 2026-07-15).

The native side must not block or make chatty UI calls on its UI thread; WebView2 is single-threaded and message-pump based. [WebView2 threading model](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/threading-model) (accessed 2026-07-15).

Modern Windows flip-model games can achieve fullscreen-like efficiency in borderless mode, but desktop overlay coverage remains best-effort when a game uses exclusive/fullscreen presentation. [DXGI flip model guidance](https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/for-best-performance--use-dxgi-flip-model) (accessed 2026-07-15).

## Next measurements — before changing architecture

Add local, opt-in timings for:

1. HID PS gesture → overlay `show()` call.
2. Overlay `show()` call → first animation frame.
3. Circle/resume → overlay hidden.
4. App launch → yielded state.
5. Process memory and GPU usage after 100 overlay toggles.

Use a 100-toggle stress test in desktop, a borderless DX11 game, and a borderless DX12 game. Record focus correctness and controller double-input failures beside timing data.

Suggested product targets (not guarantees): open under 150 ms after warm-up, close under 75 ms, navigation feedback within one 60 Hz frame, and no sustained CPU work while the overlay is hidden.

## Native proof gate

The proof is under `native-overlay-poc/`. It may graduate only if it beats the prewarmed overlay in the above test while preserving click-through, no-focus-steal behavior, reliability, and a lower steady resource cost. Windows composition provides a valid native experiment surface, but it does not grant access to another process’s rendering or make exclusive fullscreen universally coverable. [DirectComposition target documentation](https://learn.microsoft.com/en-us/windows/win32/api/dcomp/nf-dcomp-idcompositiondevice-createtargetforhwnd) (accessed 2026-07-15).
