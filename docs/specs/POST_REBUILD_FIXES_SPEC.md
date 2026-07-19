# Spec — Post-Rebuild Fixes & System Refinement

**Status:** planned, not started · **Created:** 2026-07-19 · **Revised:** 2026-07-19
**Source:** AJ's on-device findings from the first full rebuild, plus his direction
to *"lean into refining our different systems and making sure they're
interconnected properly."*

Order of work: **A+B → D → E → C**, then the roadmap at the end.

---

## A+B. Input edge system — one shared, correct implementation

**Approved.** Both bugs are the same defect, and it has now appeared three times,
so the fix is a *system*, not three patches.

### The bug

`CodexLauncher.tsx:151`:
```js
useController((pad) => { …battery/charging…; if (!inputEnabled) return;
```
Returns **before updating any `prev*` refs** (`prevCross`, `prevSquare`,
`prevHat`, `prevStick`, `prevShoulders`). While input is disabled (entry
animation) those refs go stale as the user presses buttons. When `inputEnabled`
flips true, an *already-held* button reads as a fresh rising edge
(`pad.cross && !prevCross.current`) → `launch(activeTile)` → `setClosing(true)` →
the launcher hides. Exactly matches "first time" + "closes the launcher".

Same class, other sites:
- `confirmClose` (152), `powerConfirm` (153), `powerOpen` (154) each return early
  updating only `prevCross`/`prevCircle` — `prevSquare`/`prevHat`/`prevStick`/
  `prevShoulders` leak stale across every mode change.
- `QuickOverlay.tsx:53-55` seeds `previousHat = useRef(8)`,
  `previousCross/Circle = useRef(false)` — i.e. *assumes nothing is pressed* at
  mount. But it's summoned by a double-PS with a hand on the pad, so the first
  press is eaten establishing the baseline and the second one works. That is the
  "press Console Home twice" bug.

### The fix — a shared `useEdges` hook

Build one primitive that every controller consumer uses:

```
launcher/src/hooks/useEdges.ts   // NEW
  useEdges(): {
    sync(pad): void          // called every frame, unconditionally
    rising(btn): boolean     // true only on a genuine false->true transition
    hat(): number | null     // d-pad edge
    armed: boolean           // false until the first pad frame is observed
  }
```

Two invariants it must guarantee — these are the whole fix:
1. **Always sample.** `prev*` updates on *every* frame, before any early return
   or mode branch. "What was pressed last frame" is always truthful.
2. **Seed from reality, not from zero.** On the first observed frame, adopt the
   pad's actual state and fire nothing. A button already held when a component
   mounts is never mistaken for a new press.

Then migrate `CodexLauncher`, `QuickOverlay`, `VirtualKeyboard`,
`KeyboardOverlay`, `SettingsMenu`, `Search` onto it and delete their bespoke
`prev*` refs. That is the "interconnected properly" part — one input contract,
not six hand-rolled copies that each drift.

### Acceptance
- [ ] Mash Cross/Square while the launcher opens → nothing fires until a real
      press *after* input is enabled.
- [ ] One press of "Console Home" returns to the dashboard, every time.
- [ ] Entering/leaving Power and the close-confirm never fires a stray action.
- [ ] Still no double-consumption: exactly one consumer owns input at a time.

---

## D. Hero art order — shuffle bag (no frequent repeats)

**AJ:** *"can it be made random with a memory of what's not been cycled to not
cause frequent repeats?"*

**Yes, and it costs essentially nothing** — no optimization concern at all. The
standard answer is a **shuffle bag**: shuffle the set once, hand out images in
that order, and only reshuffle when the bag is empty. Memory is a single array of
indices (≤32 numbers per app); work is one O(n) shuffle per full cycle. That is
strictly cheaper than the timers already running.

It gives what pure random can't: **every image appears once before any repeats**,
so no clustering and no "why is it always that one".

