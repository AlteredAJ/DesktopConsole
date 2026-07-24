// Shared PS5 Mode idle/start visual. The sparse wordmark, cool-black field,
// and small constellation are the established design language for this state.

import { useEffect, useRef, useState } from "react";
import { IDLE_ART } from "../gameLogos";
import { getPerformanceSettings, subscribePerformanceSettings } from "../settings";
import { MOTION } from "../motion";

const PARTICLE_COUNT = 64;

// How long each hero holds before the slow crossfade to the next one.
const SLIDE_MS = MOTION.idle.slideMs;
const FADE_MS = MOTION.idle.fadeMs;

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

  // Settings > Performance can hold the idle slideshow on a single still.
  const [rotationOn, setRotationOn] = useState(() => getPerformanceSettings().idleRotation);
  useEffect(() => subscribePerformanceSettings(() => setRotationOn(getPerformanceSettings().idleRotation)), []);
  useEffect(() => {
    if (reduced || !rotationOn || IDLE_ART.length < 2) return;
    const id = window.setInterval(
      () => setActive((i) => (i + 1) % IDLE_ART.length),
      SLIDE_MS,
    );
    return () => window.clearInterval(id);
  }, [reduced, rotationOn]);

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
          alignItems: "center",
          gap: "0.72rem",
          color: "#f7fbff",
          textShadow: "0 0 22px rgba(180, 220, 255, 0.25)",
          animation: "idleWordmarkIn 620ms cubic-bezier(.22,1,.36,1) both",
        }}
      >
        <svg viewBox="0 0 64 54" fill="none" stroke="#e4ecff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: "2.2rem", height: "1.9rem", filter: "drop-shadow(0 0 8px rgba(91,156,245,0.5))" }} aria-hidden="true">
          <path d="M8 12h48c4 0 4 4 4 4v8c0 16-4 22-14 22-6 0-12-4-14-12-2 8-8 12-14 12C8 46 4 40 4 24v-8c0 0 0-4 4-4Z"/><rect x="22" y="14" width="20" height="12" rx="4"/><line x1="24" y1="6" x2="40" y2="6" stroke="#5b9cf5" strokeWidth="2.5"/><circle cx="29" cy="32" r="4"/><circle cx="35" cy="32" r="4"/>
        </svg>
        <span style={{ fontSize: "1.32rem", fontWeight: 900, letterSpacing: "-0.06em", transform: "skew(-10deg)" }}>LM</span>
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "0.6rem", color: "rgba(231, 240, 252, 0.68)", fontSize: "0.92rem", fontWeight: 620, letterSpacing: "0.035em", animation: "idlePrompt 2.2s ease-in-out infinite" }}>
        <svg viewBox="0 0 64 54" fill="none" stroke="#bde2ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "1.5rem", height: "1.3rem", opacity: 0.9, animation: "idleGateLight 2.2s ease-in-out infinite" }} aria-hidden="true">
          <path d="M8 12h48c4 0 4 4 4 4v8c0 16-4 22-14 22-6 0-12-4-14-12-2 8-8 12-14 12C8 46 4 40 4 24v-8c0 0 0-4 4-4Z"/><rect x="22" y="14" width="20" height="12" rx="4"/><line x1="24" y1="6" x2="40" y2="6" stroke="#5b9cf5" strokeWidth="2.5"/><circle cx="29" cy="32" r="4"/><circle cx="35" cy="32" r="4"/>
        </svg>
        {message}
      </div>
    </div>
  );
}
