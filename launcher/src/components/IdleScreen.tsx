// Shared PS5 Mode idle/start visual. The sparse wordmark, cool-black field,
// and small constellation are the established design language for this state.

import { useEffect, useRef, useState } from "react";
import { IDLE_ART } from "../gameLogos";

const PARTICLE_COUNT = 64;

// How long each hero holds before the slow crossfade to the next one.
const SLIDE_MS = 9000;
const FADE_MS = 1600;

// Ambient PS5-style idle slideshow: real hero key-art drifts (ken-burns) behind
// the wordmark and slowly crossfades. Compositor-only (opacity + transform), so
// it costs almost nothing. Honors prefers-reduced-motion by holding one static,
// dimmed frame with no drift or crossfade.
function IdleArt() {
  const reduced = useRef(
    typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  ).current;
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduced || IDLE_ART.length < 2) return;
    const id = window.setInterval(
      () => setActive((i) => (i + 1) % IDLE_ART.length),
      SLIDE_MS,
    );
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0 }}>
      {IDLE_ART.map((src, index) => {
        const on = reduced ? index === 0 : index === active;
        return (
          <div
            key={src}
            aria-hidden
            style={{
              position: "absolute",
              inset: "-4%",
              backgroundImage: `url(${src})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: on ? 0.32 : 0,
              transition: `opacity ${FADE_MS}ms ease-in-out`,
              animation: on && !reduced ? `idleKenBurns ${SLIDE_MS + FADE_MS}ms ease-out both` : undefined,
              willChange: "opacity, transform",
            }}
          />
        );
      })}
      {/* Scrim so the wordmark and prompt always read over the art. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 74% 60% at 50% 46%, rgba(9,13,21,0.55) 0%, rgba(9,13,21,0.82) 52%, #05060a 88%)",
        }}
      />
    </div>
  );
}

function Particles() {
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2.6,
      delay: Math.random() * 8,
      duration: 6 + Math.random() * 6,
    })),
  ).current;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {particles.map((particle, index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            borderRadius: "50%",
            background: "rgba(220, 236, 255, 0.76)",
            boxShadow: `0 0 ${particle.size * 2.7}px rgba(135, 190, 255, 0.66), 0 0 ${particle.size * 7}px rgba(135, 190, 255, 0.16)`,
            animation: `idleTwinkle ${particle.duration}s ease-in-out ${particle.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export function IdleScreen({ message = "Press the PS button to wake", startup = false, leaving = false }: { message?: string; startup?: boolean; leaving?: boolean }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: startup ? 100 : 2000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.45rem",
        overflow: "hidden",
        background: "radial-gradient(ellipse 72% 56% at 50% 44%, #152033 0%, #090d15 42%, #05060a 78%)",
        animation: leaving ? "startupFlyThrough 760ms cubic-bezier(.22,1,.36,1) both" : undefined,
      }}
    >
      {!startup && <IdleArt />}
      <Particles />
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "baseline",
          gap: "0.82rem",
          color: "#f7fbff",
          textShadow: "0 0 22px rgba(180, 220, 255, 0.25)",
          animation: "idleWordmarkIn 620ms cubic-bezier(.22,1,.36,1) both",
        }}
      >
        {/* Established PS5 Mode identity: typographic rather than a generic glyph. */}
        <span style={{ fontFamily: "system-ui, sans-serif", fontSize: "2rem", fontWeight: 900, fontStyle: "italic", letterSpacing: "-0.17em", transform: "skew(-10deg) translateY(0.08em)" }}>PS</span>
        <span style={{ fontSize: "1.02rem", fontWeight: 800, letterSpacing: "0.31em", paddingLeft: "0.18em" }}>5 MODE</span>
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "0.55rem", color: "rgba(231, 240, 252, 0.72)", fontSize: "0.92rem", fontWeight: 620, letterSpacing: "0.035em", animation: "idlePrompt 2.2s ease-in-out infinite" }}>
        <span style={{ width: "0.36rem", height: "0.36rem", borderRadius: "50%", background: "#bde2ff", boxShadow: "0 0 12px rgba(120, 190, 255, 0.94)", animation: "idleGateLight 2.2s ease-in-out infinite" }} />
        {message}
      </div>
    </div>
  );
}