**Shape:**
```
// module-level, per art set — survives remounts (that's also the D fix)
bag: Map<setKey, number[]>     // remaining shuffled indices
last: Map<setKey, number>      // guard the reshuffle seam
next(setKey): number           // pop; refill+reshuffle when empty
```
One detail: when the bag refills, if the first pick equals the previous image,
swap it with another slot — otherwise you can still see a back-to-back repeat
across the seam.

**Also fixes the original D complaint:** because the cursor now lives outside the
component, re-selecting an app advances to a *new* image instead of restarting at
image 0 (the current bug — `KeyArtHero`'s cursor is component-local and it
remounts on every focus change).

### Acceptance
- [ ] Focus an app, leave, come back → different art, not the same one.
- [ ] Across a full cycle every image appears exactly once before any repeats.
- [ ] No repeat across the reshuffle seam.

---

## E. Make hero art actually fill the screen (+ cull, + more motion blur)

**AJ:** *"a lot of the hero art throughout doesn't fill screen. I wanted full
screen arts to fill the screen on top of animation."*

### Root cause — found. The art is being dimmed/masked three times over.

1. **The wrapper erases the left third and dims everything:**
   ```css
   .codex-hero-art{ inset:-10%; opacity:.72;
     mask-image:linear-gradient(90deg, transparent 0%, #000 38%, #000 100%); }
   ```
   `opacity:.72` = 28% dimmed globally, and the mask fades the **left 38%** of the
   image to fully transparent. That alone is why it reads as "not filling".
2. **`KeyArtHero` then paints its *own* vignette on top** — the left variant is
   `rgba(6,7,10,0.92)` at the left edge → transparent only by 62%, plus a
   top-to-bottom darkening to 0.92. So the left side is darkened twice.
3. **The live backdrop isn't full-bleed either:** `.codex-live-backdrop{inset:5%}`
   insets it 5% on every side.

### Plan
- Drop the wrapper's `mask-image` and raise `opacity` toward 1.0; let **one**
  layer own the legibility scrim instead of three stacked ones.
- Rebalance `KeyArtHero`'s vignette so it only darkens as much as the bottom-left
  title text actually needs — a tighter, lower gradient rather than a half-screen
  wash.
- Set `.codex-live-backdrop` to `inset:0` so it's genuinely full-bleed (keep the
  `scale(1.035)` overscan for its transform).
- Keep `objectFit:cover` + the `inset:-10%` overscan (that overscan is what gives
  the parallax room to move — don't remove it).
- Re-check text contrast afterward; the title/tagline must still read cleanly.
  If it doesn't, the answer is a *tighter* scrim under the text, not re-dimming
  the whole image.

### Side-to-side motion blur — "didn't see much"
Correct, it's currently very subtle: the shelf travels **`2.6cqw`** (~67px at
2560 wide) with `blur(5px)` over 260ms. Plan: raise travel and blur (roughly
`5–7cqw` / `10–14px`), and lengthen slightly so the streak is perceptible. This
is the "blur intensity" open question from `HOME_MOTION_SPEC.md` — now answered
by AJ: **more.** Tune on the panel, keep it compositor-only and time-boxed.

Also still unbuilt from that spec: **focus-traversal blur** (blur proportional to
how fast you flick across tiles) — given AJ wants more side-to-side motion, this
is now worth building, not deferring.

### Cull — measured, ready to execute
14 files, ~3.9 MB, all height < 1440:

| Set | File(s) | Size |
|---|---|---|
| netflix | `bo-chen-arcane-jinx-final-2k.jpg` | 2000×1180 |
| netflix | `thibaut-granet-08.jpg` | 1920×811 |
| disney | `jackson-sze-lokis2-jsze-09.webp` | 1800×702 |
| epic | `muhammx-marri-x5anjzh0rehf1.jpg` | 1920×1080 |
| epic | `vitaliy-naymushin-*` (10 files) | 1920×1080 (one 1919×1079) |

