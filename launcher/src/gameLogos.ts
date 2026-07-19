// Real, official logo assets â€” downloaded from the actual publishers'/
// Wikimedia's own files (see src/assets/logos/), not hand-drawn
// approximations or low-res Windows .exe icon extraction. Personal,
// non-distributed use, so accuracy over "safe" abstraction is fine here.
// Keyed by EXACT tile id (config.rs's seeded defaults) since exe: paths are
// per-install and there's no other stable key to match on.

import deathStranding2 from "./assets/logos/deathstranding2.svg";
import fortnite from "./assets/logos/fortnite.png";
import forza from "./assets/logos/forza.svg";
import sifu from "./assets/logos/sifu.png";
import legoBatman from "./assets/logos/legobatman.png";
import primeVideo from "./assets/logos/primevideo.svg";
import disneyPlus from "./assets/logos/disneyplus.png";
import hulu from "./assets/logos/hulu.svg";

// Real official Steam library-hero key art (same assets Steam's own Big
// Picture mode shows) â€” see heroArt/index.tsx for how these pair with the
// logos above.
import forzaKeyArt from "./assets/logos/keyart/forza-4k.jpg";
import sifuKeyArt from "./assets/logos/keyart/sifu-4k.jpg";
import legoBatmanKeyArt from "./assets/logos/keyart/legobatman-4k.jpg";
import deathStranding2Poster from "./assets/logos/keyart/deathstranding2-4k.jpg";
// Fortnite: Epic's own official CDN (fortnite.com) â€” a season's promo
// gameplay art + the transparent logo lockup, same pairing as the reference
// banner. Not pinned to a specific season/chapter (that rotates constantly),
// just whatever was live when this was pulled.
import fortniteKeyArt from "./assets/logos/keyart/fortnite-4k.jpg";
import fortniteLockup from "./assets/logos/fortnite_logo.png";
// Streaming apps: real official marketing/product imagery, not stock-photo
// wallpapers â€” Netflix's own homepage poster-wall hero, Hulu's own press-kit
// "Living Room Hero" TV UI screenshot, a cropped (nav-bar removed) real Prime
// Video show page, and a mosaic of real Spotify album-cover art (Spotify's
// own marketing pages don't expose a hotlinkable hero the way the others do,
// so this is composited locally from real i.scdn.co cover art instead).
import netflixKeyArt from "./assets/logos/keyart/netflix-4k.jpg";
import primeVideoKeyArt from "./assets/logos/keyart/primevideo-4k.jpg";
import huluKeyArt from "./assets/logos/keyart/hulu-4k.jpg";
import spotifyKeyArt from "./assets/logos/keyart/spotify-4k.jpg";

export const KEY_ART: Record<string, string> = {
  "exe:E:\\Games\\Forza Horizon 6\\Content\\forzahorizon6.exe": forzaKeyArt,
  "exe:E:\\Xbox Games\\Forza Horizon 6\\Content\\forzahorizon6.exe": forzaKeyArt,
  "exe:E:\\Sifu\\Sifu.exe": sifuKeyArt,
  "exe:E:\\Games\\LEGO Batman Legacy of the Dark Knight\\LEGOBatmanLotDK.exe": legoBatmanKeyArt,
  "exe:E:\\Games\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe": fortniteKeyArt,
  "exe:E:\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe": fortniteKeyArt,
  netflix: netflixKeyArt,
  spotify: spotifyKeyArt,
  "browser:https://www.primevideo.com": primeVideoKeyArt,
  "browser:https://www.hulu.com": huluKeyArt,
};
// Wide, atmospheric hero rasters used for the ambient idle-screen slideshow
// (PS5-style rotating art behind the wordmark). Ordered for visual variety;
// the poster-shaped Death Stranding art is intentionally excluded (it's not a
// full-bleed hero).
export const IDLE_ART: string[] = [
  forzaKeyArt,
  fortniteKeyArt,
  sifuKeyArt,
  netflixKeyArt,
  legoBatmanKeyArt,
  primeVideoKeyArt,
  huluKeyArt,
];

export const KEY_ART_LOGO_LOCKUP: Record<string, string> = {
  "exe:E:\\Games\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe": fortniteLockup,
  "exe:E:\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe": fortniteLockup,
};
// Death Stranding 2's official asset is a compact poster (not a wide hero
// banner), so it gets the bounded PosterHero treatment instead of full-bleed
// â€” see heroArt/index.tsx.
export const POSTER_ART: Record<string, string> = {
  "exe:E:\\Games\\Death Stranding 2 On the Beach\\DS2.exe": deathStranding2Poster,
};

export const REAL_LOGOS: Record<string, string> = {
  "exe:E:\\Games\\Death Stranding 2 On the Beach\\DS2.exe": deathStranding2,
  "exe:E:\\Games\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe": fortnite,
  "exe:E:\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe": fortnite,
  "exe:E:\\Games\\Forza Horizon 6\\Content\\forzahorizon6.exe": forza,
  "exe:E:\\Xbox Games\\Forza Horizon 6\\Content\\forzahorizon6.exe": forza,
  "exe:E:\\Sifu\\Sifu.exe": sifu,
  "exe:E:\\Games\\LEGO Batman Legacy of the Dark Knight\\LEGOBatmanLotDK.exe": legoBatman,
  "browser:https://www.primevideo.com": primeVideo,
  "browser:https://www.disneyplus.com": disneyPlus,
  "browser:https://www.hulu.com": hulu,
};

export function realLogoFor(id: string): string | undefined {
  return REAL_LOGOS[id];
}
