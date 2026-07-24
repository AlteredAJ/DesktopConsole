# Known Issues & Incomplete Work

Generated 2026-07-23. Work through top-to-bottom. Cross off as fixed.

---

## ⚠️ Needs on-device test (rebuild + controller + game running)

| # | Item | What to test | Commits |
|---|------|-------------|---------|
| 1 | **restore_focus crash** | Minimize via Power → Quick Menu → Console Home. Does dashboard return? | `17da881` `fd6c602` |
| 2 | **Quick Menu dormant** | On dashboard, is Quick Menu ever processing input in background? (No RGB cycling accidentally.) | `c33bd4a` |
| 3 | **Keyboard exit guard** | Open keyboard on dashboard, press Options / PS+Options. Does launcher survive? | `c33bd4a` |
| 4 | **Cross-leak on restore** | Minimize → Quick Menu → Console Home. Does it return to dashboard or launch a tile? | `8113801` |
| 5 | **Phase 1 gaming drain** | Game running, launcher minimized. Check Task Manager — `ps5-listener.exe` ~0.1%, `ps5-launcher.exe` near-zero. | `ebfc60e` |
| 6 | **Phase 2 startup** | Cold launch — faster first paint? (76MB lazy vs old eager bundle.) | `55db312` |
| 7 | **Game detail panel** | Cross on game tile → rich panel opens. Navigate actions. Circle dismisses. | `b8da7c0` |

---

## 🔧 Source code work remaining

| # | Item | Location | Notes |
|---|------|----------|-------|
| 8 | **A1 redesign** | `CodexLauncher.tsx` | ~~Mockup only~~ Done — top-dock layout, nav bar, game detail slide-up, combined header. `55da3d2` `4bb9d50` |
| 9 | **Settings rework** | `SettingsMenu.tsx` | ~~Old pill tabs~~ Done — A1 sidebar (280px, icons, accent highlight) + card content area. `16f11d7` |
| 10 | **Power menu rework** | `CodexLauncher.tsx` | ~~Center overlay~~ Done — right-edge slide panel with icon tiles. `55da3d2` |
| 11 | **Quick Menu visual refresh** | `QuickOverlay.tsx` | Done — LM branding in header. `55da3d2` |
| 12 | **Keyboard overlay restyle** | `KeyboardOverlay.tsx` | Already matched A1 visual. No change needed. |
| 13 | **Startup/idle screen** | `IdleScreen.tsx` | Done — LM wordmark + DualSense SVG icon. `55da3d2` |

---

## 📋 Optimization phases (from OPTIMIZATION_PLAN.md)

| # | Phase | Items |
|---|-------|-------|
| 14 | Phase 3 — Render | Extract inline CSS from CodexLauncher.tsx, pause CSS animations/audio when window hidden |
| 15 | Phase 4 — Steady-state | Config cache (OnceLock), process-list cache, Rust dedup (shared crate), LRU backdrop cache |
| 16 | Phase 5 — Build | Vite target chrome110→chrome120, single settings store factory (createStore<T>) |

---

## 🎨 Art & Assets

| # | Item | Notes |
|---|------|-------|
| 17 | Per-game 4K hero art | Remaining games from ART_SHOPPING_LIST.md still need art. Valorant and Rivals have single entries. |
| 18 | Tile icon extraction | Works via `icon_extract.rs` but needs EXE-specific cache warm-on-start. |

---

## 🚀 Specced, not built

| # | Item | Doc |
|---|------|-----|
| 19 | Live App Backdrop | `LIVE_APP_BACKDROP_SPEC.md` — capture running app window, show behind glass |
| 20 | HOME_MOTION_SPEC | `HOME_MOTION_SPEC.md` — motion blur on tab switch |
| 21 | Touchpad 1:1 drag | PROJECT_STATUS.md line 135 — Option B, needs live controller test |
| 22 | Per-game accent colors | Replace hash-color fallback with curated palette per game |
| 23 | Per-zone RGB control | Currently all-device only. Pick from Settings > Lighting. |

---

## 🐛 Known cosmetic bugs

| # | Item |
|---|------|
| 24 | Two harmless Rust warnings: unused `tauri::Manager` import in `listener/lib.rs`, dead `toggle_minimize` in `commands.rs` |
| 25 | `VirtualKeyboard` is both statically imported (KeyboardOverlay) and dynamically imported (App.tsx) — Vite warns, chunk not split |
| 26 | `KeyboardOverlay` same issue — statically imported by OverlayRoot, dynamically by CodexLauncher |
