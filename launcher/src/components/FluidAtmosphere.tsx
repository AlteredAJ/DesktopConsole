// GPU-composited fluid-simulation background via Fluid by KrackedDevs.
// Renders client-side on the viewer's GPU, zero server cost, no key needed.
// Free for any site, personal or commercial.

import { useState } from "react";

export type FluidPreset = "midnight" | "ember" | "void" | "off";

const PRESETS: Record<FluidPreset, string> = {
  midnight:
    "https://fluid.krackeddevs.com/api/piece?field=flow&palette=ocean&speed=0.3&zoom=2.2&warp=2.5&grain=0.03&finish=glass&seed=42&aspect=16:9",
  ember:
    "https://fluid.krackeddevs.com/api/piece?field=flow&palette=ember&speed=0.25&zoom=2&warp=2&grain=0.03&finish=glass&seed=7&aspect=16:9",
  void:
    "https://fluid.krackeddevs.com/api/piece?field=smoke&palette=ocean&speed=0.15&zoom=2.8&warp=1.2&grain=0.02&seed=13&aspect=16:9&finish=glass",
  off: "",
};

export function FluidAtmosphere({ preset = "midnight" }: { preset?: FluidPreset }) {
  const [loaded, setLoaded] = useState(false);
  const src = PRESETS[preset];
  if (!src) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        overflow: "hidden",
        pointerEvents: "none",
        opacity: loaded ? 0.38 : 0,
        transition: "opacity 1.2s ease-in-out",
      }}
      aria-hidden="true"
    >
      <iframe
        src={src}
        title="Fluid background"
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
        loading="lazy"
        onLoad={() => setLoaded(true)}
      />
      {/* Scrim over the fluid — keeps text legible without dimming the simulation */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(4,6,11,.55) 0%, rgba(5,7,12,.25) 50%, rgba(4,6,11,.65) 100%)",
        }}
      />
    </div>
  );
}

export const FLUID_PRESET_NAMES: Record<FluidPreset, string> = {
  midnight: "Midnight",
  ember: "Ember",
  void: "Void",
  off: "Off (CSS)",
};
