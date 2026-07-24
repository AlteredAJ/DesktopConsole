// Per-app hero art registry. Apps without an entry fall back to the generic
// procedural backdrop — this is meant to be filled in incrementally, one app at
// a time, not all-or-nothing.
//
// All the per-app data (art, sets, lockups, logo placement, cycling) now comes
// from appRegistry.ts via the accessors in gameLogos.ts. The three id-keyed maps
// that used to live here — KEY_ART_LOGO, CYCLING_IDS, RIGHT_LOGO_IDS — are gone.

import { YouTubeHero } from "./YouTubeHero";
import { DiscordHero } from "./DiscordHero";
import { SteamHero } from "./SteamHero";
import { BattlenetHero } from "./BattlenetHero";
import { KeyArtHero } from "./KeyArtHero";
import { PosterHero } from "./PosterHero";
import { BrowserHero } from "./BrowserHero";
import { GameHero } from "./GameHero";
import { identityFor } from "../../appRegistry";

const HERO_ART: Record<string, () => JSX.Element> = {
  youtube: YouTubeHero,
  discord: DiscordHero,
  steam: SteamHero,
  battlenet: BattlenetHero,
};

export function heroArtFor(id: string): (() => JSX.Element) | undefined {
  const app = identityFor(id);

  // Rotating set wins, then a single wide hero. Both render through KeyArtHero.
  // Lazy sets trigger async resolution; the component shows static art as a
  // fallback until the set is ready.
  if (app && (app.artSetLazy?.length || app.artSet?.length || app.art)) {
    return () => (
      <KeyArtHero
        arts={app.artSet}
        lazyArts={app.artSetLazy}
        art={app.art}
        appKey={app.key}
        logo={app.lockup}
        cycle={!!app.cycleLogo}
        logoPosition={app.logoPosition ?? "left"}
      />
    );
  }
  // Brand-vector heroes for launchers/services with no photographic art.
  if (id in HERO_ART) return HERO_ART[id];
  // Poster-shaped official art (e.g. Death Stranding 2) gets a bounded plate.
  if (app?.poster) return () => <PosterHero src={app.poster as string} plate="#f4f1ea" sceneGlow="#b8492c33" />;
  // A curated logo with no art at all still beats a bare backdrop.
  if (app?.logo) return () => <PosterHero src={app.logo as string} plate="#12151d" />;
  // Installed games use resolution-independent SVG/CSS art at any resolution.
  if (id.startsWith("exe:")) return () => <GameHero id={id} />;
  // Any other browser:/lnk: tile gets the plain Chrome treatment rather than
  // no hero art at all.
  if (id.startsWith("browser:") || id.startsWith("lnk:")) return BrowserHero;
  return undefined;
}
