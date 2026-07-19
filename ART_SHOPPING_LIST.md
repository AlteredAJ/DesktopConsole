# 4K Hero-Art Shopping List

Audit of every live tile (`%APPDATA%\ps5-mode\config.json`) against its hero-art
routing in `launcher/src/components/heroArt/index.tsx`. Target display is **1440p**
(native 2560×1440), so **2560×1440 minimum, 3840×2160 ideal** (future-proof + the
existing `-4k.jpg` assets are already that tier). Full-bleed **16:9**, JPG q≈80.

## ✅ Already 4K — no action
Netflix · Spotify · Prime Video · Hulu · Fortnite · Forza Horizon 6
(wired to `keyart/*-4k.jpg` in `gameLogos.ts`)

## ✅ Vector brand heroes — no action (resolution-independent by design)
YouTube · Discord · Steam · Epic Games · Battle.net

## ❌ NEEDS ART — games falling back to the generic procedural `GameHero` (SVG)

Best source is the game's **official key art / wallpaper**, not AI-generated
(accuracy matters for real games). For the Steam titles, **SteamGridDB → "Heroes"**
is the fastest source of high-res 16:9-croppable art + transparent logos.

| Game | Tile id (exact — escape `\` as `\\` in TS) | Source |
|---|---|---|
| Control | `exe:E:\Control\Control.exe` | SteamGridDB (Steam 870780) |
| VALORANT | `exe:E:\Riot Games\VALORANT\live\VALORANT.exe` | Riot press kit / playvalorant.com |
| Rocket League | `exe:E:\rocketleague\Binaries\Win64\RocketLeague.exe` | Epic press / official wallpaper |
| The Alto Collection | `exe:E:\TheAltoCollection\The Alto Collection.exe` | SteamGridDB (Steam 1094930) |
| F1 23 | `exe:E:\SteamLibrary\steamapps\common\F1 23\F1_23.exe` | SteamGridDB (Steam 2108330) |
| Assetto Corsa | `exe:E:\SteamLibrary\steamapps\common\assettocorsa\AssettoCorsa.exe` | SteamGridDB (Steam 244210) |
| BeamNG.drive | `exe:E:\SteamLibrary\steamapps\common\BeamNG.drive\BeamNG.drive.exe` | SteamGridDB (Steam 284160) |
| Marvel Rivals | `exe:E:\SteamLibrary\steamapps\common\MarvelRivals\MarvelRivals_Launcher.exe` | SteamGridDB (Steam 2767030) |

## ⚠️ NEEDS ART — streaming odd-one-out
| Tile | id | Note |
|---|---|---|
| Disney+ | `browser:https://www.disneyplus.com` | Only a logo-on-plate today (its Netflix/Hulu/Prime siblings all have real 4K heroes). Wants an official Disney+ promo hero (16:9, ≥2560×1440). |

## ➖ Acceptable / low priority
- **Browser** (`browser:https://www.google.com`) — generic Chrome hero, fine.
- **Riot Client** (launcher) — procedural `GameHero`, fine; optional Riot art.

## How to wire one in (per game, ~3 lines)
1. Drop `control-4k.jpg` in `launcher/src/assets/logos/keyart/`.
2. In `gameLogos.ts`: `import controlKeyArt from "./assets/logos/keyart/control-4k.jpg";`
   then add to `KEY_ART`: `"exe:E:\\Control\\Control.exe": controlKeyArt,`
3. (Optional) transparent logo PNG → `KEY_ART_LOGO_LOCKUP` for a title-card lockup;
   an authentic bloom color → an `accentFor` entry (else it hash-picks one).

`KeyArtHero` defaults (left-aligned title-card, no cycle) suit all of these.

## Housekeeping notes (optional)
- **Dead low-res dupes:** `keyart/` also holds non-`-4k` `.jpg`s (`netflix.jpg`,
  `fortnite.jpg`, `forza.jpg`, `sifu.jpg`, `legobatman.jpg`, `hulu.jpg`,
  `primevideo.jpg`, `spotify.jpg`, `deathstranding2.jpg`) — none are imported
  (`gameLogos.ts` uses only `-4k`). ~1.5 MB of removable dead weight.
- **Dormant art:** Sifu, LEGO Batman, and Death Stranding 2 have 4K art bundled
  but **no tile in the live config** (not installed / removed). Art is ready if
  those games return.
