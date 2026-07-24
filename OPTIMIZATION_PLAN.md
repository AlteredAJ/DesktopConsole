# Optimization Plan

Compiled 2026-07-23. Sorted by impact: gaming drain first, then startup, then steady-state.

---

## Phase 1 — Gaming Drain (eliminate CPU burn while playing)

### 1.1 Cache `foreground_is_launcher()` — listener

**File:** `listener\src-tauri\src\cursor_mode.rs:225`
**Cost:** 5 Win32 syscalls every HID tick (600-1400Hz) = ~7,000/s while gaming.
**Fix:** Cache last result in a `static Mutex<(bool, Instant)>`. Return cached value if < 100ms old. Only re-check on touchpad-click edge or PS press.
**Time:** 10 min
**Verify:** Task Manager CPU for `ps5-listener.exe` drops from ~0.5% to ~0.1%.

### 1.2 Throttle launcher HID loop when yielded

**File:** `launcher\src-tauri\src\hid.rs:191-278`
**Cost:** Full `PadState` parse + allocate at 600-1400Hz even when window hidden. Two processes reading same controller.
**Fix:** When `YIELDED == true && !OVERLAY_ACTIVE`, add `thread::sleep(Duration::from_millis(40))` at end of yielded branch. Also bump `read_timeout` from 16ms to 100ms when yielded.
**Time:** 10 min
**Verify:** `ps5-launcher.exe` CPU drops to near-zero when hidden.

### 1.3 Pause `running_tile_ids` poll when window hidden

**File:** `launcher\src\components\CodexLauncher.tsx:148`
**Cost:** Full system process enumeration + IPC every 4s while window hidden.
**Fix:** Listen for `visibilitychange` event. Clear interval when hidden; restart on visible.
**Time:** 10 min
**Verify:** No `sysinfo` calls while window is hidden (check with Task Manager CPU spikes).

---

## Phase 2 — Startup (biggest single latency win)

### 2.1 Lazy-load keyart images

**File:** `launcher\src\appRegistry.ts:49-53`
**Cost:** `import.meta.glob(..., { eager: true })` loads all 55 hero images (76MB) at module eval, before first paint. 500-2000ms cold startup added.
**Fix:** Remove `eager: true` from all `import.meta.glob` calls. Adjust consumers in `KeyArtHero.tsx` and `IdleScreen.tsx` to use dynamic `import()` or `glob` with `{ eager: false }` + lazy resolution per-tile.
**Time:** 30 min
**Verify:** Launcher opens faster; `tsc && vite build` still passes.

### 2.2 Defer Quick Menu overlay prewarm

**File:** `launcher\src-tauri\src\lib.rs:149`
**Cost:** `prewarm_quick_overlay()` creates a second WebView2 during startup render path. ~100-300ms.
**Fix:** Move to `setTimeout` or `requestIdleCallback` equivalent after first paint (`onReady` handler).
**Time:** 15 min
**Verify:** Overlay still opens instantly on double-PS after boot.

---

## Phase 3 — Render Performance (per-frame savings)

### 3.1 Extract inline CSS from component body

**File:** `launcher\src\components\CodexLauncher.tsx:329-355`
**Cost:** 26-line CSS template literal recreated at 60fps, written to DOM `<style>` element every render.
**Fix:** Move to a module-level `const` or into `styles.css`.
**Time:** 10 min
**Verify:** DevTools Performance tab — no more "Recalculate Style" triggered by style mutation.

### 3.2 Pause CSS animations when window hidden

**File:** `launcher\src\styles.css:181, 220-236`
**Cost:** 4 compositor layers (`will-change: transform, opacity`) retained in VRAM even when window hidden. ~5-15MB VRAM. Animation timers keep firing.
**Fix:** Add `visibilitychange` listener in `App.tsx`. Toggle `.window-hidden` class that sets `animation-play-state: paused` and clears `will-change`.
**Time:** 10 min
**Verify:** GPU memory for WebView2 process drops when window hides.

### 3.3 Stop ambient audio when window hidden

**File:** `launcher\src\ambient.ts:179`
**Cost:** 8 oscillators + `setInterval(500ms)` Web Audio processing when window hidden.
**Fix:** Use same `visibilitychange` listener; call `stopAmbient()` / `startAmbient()`.
**Time:** 5 min
**Verify:** No Web Audio nodes in DevTools Audio tab when window hidden.

---

## Phase 4 — Rust Steady-State (config, processes, dedup)

