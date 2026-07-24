// APP IDENTITY REGISTRY — the single source of truth for how an app *looks*.
//
// Before this file, adding one tile meant editing up to nine id-keyed registries
// spread across three files (KEY_ART, KEY_ART_SET, KEY_ART_LOGO,
// KEY_ART_LOGO_LOCKUP, POSTER_ART, REAL_LOGOS, TAGLINE, CYCLING_IDS,
// RIGHT_LOGO_IDS) plus logoSurfaceFor() and the ServiceIcon prefix chain. Adding
// the `lnk:` tiles needed edits in four of them — and missing one failed
// SILENTLY as a blank square tile with no hero art.
//
// Now: one entry per app. Everything visual about it lives together.
//
// MATCHING IS BY PREDICATE, NOT BY EXACT ID. Tile ids are machine-specific
// absolute paths ("exe:E:\...", "lnk:C:\Users\Altered\..."), so keying art to
// them meant moving a game silently broke its art, and the same app needed a
// duplicate row per install path / per launch scheme (Forza had two, Fortnite
// two, Hulu and Disney+ two each). Matching on a stable fragment collapses those
// duplicates and survives a path change.
//
// Config ids and localStorage `recents` keys are deliberately UNCHANGED — this
// derives its key *from* whatever id the config already uses.

import deathStranding2 from "./assets/logos/deathstranding2.svg";
import fortnite from "./assets/logos/fortnite.png";
import forza from "./assets/logos/forza.svg";
import sifu from "./assets/logos/sifu.png";
import legoBatman from "./assets/logos/legobatman.png";
import primeVideo from "./assets/logos/primevideo.svg";
import disneyPlus from "./assets/logos/disneyplus.png";
import hulu from "./assets/logos/hulu.svg";
import fmhy from "./assets/logos/fmhy.svg";
import fortniteLockup from "./assets/logos/fortnite_logo.png";
import netflixLockup from "./assets/logos/netflix_wordmark.svg";

import forzaKeyArt from "./assets/logos/keyart/forza-4k.jpg";
import sifuKeyArt from "./assets/logos/keyart/sifu-4k.jpg";
import legoBatmanKeyArt from "./assets/logos/keyart/legobatman-4k.jpg";
import deathStranding2Poster from "./assets/logos/keyart/deathstranding2-4k.jpg";
import fortniteKeyArt from "./assets/logos/keyart/fortnite-4k.jpg";
import netflixKeyArt from "./assets/logos/keyart/netflix-4k.jpg";
import primeVideoKeyArt from "./assets/logos/keyart/primevideo-4k.jpg";
import huluKeyArt from "./assets/logos/keyart/hulu-4k.jpg";
import spotifyKeyArt from "./assets/logos/keyart/spotify-4k.jpg";

// Rotating art sets. Globbed, so dropping files into a folder extends the
// rotation with no code change. Sorted for a stable, deterministic order.
// Lazy (eager: false) — images are loaded on first tile focus, not at module
// eval, so the full 76MB art library doesn't block startup.

type LazyArt = () => Promise<string>;

let _resolveCache: Map<string, string[]> | null = null;
function resolveSetCache(): Map<string, string[]> {
  if (!_resolveCache) _resolveCache = new Map();
  return _resolveCache;
}

/** Return sorted lazy importers from a lazy glob. The glob result is tiny (just
 *  key → () => Promise<string>), so module eval is near-instant. */
function lazyArtSet(glob: Record<string, () => Promise<string>>): LazyArt[] {
  return Object.keys(glob).sort().map((k) => glob[k]);
}

/** Resolve a lazy set to concrete URLs, caching the result. Call once per set
 *  per session (the first time a tile using it gains focus). Runs the full set
 *  of parallel fetches so rotation never waits for an image it hasn't seen. */
export async function resolveArtSet(key: string, lazy: LazyArt[]): Promise<string[]> {
  const cache = resolveSetCache();
  const hit = cache.get(key);
  if (hit) return hit;
  const urls = await Promise.all(lazy.map((fn) => fn()));
  cache.set(key, urls);
  return urls;
}

const netflixLazy = lazyArtSet(import.meta.glob("./assets/logos/keyart/netflix/*.{jpg,jpeg,png,webp}", { import: "default" }) as Record<string, () => Promise<string>>);
const disneyLazy = lazyArtSet(import.meta.glob("./assets/logos/keyart/disney/*.{jpg,jpeg,png,webp}", { import: "default" }) as Record<string, () => Promise<string>>);
const epicLazy = lazyArtSet(import.meta.glob("./assets/logos/keyart/epic/*.{jpg,jpeg,png,webp}", { import: "default" }) as Record<string, () => Promise<string>>);
const valorantLazy = lazyArtSet(import.meta.glob("./assets/logos/keyart/valorant/*.{jpg,jpeg,png,webp}", { import: "default" }) as Record<string, () => Promise<string>>);
const rivalsLazy = lazyArtSet(import.meta.glob("./assets/logos/keyart/rivals/*.{jpg,jpeg,png,webp}", { import: "default" }) as Record<string, () => Promise<string>>);

