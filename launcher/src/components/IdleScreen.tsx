// Shared PS5 Mode idle/start visual. The sparse wordmark, cool-black field,
// and small constellation are the established design language for this state.

import { useRef } from "react";

const PARTICLE_COUNT = 64;

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
