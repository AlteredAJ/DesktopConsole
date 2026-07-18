// A bounded "poster card" treatment — for assets that either (a) have their
// own baked-in background tone that doesn't reliably blend into an arbitrary
// scene color (fighting a losing color-match battle), or (b) are low-res
// enough that stretching them full-bleed would look soft/blurry. Framing it
// as an intentional card sidesteps both problems instead of trying to force
// a seamless blend that keeps looking tacky.

import { ChromeBadge } from "./shared";

export function PosterHero({
  src,
  plate = "#12151d",
  sceneGlow,
  badge,
}: {
  src: string;
  plate?: string;
  sceneGlow?: string;
  badge?: "chrome";
}) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#0a0a0a" }}>
      {sceneGlow && (
        <div
          style={{
            position: "absolute",
            inset: "-20%",
            background: `radial-gradient(ellipse 60% 55% at 65% 40%, ${sceneGlow}, transparent 70%)`,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          right: "8%",
          top: "50%",
          transform: "translateY(-50%)",
          maxWidth: "50%",
          borderRadius: "1rem",
          overflow: "hidden",
          boxShadow: "0 24px 60px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)",
          background: plate,
        }}
      >
        <img src={src} alt="" style={{ display: "block", width: "100%", height: "auto" }} />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(90deg, rgba(6,7,10,0.85) 0%, transparent 55%), linear-gradient(180deg, transparent 60%, rgba(6,7,10,0.85) 100%)",
        }}
      />
      {badge === "chrome" && (
        <svg viewBox="0 0 1600 900" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <ChromeBadge />
        </svg>
      )}
    </div>
  );
}
