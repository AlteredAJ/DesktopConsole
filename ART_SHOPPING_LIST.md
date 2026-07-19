# Hero Art — Shopping List

What still needs art, and the rules for what counts as usable. Updated 2026-07-19.

---

## Sourcing rules (apply to everything below)

AJ sources these from **ArtStation**. For a piece to be usable as a hero backdrop:

| Rule | Why |
|---|---|
| **Height ≥ 1440px** | AJ's rule — the panel is 1440p; anything shorter upscales and looks soft. Sub-1440 files get culled. |
| **Wide** — 16:9 or wider (ratio ≥ 1.7) | It's a full-bleed backdrop. Portrait/square art can't fill the screen. |
| **Atmospheric over character close-up** | UI text and tiles sit on top. Environments/cityscapes read well behind a dashboard; a face centred in frame fights it. |
| **Busy-free left and bottom** | The title, tagline and dock sit bottom-left. Art with its subject on the right composes best. |
| **Keep the original file** | No re-compression — they're already lossy. Drop them in as downloaded. |

**How to add:** drop files into `launcher/src/assets/logos/keyart/<set>/`. The sets
are **globbed**, so a new file joins the rotation automatically — no code change.
Keep the artist-name filenames; they preserve attribution.

---

## Done ✅

| Set | Count | Notes |
|---|---|---|
| `netflix/` | 10 | Arcane (Jinx, Piltover, Hextech) |
| `disney/` | 12 | Disney / Marvel / Star Wars environments |
| `epic/` | 32 | Fortnite key art + environments |
| Forza Horizon 6, Sifu, LEGO Batman, Death Stranding 2 | 1 each | Existing single Steam hero assets |

Also art-only by design (no action): YouTube · Discord · Steam · Epic · Battle.net
(vector brand heroes) and Spotify / Prime Video / Hulu.

**Fortnite ↔ Epic:** AJ — *"fortnite and epic are kinda shared bc I only picked
fortnite stuff."* The earlier "keep strictly separate" rule is **dropped**:
Fortnite and Epic share the `epic/` pool. If Epic ever ships non-Fortnite art,
split them again then.

---

## Still needed — games 🎯

These are in the live config with **no hero art** (they fall back to the generic
procedural `GameHero` SVG). Listed for AJ to source.

| # | Game | Suggested ArtStation search |
|---|---|---|
| 1 | **Marvel Rivals** | *Marvel Rivals key art / hero splash / map concept* |
| 2 | **Control** | *Control Remedy, Oldest House, brutalist interior concept* |
| 3 | **VALORANT** | *VALORANT map concept / splash — Riot environment art* |
| 4 | **BeamNG.drive** | *BeamNG environment / open-road landscape* |
| 5 | **Rocket League** | *Rocket League arena / stadium concept* |
| 6 | **F1 23** | *F1 circuit / motorsport key art* |
| 7 | **Assetto Corsa** | *racing sim environment, track concept* |
| 8 | **The Alto Collection** | *Alto's Odyssey / Adventure — minimal dune landscapes* (stylised, will look great) |

Listed in priority order — most-used first, and roughly easiest-to-find first.

**3–6 pieces each is plenty.** That's enough for the rotation to feel alive
without bloating the build. (Epic's 32 is more than needed — fine, just not the
target to match.)

**Alternative source:** for official key art rather than fan/concept work,
**SteamGridDB → "Heroes"** has high-res 16:9 art plus transparent logo lockups.

---

## Idle slideshow — games only

AJ: *"we can do that w the idle slideshow but only game ones not media/app ones."*

The idle screen must draw from **game pools only**. Today `IDLE_ART` is a
hand-listed set that wrongly includes **Netflix, Prime Video and Hulu** — those
come out. Fortnite/Epic counts as a game and stays.

Rework `IDLE_ART` to derive from the game sets automatically (same glob approach)
so it stays correct as art is added, instead of being a second list to maintain.

---

## Housekeeping

- **Cull sub-1440p:** 14 files (~3.9 MB) measured below 1440 tall — exact list in
  `docs/specs/POST_REBUILD_FIXES_SPEC.md` §E. Includes 10 official Fortnite
  chapter key arts at 1920×1080 (**pending AJ's confirm** — they're the only
  logo-bearing images in the Epic pool).
- **Two Disney files are 7680px (8K)** — invisible past ~2560px at 1440p.
  Downscaling to 4K is a free size win but needs an image tool installed.
- **Hero art doesn't currently fill the screen** — that's a rendering bug (triple
  dimming/masking), not an art problem. See `POST_REBUILD_FIXES_SPEC.md` §E.