**⚠️ Still needs AJ's call:** the 10 `vitaliy-naymushin-*` files are the *official
Fortnite chapter/season key art* — the only logo-bearing, on-brand images in the
Epic pool. Culling them leaves Epic as environment concept art only. Note they're
16:9, so they'd *fill* a 1440p screen fine; they'd just be upscaled from 1080p.
No code change needed either way — the sets are globbed.

---

## C. "Block logo" on reopen — still needs a repro detail

Plan accepted; **blocked on one answer from AJ:** *which* tile shows the block,
and is it the small tile icon or the big hero backdrop? (A photo settles it.)

Leading hypotheses, unchanged:
1. `icons.tsx`'s final fallback is a literally blank tile
   (`<div style={wrap("var(--tile)")} />`) — anything matching no rule renders as
   an empty square. Transient behaviour argues against a pure mapping miss.
2. Window shown before first meaningful paint, so fallbacks flash (fits the
   theme-change case: `subscribeTheme` remounts icons).
3. `useExtractedIcon`'s async `extract_tile_icon` gap for `exe:` tiles.

**Fix direction regardless of cause:** never render an empty square — give the
fallback a deliberate branded placeholder, and hold the window hidden until first
meaningful paint. That turns a "broken" flash into an intentional one.

---

## Roadmap — what else is worth planning

Reviewed against `PROJECT_STATUS.md`'s open threads. Ranked by value:

**High — finish what's half-built**
1. **Verify `SHARE_BUTTON = 0x10`.** The keyboard's summon gesture is an
   *assumed* bit, never hardware-confirmed. If the double-tap doesn't work, this
   is why. Cheap to verify, blocks the whole keyboard feature.
2. **Give the keyboard a real consumer.** `onDone` currently discards its text —
   the overlay works but does nothing. Obvious first use: **launch-by-search**
   (already "designed but not built") or the Wi-Fi password field.
3. **Fortnite hero pool.** Fortnite is still a single static image while
   Netflix/Disney+/Epic rotate. Give it its own pool (kept separate from Epic,
   per AJ).

**Medium — consistency across the library**
4. **Hero art for the remaining 8 games** (Control, VALORANT, Rocket League, Alto,
   F1 23, Assetto Corsa, BeamNG, Marvel Rivals) — `ART_SHOPPING_LIST.md`. Right
   now the library is visually lopsided: streaming looks great, games don't.
5. **Feed the new art pools into the idle slideshow.** `IDLE_ART` is still the old
   hand-listed set; it should draw from the same pools so idle and home agree.
6. **Per-game accent colors.** Still a hash fallback, so tile glow/bloom colors are
   arbitrary rather than matching the art.

**Lower — infrastructure**
7. **Dev perf HUD.** Every motion change so far has been accepted on "looks fine"
   — a frame-time overlay would let us actually verify "no dropped frames" claims
   (and would have caught the residual-filter layer issue objectively).
8. **Panel open/close motion** (Home ↔ Settings) — the last unbuilt item in
   `HOME_MOTION_SPEC.md`.
9. **Consolidate Search's inline keyboard** into the shared overlay core — AJ
   deferred this ("later down the line"), but it's the same duplication pattern
   the `useEdges` work is fixing for input.
10. **8K Disney downscale.** Two files are 7680px; invisible past ~2560px at
    1440p. Needs an image tool installed. Pure size win, zero visible loss.

**Standing**
- Backend TODOs (`get_controller_state` snapshot, HID `buf[0]` offset),
  `native-overlay-poc` graduation gate, `unreal-scaffold` role decision.

---

## Constraints

- Work only in `ps5-mode-codex-rebuild`; never edit the original `…\ps5-mode`.
- Never route controller events to two consumers at once.
- Compositor-only steady state; blur time-boxed to transitions.
- Verify with `tsc && vite build`; rebuild via `.\rebuild.ps1`.
