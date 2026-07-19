# Spec — Home "Alive When Switching" Motion Pass

**Status:** planned · **Owner:** next session · **Created:** 2026-07-19
**One-liner:** Make switching between things on Home (tabs, tiles, hero art,
panels) feel like *motion* — smooth, weighted transitions with a tasteful
**motion-blur** streak — instead of hard content swaps.

---

## Why / intent (AJ, 2026-07-19)

> "making the home screen more alive when switching between things … motion with
> motion blur could be nice. smth smooth yk."

The couch-feel goal: when you flip tabs or move across tiles, the UI should
carry momentum and blur slightly in the direction of travel, then settle — the
way the PS5 dashboard slides rather than cuts. Keep it smooth and subtle, not
flashy.

## Current state — what each transition does today

Source: `launcher/src/components/CodexLauncher.tsx` (+ its inline `CSS`).

| Transition | Today | Feel gap |
|---|---|---|
| **Tab switch** (`setTab`, line 107; `setTabIndex`) | `tiles` **hard-swaps**; `useEffect` resets focus to 0 (line 85). Only the copy block (`codex-fade .24s`) and hero art (`codex-fade .5s`) fade. The dock's tiles pop in with no slide. | This is the big one — the shelf content changes with no directional motion. |
| **Tile focus move** | Spring dock scroll (`hooks/useSpringScroll.ts`) recenters; focused tile scales `.28s` (`.codex-tile-icon`). | Already smooth; could gain a faint directional blur on fast traversal. |
| **Hero art on focus** | `.codex-hero-art` opacity `.27s` + `codex-fade .5s`; live backdrop crossfade `.32s`. | Fine; leave unless it clashes. |
| **Parallax** | `--px` drives `.codex-backdrop` (±2.4cqw) + `.atmos` (±1.1cqw), eased `.55s/.6s`. | Working; the new motion should feel of-a-piece with this. |
| **Panel open/close** (Home ↔ Settings/Search/Power) | `closing`/`app-exit` class on launch; panels mount via `App.tsx` `panel` state. | Check whether open/close has a real transition; add one if it cuts. |

## Goal

1. **Tab switch = a slide, not a swap.** Outgoing shelf/copy slides out in the
   travel direction (L1 = left, R1 = right) while the incoming one slides in,
   with a brief directional motion-blur that resolves as it settles.
2. **Optional: focus-traversal blur.** On fast tile-to-tile movement, a subtle
   directional blur proportional to velocity (reuse the momentum velocity
   already tracked — `dragVel`/`MOMENTUM_MS`, line 25/131).
3. Everything stays **smooth and critically-damped** (apple-design springs:
   damping ~1.0, response 0.3–0.4) — momentum with a soft stop, no bounce.

## Motion-blur technique — pick a compositor-safe path

**Hard rule (apple-design / PERFORMANCE_AND_NATIVE_PLAN.md):** never re-run a
blur *filter* every frame. That kills the WebView2 compositor. So:

- **Preferred — "ghost trail" (pure transform/opacity).** Render 2–3 offset,
  fading copies of the moving layer along the motion vector. It reads as motion
  blur but is 100% compositor (no filter recompute). Best for the tab-shelf
  slide and tile traversal. Cost ≈ a few extra painted layers, briefly.
- **Acceptable — short baked directional blur.** An SVG `feGaussianBlur` with
  x-axis-only `stdDeviation` (or a CSS `filter: blur()`) applied to a
  `will-change`-promoted layer **only during** the ~200–300ms transition, then
  removed on settle. Must be time-boxed and off a static layer — not animated
  continuously. Isotropic `blur()` is the cheap fallback if directional SVG is
  fussy.
- **Avoid:** animating `backdrop-filter`, blurring the glass dock every frame,
  or leaving `will-change`/filters on after the transition ends.

## Suggested approach / skeleton

- **Drive it off a direction + a phase.** On `setTab`, stash the travel
  direction (`next > tabIndex ? 1 : -1`) and set a transient `switching` state;
  clear it on transition end. Feed direction to CSS as e.g. `--dir`.
- **Two-layer slide.** Keep the outgoing shelf mounted briefly (or snapshot it)
  so old slides out while new slides in. Simplest React shape: key the shelf
  container by `tabId` and use a small enter/exit transition (CSS classes or a
  tiny state machine — no new animation lib needed; the codebase hand-rolls).
- **New keyframes in the component's inline `CSS`** (sibling to `codex-fade`):
  `codex-shelf-in` / `codex-shelf-out` (translateX along `--dir` + opacity), and
  if using ghost-trail, a `.codex-motion-ghost` helper.
- **Reuse existing velocity** for focus-traversal blur intensity so it's
  proportional to how fast the user is flicking, not a fixed amount.
- **Timing:** ~220–300ms for the tab slide; keep it snappy for a 10-foot UI.

## Acceptance criteria

- [ ] Switching tabs slides content directionally (matches L1/R1 direction) with
      a brief motion-blur streak that resolves cleanly — no residual blur.
- [ ] No dropped frames on the 1440p panel during a fast tab mash (eyeball; if a
      perf HUD lands, verify there).
- [ ] Blur/filters are removed after each transition (no lingering `will-change`
      or `filter` on idle layers).
- [ ] Motion reads as critically-damped (settles, no visible bounce/overshoot).
- [ ] `prefers-reduced-motion`: fall back to a plain, quick opacity fade — **no**
      slide, **no** blur. (Home already flattens parallax under this query.)
- [ ] Coexists with parallax + spring dock without fighting them.
- [ ] `tsc && vite build` clean.

## Constraints (project ground rules — do not violate)

- Work only in `ps5-mode-codex-rebuild`; never edit the original `…\ps5-mode`.
- Preserve the Codex glass visual system + input contract (`CLAUDE_FINAL_HANDOFF.md`).
- Compositor-only steady state; blur is time-boxed to transitions only.
- Don't regress the existing parallax (`--px`) or spring dock feel.

## Open questions (resolve with AJ)

1. **Scope:** tabs only, or tabs **and** tile-traversal blur? (Recommend: land
   the tab slide first, add traversal blur second if it still feels wanted.)
2. **Blur intensity:** subtle (a hint) vs. pronounced (clearly streaky)? Needs a
   look on the panel — ship a first pass then tune, like the momentum values.
3. Should panel open/close (Home ↔ Settings) get the same treatment, or stay as-is?

## Pointers

- Build/run: `.\rebuild.ps1 -NoListener` (frontend-only is enough here).
- Existing motion to match: parallax + `useSpringScroll.ts` + `Atmosphere.tsx`.
- Perf rules: `PERFORMANCE_AND_NATIVE_PLAN.md`. Design contract: `CLAUDE_FINAL_HANDOFF.md`.
- Git history: `git log --oneline -- launcher/src/components/CodexLauncher.tsx`.