export interface AppIdentity {
  /** Stable, machine-independent key. Also the diagnostics label. */
  key: string;
  /** Curated brand logo (wins over Windows icon extraction). */
  logo?: string;
  /** Single wide hero image. */
  art?: string;
  /** Rotating hero set (resolved URLs) — supersedes `art` when present.
   *  Populated asynchronously; undefined until the first tile using this set
   *  gains focus. */
  artSet?: string[];
  /** Lazy importers for the rotating set. Resolved on first focus via
   *  resolveArtSet(), stored in artSet for all subsequent renders. */
  artSetLazy?: LazyArt[];
  /** Full title-treatment lockup drawn over the hero. */
  lockup?: string;
  /** Poster-shaped art (bounded PosterHero, not full-bleed). */
  poster?: string;
  /** Tile background behind the logo. */
  surface?: string;
  /** Hero logo placement: streaming apps read centre-right, games left. */
  logoPosition?: "left" | "right";
  /** Slowly fade the hero logo in/out (small transparent marks only). */
  cycleLogo?: boolean;
  /** Games feed the idle slideshow; media/app art deliberately does not. */
  isGame?: boolean;
}

interface Entry extends AppIdentity {
  /** Stable fragment(s) of a tile id that identify this app. */
  match: string[];
}

const has = (id: string, frag: string) => id.toLowerCase().includes(frag.toLowerCase());

// Fortnite and Epic deliberately SHARE the epic pool: AJ sourced only Fortnite
// art for it ("fortnite and epic are kinda shared bc I only picked fortnite
// stuff"). Split them again if Epic ever ships non-Fortnite art.
const ENTRIES: Entry[] = [
  // ---- games ----
  { key: "forza", match: ["forzahorizon6.exe"], logo: forza, art: forzaKeyArt, surface: "#08272e", cycleLogo: true, isGame: true },
  { key: "sifu", match: ["sifu.exe"], logo: sifu, art: sifuKeyArt, cycleLogo: true, isGame: true },
  { key: "legobatman", match: ["legobatmanlotdk.exe"], logo: legoBatman, art: legoBatmanKeyArt, isGame: true },
  { key: "deathstranding2", match: ["ds2.exe"], logo: deathStranding2, poster: deathStranding2Poster, isGame: true },
  { key: "valorant", match: ["valorant.exe"], artSetLazy: valorantLazy, surface: "#1a2733", isGame: true },
  // Rivals is a single 1080p keyart for now (all sourced art was sub-1440 —
  // see the note in ART_SHOPPING_LIST.md); swap to an artSet once 1440p+
  // atmospheric pieces exist. Rendered via artSet so adding files just works.
  { key: "rivals", match: ["marvelrivals"], artSetLazy: rivalsLazy, surface: "#241528", isGame: true },
  { key: "fortnite", match: ["fortniteclient-win64-shipping.exe"], logo: fortnite, art: fortniteKeyArt, artSetLazy: epicLazy, lockup: fortniteLockup, surface: "#172a67", isGame: true },
  { key: "epic", match: ["epic"], artSetLazy: epicLazy, isGame: true },
  // ---- media / apps ----
  { key: "netflix", match: ["netflix"], art: netflixKeyArt, artSetLazy: netflixLazy, lockup: netflixLockup, logoPosition: "right" },
  { key: "disneyplus", match: ["disneyplus.com", "disney+.lnk"], logo: disneyPlus, artSetLazy: disneyLazy, lockup: disneyPlus, surface: "#07184a", logoPosition: "right" },
  { key: "hulu", match: ["hulu.com", "hulu.lnk"], logo: hulu, art: huluKeyArt, surface: "#0b2918" },
  { key: "primevideo", match: ["primevideo.com"], logo: primeVideo, art: primeVideoKeyArt, lockup: primeVideo, surface: "#071a32", logoPosition: "right" },
  { key: "fmhy", match: ["fmhy"], logo: fmhy, surface: "#0a0b12" },
  { key: "spotify", match: ["spotify"], art: spotifyKeyArt },
];

const cache = new Map<string, AppIdentity | null>();

/** The visual identity for a tile id, or null if nothing matches. */
export function identityFor(id: string): AppIdentity | null {
  const hit = cache.get(id);
  if (hit !== undefined) return hit;
  const entry = ENTRIES.find((e) => e.match.some((frag) => has(id, frag))) ?? null;
  const identity = entry ? ({ ...entry, match: undefined } as AppIdentity) : null;
  cache.set(id, identity);
  return identity;
}

/**
 * Ids that matched no entry. The blank-square canary: anything listed here
 * renders with the generic fallback rather than its real art. Surfaced by the
 * planned Settings > Diagnostics page.
 */
export function unmatchedFrom(ids: string[]): string[] {
  return ids.filter((id) => !identityFor(id));
}

/**
 * Hero art for the idle slideshow — GAME art only. AJ: "only game ones not
 * media/app ones." Derived from the registry so it stays correct as art is
 * added, instead of being a second hand-maintained list.
 * Statically imported art only (lazy rotating sets need tile focus to resolve
 * and aren't suitable for the idle background).
 */
export const IDLE_ART: string[] = ENTRIES.filter((e) => e.isGame).flatMap((e) => (e.art ? [e.art] : []));