### 4.1 Cache config in memory

**File:** `launcher\src-tauri\src\config.rs:58-64`
**Cost:** Every `get_cursor_sensitivity`, `set_cursor_sensitivity`, `sync_game_library`, `launch_trainer` re-reads + parses config.json from disk.
**Fix:** Use `OnceLock<Mutex<AppConfig>>` with a dirty flag. Write-through on save, read from cache.
**Time:** 20 min
**Verify:** File-system monitor shows zero config.json reads after startup.

### 4.2 Cache process-list snapshot

**File:** `launcher\src-tauri\src\active_apps.rs:27-30`
**Cost:** `sys.refresh_processes(All)` on every `running_tile_ids` call. 900 full snapshots/hr.
**Fix:** Add 1-2s cache inside `running_tile_ids()`. Skip refresh if last snapshot is fresh.
**Time:** 10 min
**Verify:** Syscalls/sec in Process Monitor drop significantly.

### 4.3 Deduplicate Rust code with shared crate

**Files affected:**
- `find_dualsense()` — 4 copies: `launcher/hid.rs:493`, `launcher/rumble.rs:162`, `listener/hid.rs:171`, `listener/rumble.rs:19`
- `TripleClickTracker` — 2 copies: `launcher/hid.rs:422`, `listener/triple_click.rs:11`
- `bt_wake::send()` — 2 copies: `launcher/bt_wake.rs`, `listener/bt_wake.rs` (42 lines each)
- BT rumble report builder — 2 copies: `launcher/rumble.rs:143`, `listener/rumble.rs:27`

**Fix:** Create `shared/` crate under workspace `Cargo.toml`. Move all four components into it. Both crates depend on `shared`.
**Time:** 45 min
**Verify:** Both `cargo check` pass. Lines deleted = ~150.

### 4.4 Add LRU eviction to `liveBackdropCache`

**File:** `launcher\src\components\CodexLauncher.tsx:99`
**Cost:** `Map<string, LiveBackdropFrame>` never prunes. Each frame holds 8-33MB base64 PNG. Unbounded memory growth.
**Fix:** Cap at 5 entries. Evict oldest on insert when at limit.
**Time:** 10 min
**Verify:** Cache size stays at 5 or below over multi-hour session.

---

## Phase 5 — Build & Bundle

### 5.1 Fix Vite target

**File:** `launcher\vite.config.ts:14`
**Cost:** `chrome110` target predates `color-mix()` and `container-type` that codebase uses. May generate unnecessary transforms.
**Fix:** Update to `"chrome120"`. Verify `tsc && vite build` still passes.
**Time:** 5 min
**Verify:** Build output doesn't include polyfills for `color-mix`/`container-type`.

### 5.2 Single settings store factory

**File:** `launcher\src\settings.ts:4-161`
**Cost:** Four identical pub/sub patterns (feedback, controller, performance, audio) = ~120 lines duplicated.
**Fix:** Create one `createStore<T>()` generic factory. Replace four copies.
**Time:** 15 min
**Verify:** `tsc` clean. All settings read/write/subscribe still work.

---

## Execution order

| # | Item | Phase | Time | Type |
|---|------|-------|------|------|
| 1 | Cache foreground_is_launcher | 1.1 | 10m | Gaming CPU |
| 2 | Throttle launcher HID when yielded | 1.2 | 10m | Gaming CPU |
| 3 | Pause running_tile_ids when hidden | 1.3 | 10m | Gaming CPU |
| 4 | Lazy-load keyart | 2.1 | 30m | Startup |
| 5 | Defer overlay prewarm | 2.2 | 15m | Startup |
| 6 | Extract inline CSS | 3.1 | 10m | Render |
| 7 | Pause CSS animations when hidden | 3.2 | 10m | VRAM |
| 8 | Stop ambient audio when hidden | 3.3 | 5m | Audio CPU |
| 9 | Cache config in memory | 4.1 | 20m | Steady-state |
| 10 | Cache process-list snapshot | 4.2 | 10m | Steady-state |
| 11 | LRU for backdrop cache | 4.4 | 10m | Memory |
| 12 | Fix Vite target | 5.1 | 5m | Build |
| 13 | Single settings store factory | 5.2 | 15m | Code size |
| 14 | Deduplicate Rust code | 4.3 | 45m | Code size |

**Total: ~3.5 hours.** Start with Phase 1 (30 min): biggest bang, no build changes, pure CPU drain fix.
