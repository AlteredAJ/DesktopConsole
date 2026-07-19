// Compatibility views over the app identity registry.
//
// These used to be six hand-maintained, id-keyed Records — the ones that had to
// be edited in lockstep every time a tile was added, where missing one failed
// silently as a blank tile. They are now thin lookups into appRegistry.ts, which
// holds one entry per app and matches on a stable id fragment rather than a
// machine-specific absolute path.
//
// TO ADD OR CHANGE AN APP'S ART/LOGO: edit `ENTRIES` in appRegistry.ts. Nothing
// here needs touching.
//
// Real, official assets — downloaded from the publishers'/Wikimedia's own files
// (see src/assets/logos/), not hand-drawn approximations or low-res .exe icon
// extraction. Personal, non-distributed use, so accuracy over "safe" abstraction.

import { identityFor } from "./appRegistry";

export { IDLE_ART } from "./appRegistry";

/** Curated brand logo for a tile, if one exists. */
export function realLogoFor(id: string): string | undefined {
  return identityFor(id)?.logo;
}

/** Single wide hero image (see keyArtSetFor for rotating sets). */
export function keyArtFor(id: string): string | undefined {
  return identityFor(id)?.art;
}

/** Rotating hero set; supersedes keyArtFor when present. */
export function keyArtSetFor(id: string): string[] | undefined {
  const set = identityFor(id)?.artSet;
  return set && set.length ? set : undefined;
}

/** Full title-treatment lockup drawn over the hero art. */
export function lockupFor(id: string): string | undefined {
  return identityFor(id)?.lockup;
}

/** Poster-shaped art — bounded PosterHero treatment, not full-bleed. */
export function posterArtFor(id: string): string | undefined {
  return identityFor(id)?.poster;
}

/** Tile background behind the logo. */
export function logoSurfaceFor(id: string): string {
  return identityFor(id)?.surface ?? "var(--tile)";
}

/** Streaming apps read centre-right; games use a left title card. */
export function logoPositionFor(id: string): "left" | "right" {
  return identityFor(id)?.logoPosition ?? "left";
}

/** Whether the hero logo should slowly fade in/out. */
export function cycleLogoFor(id: string): boolean {
  return !!identityFor(id)?.cycleLogo;
}
