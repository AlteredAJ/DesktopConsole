# Spec — Swipe-to-Select Keyboard Overlay

**Status:** built, pending hardware test · **Owner:** next session · **Created:** 2026-07-19 · **Built:** 2026-07-19
**One-liner:** A summonable, controller-first keyboard **overlay** whose input
model is **touchpad swipe-to-select** (drag the cursor across the key grid),
modeled on the Search tab's keyboard. **No glide/"swipe-to-type", no predictive
text** — those are explicitly out of scope for now.

---

## Why / intent (AJ, 2026-07-19)

> "keyboard is a good idea. we can skip swipe/predictive type for now and work
> on swipe to select like in the search tab."

So: build the keyboard as a reusable overlay, but keep the interaction simple —
the same swipe-to-select the Search keyboard already uses. Do **not** build
gesture/glide typing (tracing a path through letters) or word prediction.

## Current state (read this before touching anything)

The swipe-to-select mechanic **already exists** — this task is about
consolidating it and presenting it as an overlay, not inventing input.

| Piece | Where | Notes |
|---|---|---|
| Touchpad hook | `launcher/src/hooks/useTouchpad.ts` | Reports **absolute** drag distance since finger-down: `{ dx, dy, active }`. Caller maps distance → target. |
| Overlay-scope keyboard | `launcher/src/components/VirtualKeyboard.tsx` | Full keyboard (lower/upper/symbols + Shift/Space/Delete/Done). **Line 41 already implements swipe-select**: `dragStart` anchors row/col on finger-down, then `KEYBOARD_SWIPE_ROW_DISTANCE (340)` / `KEYBOARD_SWIPE_COLUMN_DISTANCE (420)` ÷ `keyboardSwipeSensitivity` map travel → cell. Also D-pad + left-stick nav; Cross/touchpad-click commits; Square deletes. Renders inside `CodexPanelShell`. |
| Search's own keyboard | `launcher/src/components/Search.tsx` (kbd grid + `useTouchpad` at line 122) | A **separate** inline letter-grid keyboard. Its header comment (lines 4–6) explicitly says it's D-pad-select "not swipe-trace — that's VirtualKeyboard.tsx's separate Unit B scope" so Search didn't have to wait on the overlay. |
| Sensitivity setting | `launcher/src/settings.ts` → `getControllerSettings().keyboardSwipeSensitivity` | Already wired; reuse it. |

**Takeaway:** two keyboards, both already swipe-capable. The real work is
(1) turn `VirtualKeyboard` into a globally-summonable overlay, and
(2) decide whether Search's inline keyboard folds into it or stays.

## Goal (scoped)

1. A **keyboard overlay** component that can be summoned over any surface
   (primarily Home), not just inside a panel — mounts above content, dims the
   backdrop, returns typed text via a callback, dismisses on Done/Circle.
2. Input model = **swipe-to-select** (reuse `VirtualKeyboard`'s line-41 logic) +
   the existing D-pad/stick nav and Cross-to-commit. Nothing new to learn.
3. One keyboard implementation, ideally — collapse the Search duplicate into the
   overlay if it's low-risk, otherwise leave Search alone and just note it.

## Non-goals (do NOT build)

- ❌ Glide / swipe-to-**type** (drawing a continuous path through letters).
- ❌ Predictive text / autocomplete / suggestions row.
- ❌ Any cloud/dictionary dependency.

## Suggested approach / skeleton

```
launcher/src/components/
  KeyboardOverlay.tsx      // NEW: portal/fixed overlay wrapper
                           //   props: { open, title?, secret?, initial?,
                           //            onDone(text), onCancel() }
                           //   renders <VirtualKeyboard/> (refactored to not
                           //   assume it's inside CodexPanelShell) on a dimmed
                           //   scrim; z-index above Home, below Power confirm.
```

- **Refactor `VirtualKeyboard`** so its keyboard core (grid + swipe-select +
  nav + commit) is usable *outside* `CodexPanelShell`. Cleanest: extract the
  grid+logic into a `useKeyboard()` hook or a presentational `<KeyGrid/>`, then
  both the Search panel and the overlay render it. If that's too much, keep
  `VirtualKeyboard` as-is and have `KeyboardOverlay` wrap it, swapping the shell.
- **Summon trigger:** decide the gesture (e.g. a Home button, or a controller
  combo). Wire it in `CodexLauncher.tsx` state (`keyboardOpen`) and route input
  to the overlay while open — **respect the ground rule: never route controller
  events to two consumers at once** (Home nav must be suppressed while the
  keyboard owns input, same pattern as the Power panel does today).
- **Reuse** `keyboardSwipeSensitivity`, `selectFeedback()`, `ButtonHints`.

## Acceptance criteria

- [x] Keyboard can be summoned over Home and returns typed text to the caller.
      (Summon = double-press Share/Create, see Open questions §1 resolution below.
      No consumer wired yet — `onDone` currently just closes, text is discarded.)
- [x] Touchpad swipe moves the selection across keys (anchored on finger-down),
      matching Search's feel; sensitivity honors the existing setting.
      (Unchanged — reused verbatim from `VirtualKeyboard`'s existing line-41 logic.)
- [x] D-pad + left-stick still navigate; Cross / touchpad-click commit; Square
      deletes; Circle/Done dismiss. (Circle was previously only handled by
      `App.tsx`'s global panel-back effect, which the overlay isn't part of —
      added a local `onCancel` prop + Circle handler to `VirtualKeyboard` for this.)
- [x] While the keyboard is open, Home navigation receives no input (no
      double-consumption). (Both `CodexLauncher`'s `useController` and
      `useTouchpad` early-return while `keyboardOpen`, same pattern as the
      Power panel.)
- [x] `prefers-reduced-motion`: overlay appears without large motion.
      (Opacity-only fade, disabled entirely under the media query.)
- [x] `tsc && vite build` clean; no new remote/network deps.
- [ ] **Not yet controller-tested on hardware** — see PROJECT_STATUS.md's note
      on the unverified `SHARE_BUTTON` bit assumption.

## Constraints (project ground rules — do not violate)

- Work only in `ps5-mode-codex-rebuild`; never edit the original `…\ps5-mode`.
- Preserve the Codex glass visual system + input contract (`CLAUDE_FINAL_HANDOFF.md`).
- Compositor-only animation (transform/opacity); no per-frame re-blur.
- Never route controller events to two consumers simultaneously.

## Open questions — resolved with AJ 2026-07-19

1. **Summon gesture** — double press of Share/Create ("as it's unbinded I think").
   Implemented in `CodexLauncher.tsx` as `SHARE_BUTTON = 0x10` on the shoulders
   byte — **this bit is assumed, not hardware-confirmed**; verify on first test.
2. **Consolidate or not** — leave Search's inline keyboard untouched for now.
   AJ: "later down the line I'll look into organizing" — flagged in
   PROJECT_STATUS.md as a future-session possibility, not started.
3. **First use case beyond Home** — none yet ("Just Home for now"). The overlay
   is fully wired and functional but `onDone` has nowhere to send text today;
   deciding the first real consumer (Wi-Fi password? rename?) is future work.

## Pointers

- Build/run: `.\rebuild.ps1` (or `-NoListener` for frontend-only).
- Design contract: `CLAUDE_FINAL_HANDOFF.md`. Status/rules: `PROJECT_STATUS.md`.
- Git history for the keyboard: `git log --oneline -- launcher/src/components/VirtualKeyboard.tsx`.
