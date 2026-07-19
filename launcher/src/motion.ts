// MOTION TOKENS — every duration, easing, travel distance and blur amount that
// defines how PS5 Mode feels, in one place.
//
// These were spread across seven files (App.tsx, CodexLauncher.tsx,
// KeyArtHero.tsx, IdleScreen.tsx, Search.tsx, VirtualKeyboard.tsx,
// useTouchpad.ts) plus inline CSS literals. Feel gets tuned constantly, and
// hunting the same magic number through several files is how the two keyboards
// ended up with duplicated-then-drifting swipe constants.
//
// Rule of thumb: if you'd ever say "make that a bit faster/stronger", it belongs
// here.
//
// The CSS-facing values are also published as custom properties by
// `motionCssVars()` so stylesheets and keyframes read the same numbers.

/** Critically-damped easing — settles, no overshoot. The house curve. */
export const EASE_SETTLE = "cubic-bezier(.22,1,.36,1)";
/** Quick exit curve for things leaving the screen. */
export const EASE_EXIT = "cubic-bezier(.4,0,1,1)";

export const MOTION = {
  /** Home tab switch: directional slide + motion-blur streak. */
  tabSlide: {
    inMs: 320,
    outMs: 280,
    /** Ghost cleanup must outlast outMs. */
    ghostCleanupMs: 300,
    /** Travel, in container-width units (cqw). */
    travelCqw: 6,
    blurPx: 12,
    /** The copy block moves less than the shelf — nearer/heavier reads slower. */
    copyTravelCqw: 4,
    copyBlurPx: 9,
    copyMs: 260,
  },

  /** Dock focus movement (hooks/useSpringScroll.ts). */
  dock: {
    /** Spring follow factor per frame. Higher = snappier, less glide. */
    follow: 0.22,
    /** Stop threshold in px — below this, snap and end the rAF loop. */
    epsilonPx: 0.5,
    /** Touchpad travel that equals one tile of movement. */
    tileDistance: 220,
    /** How far a flick's velocity is projected on release. */
    momentumMs: 140,
  },

  /** Touchpad tap-vs-drag threshold, in raw pad units (~1920x1080 space). */
  touchpad: {
    dragDeadzone: 14,
  },

  /** On-screen keyboard swipe travel per cell. Shared by Search and
   *  VirtualKeyboard — these were duplicated verbatim and would have drifted. */
  keyboard: {
    swipeRowDistance: 340,
    swipeColumnDistance: 420,
  },

  /** Hero art rotation (heroArt/KeyArtHero.tsx). */
  heroArt: {
    holdMs: 9000,
    crossfadeMs: 1200,
    /** Hero logo fade cycle, when enabled for an app. */
    logoCycleMs: 7000,
  },

  /** Idle screen slideshow + entry. */
  idle: {
    /** Inactivity before the idle screen takes over. */
    afterMs: 10 * 60 * 1000,
    slideMs: 9000,
    fadeMs: 1600,
    /** Analog jitter floor — stick noise must never count as activity. */
    stickDeadzone: 24,
  },

  /** Whole-app open/close. */
  app: {
    openMs: 260,
    exitMs: 160,
    /** Startup fly-through before Home is revealed. */
    startupMs: 760,
  },

  /** Parallax depth, in container-width units per unit of --px. */
  parallax: {
    backdropCqw: 2.4,
    atmosphereCqw: 1.1,
    settleMs: 550,
  },
} as const;

/**
 * Motion tokens as CSS custom properties, so stylesheets and keyframes read the
 * same numbers as the TS above. Spread onto a root element's style.
 */
export function motionCssVars(): Record<string, string> {
  const t = MOTION.tabSlide;
  return {
    "--ease-settle": EASE_SETTLE,
    "--tab-slide-in": `${t.inMs}ms`,
    "--tab-slide-out": `${t.outMs}ms`,
    "--tab-travel": `${t.travelCqw}cqw`,
    "--tab-blur": `${t.blurPx}px`,
    "--copy-travel": `${t.copyTravelCqw}cqw`,
    "--copy-slide": `${t.copyMs}ms`,
    "--hero-crossfade": `${MOTION.heroArt.crossfadeMs}ms`,
    "--parallax-backdrop": `${MOTION.parallax.backdropCqw}cqw`,
    "--parallax-atmos": `${MOTION.parallax.atmosphereCqw}cqw`,
  };
}
