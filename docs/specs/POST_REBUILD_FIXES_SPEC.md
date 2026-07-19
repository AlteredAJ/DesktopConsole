# Spec — Post-Rebuild Fixes (input edges, load flash, art rotation, sub-1440p cull)

**Status:** planned, not started · **Created:** 2026-07-19
**Source:** AJ's on-device findings from the first full rebuild.

Five items. **A and B share one root cause** and should be fixed together.

---

## A. First command after opening closes the launcher

> "Some cmds like close app for the first time close the launcher."

**Root cause — found, high confidence.** `CodexLauncher.tsx:151`:

```js
useController((pad) => { …battery/charging…; if (!inputEnabled) return;
```

The handler returns on `!inputEnabled` **before updating any `prev*` refs**
(`prevCross`, `prevSquare`, `prevHat`, `prevStick`, `prevShoulders`). During the
entry animation input is disabled, so those refs stay stale at their initial
values while the user is actually pressing buttons. The moment `inputEnabled`
flips true, a button that is *already held* reads as a fresh rising edge
(`pad.cross && !prevCross.current`) and immediately fires `launch(activeTile)` →
`setClosing(true)` → the launcher hides. That exactly matches "first time" (it
can only happen during the entry window) and "closes the launcher".

**Same defect class, other sites:** the modal branches return early too —
`confirmClose` (line 152), `powerConfirm` (153), `powerOpen` (154) each update
only `prevCross`/`prevCircle`, leaving `prevSquare`, `prevHat`, `prevStick`,
`prevShoulders` stale. So edges leak across every mode change, not just entry.

**Fix:** always sample the pad into the `prev*` refs, on *every* frame, before
any early return. Cleanest: hoist a single `syncPrev(pad)` call to the top of the
handler (and to the top of each early-return branch), so "what was pressed last
frame" is always truthful regardless of which mode owns input. Edge tests then
stay correct across enable/disable and mode switches.

**Acceptance:** open the launcher while mashing Cross/Square — no action fires
until a genuine press *after* input is enabled. Entering/leaving Power and the
close-confirm never fires a stray action from a held button.

---

## B. Quick Menu needs "Console Home" twice

> "the quick menu has to click return to console home twice"

**Root cause — same family.** `QuickOverlay.tsx:53-55` initialises
`previousHat = useRef(8)`, `previousCross = useRef(false)`,
`previousCircle = useRef(false)` — i.e. it *assumes nothing is pressed* at mount.
The overlay is summoned by a double-PS while the user's hand is on the pad, so a
button already down at mount is misread: the first press is consumed
establishing the baseline instead of acting, and the second one works.

**Fix:** initialise the edge baseline from the *first observed pad frame* rather
than from a hardcoded "nothing pressed" default. Practical shape: an `armed` ref
that is false until the first frame arrives; on that frame, seed all `prev*` from
the actual pad and take no action. Same treatment for any component that mounts
mid-input (`VirtualKeyboard`, `KeyboardOverlay`, `SettingsMenu`, `Search`).

**Worth doing once, properly:** this is now the third instance of the same bug.
Consider a small shared helper (e.g. `useEdges(pad)`) that owns baseline seeding
and exposes `rising("cross")`, so no future component re-implements it wrong.

**Acceptance:** one press of "Console Home" returns to the dashboard, every time,
including immediately after the overlay appears.

---

## C. "Block logo" on reopen until it loads / 3 presses

> "when reopened I see that block logo and I have to wait for it to load in or
> press 3 times… also happened when I changed the color theme once."

**Not yet diagnosed — needs one detail from AJ before coding.** Candidate causes,
in order of suspicion:

1. **ServiceIcon's final fallback is a literally blank block.**
   `icons.tsx` ends with `return <div style={wrap("var(--tile)")} />` — an empty
   tile. Any id matching *nothing* renders as a blank square. The new `lnk:` ids
   are the newest ids in the system; if a `REAL_LOGOS` lookup misses (path
   mismatch, escaping), they fall straight through to this blank block.
   *But:* a mapping miss would be permanent, and AJ's is transient — so this is
   more likely a **render-order** issue than a mapping one.
2. **Render before assets/config resolve.** The window is shown on restore before
   React has painted real icons, so fallbacks flash. The theme-change case fits:
   `subscribeTheme` bumps `themeRevision`, remounting icons and briefly
   re-showing fallbacks.
3. **`useExtractedIcon` async gap** — `exe:` tiles invoke `extract_tile_icon` and
   render a fallback until it resolves; the in-memory cache is per-session, so a
   fresh window pays it again.

**Next step:** AJ to confirm *which* tile shows the block (or send a photo), and
whether it's the tile icon or the hero backdrop. Then: hold the window hidden
until first meaningful paint, and/or give the fallback a branded placeholder
instead of an empty square so a slow load never reads as "broken".

**Acceptance:** reopening never shows an empty block; worst case shows a
deliberate placeholder that resolves without extra button presses.

---

## D. Hero art should advance on re-selection

> "the hero arts should rotate on reselection as well"

**Cause:** `KeyArtHero` is remounted per focused tile, and its rotation cursor
(`cursor = useRef(0)`) is component-local — so every time you focus an app it
restarts at image 0. Only sitting on a tile for 9s+ advances it.

**Fix:** persist the cursor **per art set**, outside the component — a
module-level `Map<string, number>` in `KeyArtHero.tsx` (or `gameLogos.ts`) keyed
by app id. On mount: read the stored index, **advance it by one**, show that
image, write it back. Re-selecting an app then shows the next piece, and the slow
in-place rotation keeps working while focused.

**Acceptance:** focus Netflix → art A; move away and back → art B, not A. Order
stays stable and deterministic.

---

## E. Cull everything below 1440p

> "anything below 1440p needs to go"

Measured every file (JPEG SOF + WebP headers). **14 files, ~3.9 MB**, all with
height < 1440:

| Set | File | Size |
|---|---|---|
| netflix | `bo-chen-arcane-jinx-final-2k.jpg` | 2000×1180 |
| netflix | `thibaut-granet-08.jpg` | 1920×811 |
| disney | `jackson-sze-lokis2-jsze-09.webp` | 1800×702 |
| epic | `muhammx-marri-x5anjzh0rehf1.jpg` | 1920×1080 |
| epic | `vitaliy-naymushin-*` (10 files) | 1920×1080 (one 1919×1079) |

**⚠️ Flag before deleting:** the 10 `vitaliy-naymushin-*` files are the
*official Fortnite chapter/season key art* — the most on-brand, logo-bearing
images in the Epic pool. Culling them leaves Epic as environment concept art
only. AJ should confirm; the rule is unambiguous but the outcome may not be
intended.

**Fix:** delete the files, `git rm`, rebuild. No code change needed — the sets are
globbed, so the rotation adjusts automatically.

**Acceptance:** every remaining image is ≥1440 tall; build clean; ~3.9 MB smaller.

---

## Suggested order

1. **A + B together** (one shared edge-baseline fix + optional `useEdges` helper)
   — these are correctness bugs that make the console feel broken.
2. **D** (small, self-contained, visible win).
3. **E** (delete + rebuild, pending AJ's call on the Fortnite key art).
4. **C** last — needs AJ's repro detail first.

## Constraints

- Work only in `ps5-mode-codex-rebuild`; never edit the original `…\ps5-mode`.
- Never route controller events to two consumers at once.
- Verify with `tsc && vite build`; rebuild via `.\rebuild.ps1`.
