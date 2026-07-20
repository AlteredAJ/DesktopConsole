// Art credits, derived rather than hand-maintained.
//
// The hero art is real ArtStation work by named artists, and the filenames
// preserve who made each piece (e.g. "envar-studio-the-theatre.jpg"). Deriving
// the credits from the files means a newly dropped-in image credits its artist
// automatically and the list can't silently go stale — the same reason the art
// sets themselves are built with import.meta.glob rather than a manual array.

/** Files whose names are the artist's slug + the piece, one folder per brand. */
const ART = import.meta.glob("./assets/logos/keyart/*/*.{jpg,jpeg,png,webp}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/**
 * Slugs the generic "first-last" split gets wrong. These are real people being
 * credited, so a mangled name is worse than the effort of listing them:
 * "envar-studio" would become "Envar", a three-part surname would be truncated,
 * and title-casing can't know about an internal capital.
 *
 * Longest prefix wins, so order here doesn't matter.
 */
const NAME_OVERRIDES: Record<string, string> = {
  "envar-studio": "Envar Studio",
  "pablo-gonzalez-bellozas": "Pablo Gonzalez Bellozas",
  "neil-mcknight": "Neil McKnight",
};

function titleCase(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Best-effort artist name from a filename. These are "first-last-piece-name"
 * with no delimiter between the artist and the work, so this takes the first
 * two segments (or a known studio prefix) and accepts that it will occasionally
 * be imperfect — a slightly odd credit is better than no credit, and the full
 * filename stays in the repo either way.
 */
function artistFrom(path: string): string | null {
  const file = path.split("/").pop();
  if (!file) return null;
  const stem = file.replace(/\.[^.]+$/, "");
  // Longest matching override first, so "pablo-gonzalez-bellozas" beats any
  // shorter prefix that might later be added.
  const override = Object.keys(NAME_OVERRIDES)
    .filter((slug) => stem.startsWith(slug))
    .sort((a, b) => b.length - a.length)[0];
  if (override) return NAME_OVERRIDES[override];
  const parts = stem.split("-");
  if (parts.length < 2) return null;
  // Skip files that are brand assets rather than artist work (e.g. "netflix-4k").
  if (/^\d/.test(parts[1]) || parts[1].length <= 1) return null;
  return titleCase(parts.slice(0, 2).join("-"));
}

/** Unique artist names, alphabetical. */
export const ART_CREDITS: string[] = Array.from(
  new Set(Object.keys(ART).map(artistFrom).filter((name): name is string => !!name)),
).sort((a, b) => a.localeCompare(b));

export interface ThirdParty { name: string; what: string; license: string; }

/** Third-party components worth naming in About > Licenses. */
export const THIRD_PARTY: ThirdParty[] = [
  { name: "Manrope", what: "UI typeface", license: "SIL Open Font License 1.1" },
  { name: "Tauri", what: "app shell (Rust + WebView2)", license: "MIT / Apache-2.0" },
  { name: "React", what: "UI runtime", license: "MIT" },
  { name: "hidapi", what: "DualSense HID access", license: "MIT / BSD-3" },
  { name: "OpenRGB", what: "lighting control (launched, not bundled)", license: "GPLv2" },
];
