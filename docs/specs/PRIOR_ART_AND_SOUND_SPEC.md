# Spec — Prior Art Survey & Sound Design

**Status:** research done, build not started · **Created:** 2026-07-19
**Source:** AJ — *"look around github for any other open source projects
targeting appletv or ps5"* and *"sound design to make it more immersive, maybe
also some ambient sounds/music like ps5."*

---

# Part 1 — Prior art on GitHub

## ⚠️ Read this before copying anything

Most of the closest projects are **GPL-licensed**. OpenGamepadUI is **GPLv3+**.
Copying its code into this repo would put PS5 Mode under GPL obligations. This
repo is private/local-only today, so nothing is being distributed — but if that
ever changes, GPL code lifted now becomes a real problem.

**Rule for this survey: study the ideas, don't paste the code.** Where something
is genuinely worth reusing, check its licence first and record it. Playnite
(MIT) is the permissive exception.

## The projects that matter

| Project | Licence | Why it's relevant |
|---|---|---|
| **[OpenGamepadUI](https://github.com/ShadowBlip/OpenGamepadUI)** | **GPLv3+** | The closest architectural cousin: gamepad-native launcher **with an in-game overlay**, per-game controller profiles, power/TDP control, plugin system. Built on Godot 4. Its overlay + input-remap model is the most directly comparable to our Quick Menu. Early-stage. Notably: **no sound design at all** — so no help for Part 2. |
| **[Playnite](https://playnite.net/)** ([src](https://github.com/JosefNemec/Playnite)) | **MIT** ✅ | The mature one. Unifies Steam/Epic/GOG/EA/Ubisoft/Battle.net/Xbox libraries, has a controller-friendly fullscreen mode, and a **theme ecosystem that already includes PS5-style dashboards**. Permissive licence. Most useful to us as (a) a reference for *library/metadata aggregation*, which our `game_scan.rs` does crudely, and (b) proof of what the PS5 look needs to land. |
| **[Flex Launcher](https://github.com/complexlogic/flex-launcher)** | check | A deliberate 10-foot HTPC front end aiming at "streaming box / game console" feel, Windows + Linux, gamepad or TV remote. Closest in *intent* to ours; simpler in scope. Good for comparing navigation and layout decisions. |
| **[DualSense-Windows](https://github.com/Ohjurot/DualSense-Windows)** | check | A Windows DualSense API. We already parse HID ourselves (`hid.rs`), but this is the reference to check our unverified bit assumptions against — exactly the kind of thing that would have settled `SHARE_BUTTON = 0x10` without guessing. **Highest practical value of the list.** |

## Apple TV / tvOS side

There's no open-source tvOS *shell* to study — Apple doesn't ship one and clones
don't exist. What does exist is the **focus/parallax interaction**, which is the
part we actually care about:

- **[PGSSoft/ParallaxView](https://github.com/PGSSoft/ParallaxView)** — tvOS
  parallax on focus, the canonical implementation.
- **[asynchrony/Re-Lax](https://github.com/asynchrony/Re-Lax)** — recreates tvOS
  parallax *at runtime* rather than from pre-baked layered images.
- **[DanielSinclair/react-atv-parallax](https://github.com/DanielSinclair/react-atv-parallax)**
  — the React port; closest to our stack.
- **[react-native-tvos](https://github.com/react-native-tvos/react-native-tvos)**
  — implements Apple's *recommended* focus animations, i.e. the official spec for
  how focus should feel.

**What we'd actually take:** we already have hero parallax on focus (`--px`), but
ours moves two flat background planes. tvOS parallax moves **layers within the
focused tile itself** and adds a subtle tilt toward the pointer/focus direction —
that's the bit that makes tvOS art feel physical. Worth prototyping on the dock
tiles. Read the *technique*, write our own.

## Honest assessment

Nothing here is worth adopting wholesale — our architecture (Tauri + WebView2 +
React, two processes, a real HID listener) is deliberately different from
Godot/native, and the licensing makes lifting code costly. The value is:
1. **DualSense-Windows** to verify our HID bit assumptions. Concrete, immediate.
2. **tvOS parallax technique** for in-tile depth.
3. **Playnite** as the reference for library aggregation if we ever want more
   than a folder scan.

---

# Part 2 — Sound design

## Current state: minimal

`sound.ts` is **54 lines**. Three sounds, all pure WebAudio oscillator synthesis,
no audio assets:
- `playNavTick()` — focus move
- `playSelect()` — confirm
- `playStartupChime()` — the G-major arpeggio on entering Home

`feedback.ts` (32 lines) pairs these with DualSense haptics and respects the
existing sound/haptics toggles. **There is no ambient layer and no music.**

## ⚠️ Do not use Sony's audio

PS5's actual UI sounds and ambient beds are copyrighted. We reference the *feel*,
not the files. Everything below is **original synthesis** — which is also why the
current approach is right: zero assets, instant load, nothing to license.

## Design direction

Three layers, in build order.

### Layer 1 — UI feedback (extend what exists)
The vocabulary is too thin: two sounds for every interaction. Add, all
synthesized and deliberately quiet:
- **back / cancel** — a downward counterpart to select (currently silent).
- **tab switch** — distinct from nav tick, pitched to the travel direction
  (up for R1, down for L1) so movement is audible.
- **toggle on/off** — two-state, for Settings switches.
- **error / unavailable** — a soft, non-punishing low blip (e.g. OpenRGB missing).
- **launch** — a short swell under the existing exit animation, so launching
  feels like a departure rather than a cut.

Rules: nothing above ~2kHz (harsh on a TV), everything under ~150ms except the
launch swell, and **every sound tied to a real state change** — the absence of a
sound is how you tell a no-op from an accepted input (same contract the haptics
already follow).

### Layer 2 — Ambient bed ⭐ the "PS5 feel"
A slow, evolving pad under the dashboard. **Generate it, don't ship a loop:**
- A loop betrays itself within minutes; generative never repeats.
- Zero asset weight, which matters now that art is ~70MB.
- It can *follow app state* — the ambient bed can drift toward the focused app's
  accent colour (bright/major for streaming, darker/sparser for games). That ties
  audio to the existing `--focus-bloom` accent system and is the thing that would
  actually feel bespoke.

Implementation sketch: 2–3 detuned oscillators through a lowpass filter with a
very slow LFO on cutoff and gain, plus a long convolver-free reverb approximation
(feedback delay). Target: **barely noticeable**, more felt than heard. It should
sit ~20dB under the UI sounds.

### Layer 3 — Idle screen
The idle screen is where music can be more present, since the user has walked
away. Slower, sparser, and it should **fade in over ~30s** rather than starting
abruptly when idle triggers.

## Non-negotiables
- **Settings toggles**, separately: UI sounds / ambient bed / idle music. Some
  people hate ambient audio; a single "sound on/off" is not enough. These belong
  in the **Audio** tab of the Settings hub.
- **Duck to silence when yielding focus.** When a game or app takes over, our
  ambient must stop — competing with game audio is the fastest way to make this
  feel broken. Hook the existing yield/restore path in `commands.rs`.
- **Never play over the Quick Menu in-game.** In-game overlay = UI ticks only, no bed.
- Respect the system volume already read by `audio.rs`; don't fight it.
- Start the AudioContext only on a real input gesture (already handled).

## Suggested order
1. Layer 1 (cheap, immediately makes the UI feel more responsive).
2. Settings toggles + the yield-ducking contract (do this *before* the bed, so
   the bed can never get stuck on).
3. Layer 2 ambient bed.
4. Layer 3 idle music.

## Open questions for AJ
1. How present should the ambient bed be — *barely there* (recommended) or
   clearly audible?
2. Should the bed react to the focused app's accent, or stay constant?
3. Ambient on by default, or opt-in?
