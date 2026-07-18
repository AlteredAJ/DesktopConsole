// Per-app hero art registry. Apps without an entry here fall back to the
// generic logo-watermark backdrop in Launcher.tsx Ã¢â‚¬â€ this is meant to be
// filled in incrementally, one app at a time, not all-or-nothing.

import { YouTubeHero } from "./YouTubeHero";
import { DiscordHero } from "./DiscordHero";
import { SteamHero } from "./SteamHero";
import { EpicHero } from "./EpicHero";
import { BattlenetHero } from "./BattlenetHero";
import { KeyArtHero } from "./KeyArtHero";
import { PosterHero } from "./PosterHero";
import { BrowserHero } from "./BrowserHero";
import { GameHero } from "./GameHero";
import { REAL_LOGOS, KEY_ART, KEY_ART_LOGO_LOCKUP, POSTER_ART } from "../../gameLogos";
import forzaLogo from "../../assets/logos/forza.svg";
import sifuLogo from "../../assets/logos/sifu.png";
import netflixLogo from "../../assets/logos/netflix_wordmark.svg";
import primeVideoLogo from "../../assets/logos/primevideo.svg";

// Small logo badge to fade in/out (games) or sit static (streaming apps)
// over each tile's key art. Hulu's real press screenshot already has the
// "hulu" wordmark baked into the image itself (bottom-right) Ã¢â‚¬â€ adding a
// second one would be a duplicate, so it's deliberately absent here. Spotify's
// mosaic is composited from real album art with no clean separate wordmark
// asset pulled, so it's art-only too.
const KEY_ART_LOGO: Record<string, string> = {
  "exe:E:\\Games\\Forza Horizon 6\\Content\\forzahorizon6.exe": forzaLogo,
  "exe:E:\\Xbox Games\\Forza Horizon 6\\Content\\forzahorizon6.exe": forzaLogo,
  "exe:E:\\Sifu\\Sifu.exe": sifuLogo,
  netflix: netflixLogo,
  "browser:https://www.primevideo.com": primeVideoLogo,
  ...KEY_ART_LOGO_LOCKUP,
};
// Forza/Sifu cycle between pure key art and the logo fading in (both have
// clean, small transparent marks well-suited to appearing/disappearing).
// Fortnite's lockup is a full title treatment (game name + season name), so
// it stays static like the reference banner Ã¢â‚¬â€ cycling it off and back on
// would read as flickering, not atmosphere.
const CYCLING_IDS = new Set([
  "exe:E:\\Games\\Forza Horizon 6\\Content\\forzahorizon6.exe",
  "exe:E:\\Xbox Games\\Forza Horizon 6\\Content\\forzahorizon6.exe",
  "exe:E:\\Sifu\\Sifu.exe",
]);
// Streaming hero pages use a centered-right logo placement (per reference:
// the app's own real marketing pages read this way) instead of Fortnite's
// left title-card layout.
const RIGHT_LOGO_IDS = new Set(["netflix", "browser:https://www.primevideo.com"]);

const HERO_ART: Record<string, () => JSX.Element> = {
  youtube: YouTubeHero,
  discord: DiscordHero,
  steam: SteamHero,
  epic: EpicHero,
  battlenet: BattlenetHero,
  // Disney+'s real logo has near-white/transparent art that needs a dark
  // plate to read (see PosterHero) Ã¢â‚¬â€ no equivalent official wide key art was
  // pulled for it (unlike Netflix/Prime/Hulu above).
  "browser:https://www.disneyplus.com": () => (
    <PosterHero src={REAL_LOGOS["browser:https://www.disneyplus.com"]} plate="#0a1247" sceneGlow="#1a3fd655" badge="chrome" />
  ),
};

export function heroArtFor(id: string): (() => JSX.Element) | undefined {
  if (id in HERO_ART) return HERO_ART[id];
  if (id in KEY_ART) {
    return () => (
      <KeyArtHero
        art={KEY_ART[id]}
        logo={KEY_ART_LOGO[id]}
        cycle={CYCLING_IDS.has(id)}
        logoPosition={RIGHT_LOGO_IDS.has(id) ? "right" : "left"}
      />
    );
  }
  if (id in POSTER_ART) return () => <PosterHero src={POSTER_ART[id]} plate="#f4f1ea" sceneGlow="#b8492c33" />;
  if (id in REAL_LOGOS) return () => <PosterHero src={REAL_LOGOS[id]} plate="#12151d" />;
  // Installed games use resolution-independent SVG/CSS art at any display resolution.
  if (id.startsWith("exe:")) return () => <GameHero id={id} />;
  // Any other browser: tile (the generic "Browser" bookmark, or a future
  // one) gets the plain Chrome treatment rather than no hero art at all.
  if (id.startsWith("browser:")) return BrowserHero;
  return undefined;
}
