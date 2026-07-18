// Full-bleed REAL key art (Steam library hero assets, or in Fortnite's case
// Epic's own official CDN — same images their own sites use) with the logo
// lockup placed like a real game's hero banner: left-aligned over a
// left-to-right vignette, art bleeding out to the right mostly undimmed.
// `cycle` optionally fades the logo in/out on a slow loop so the screen
// alternates between pure atmosphere and branded — off by default (a static
// logo, like the reference banner, doesn't need it).

import { useEffect, useState } from "react";

export function KeyArtHero({
  art,
  logo,
  logoWidth = "26%",
  cycle = false,
  logoPosition = "left",
}: {
  art: string;
  logo?: string;
  logoWidth?: string;
  cycle?: boolean;
  /** "left" (Fortnite-style title card) or "right" (streaming-app style —
   * logo centered in the right-hand two-thirds, over the content it's
   * fronting, not competing with the grid's own bottom-left title text). */
  logoPosition?: "left" | "right";
}) {
  const [showLogo, setShowLogo] = useState(true);
  useEffect(() => {
    if (!logo || !cycle) return;
    const id = setInterval(() => setShowLogo((s) => !s), 7000);
    return () => clearInterval(id);
  }, [logo, cycle]);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <img
        src={art}
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
      {/* Vignette for the logo/title to sit on, plus the usual bottom floor
          for the grid's own title/tagline text below it. Direction flips
          with logoPosition so the dark side is always under the logo. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            logoPosition === "left"
              ? "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(6,7,10,0.35) 55%, rgba(6,7,10,0.92) 100%), linear-gradient(90deg, rgba(6,7,10,0.92) 0%, rgba(6,7,10,0.55) 32%, transparent 62%)"
              : "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(6,7,10,0.35) 55%, rgba(6,7,10,0.92) 100%), radial-gradient(ellipse 60% 55% at 68% 42%, rgba(6,7,10,0.75), transparent 70%)",
        }}
      />
      {logo && (
        <img
          src={logo}
          alt=""
          style={
            logoPosition === "left"
              ? {
                  position: "absolute",
                  left: "5%",
                  top: "50%",
                  transform: "translateY(-60%)",
                  width: logoWidth,
                  opacity: showLogo ? 1 : 0,
                  transition: "opacity 900ms ease",
                  filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.6))",
                }
              : {
                  position: "absolute",
                  left: "60%",
                  top: "46%",
                  transform: "translate(-50%, -50%)",
                  width: logoWidth,
                  opacity: showLogo ? 1 : 0,
                  transition: "opacity 900ms ease",
                  filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.6))",
                }
          }
        />
      )}
    </div>
  );
}
