// Real brand icons — exact path data pulled from Simple Icons
// (https://simpleicons.org, CC0-licensed, built exactly for this kind of use).
// Each tile sits on a rounded dark backing so single-color glyphs read as
// polished app icons instead of raw line art.

import { useEffect, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { realLogoFor } from "../gameLogos";

const wrap = (bg: string): CSSProperties => ({
  width: "100%",
  height: "100%",
  borderRadius: "22%",
  background: bg,
  display: "grid",
  placeItems: "center",
  position: "relative",
  overflow: "hidden",
});

function Sheen() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(180deg, rgba(255,255,255,0.16), transparent 55%)",
        pointerEvents: "none",
      }}
    />
  );
}

function Glyph({ path, fill, size = "56%" }: { path: string; fill: string; size?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}>
      <path d={path} fill={fill} />
    </svg>
  );
}

// Path data + real brand fill colors, verbatim from Simple Icons.
const PATHS: Record<string, { path: string; fill: string; bg: string }> = {
  youtube: {
    fill: "#FF0000",
    bg: "#0f0f0f",
    path: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
  netflix: {
    fill: "#E50914",
    bg: "#141414",
    path: "m5.398 0 8.348 23.602c2.346.059 4.856.398 4.856.398L10.113 0H5.398zm8.489 0v9.172l4.715 13.33V0h-4.715zM5.398 1.5V24c1.873-.225 2.81-.312 4.715-.398V14.83L5.398 1.5z",
  },
  spotify: {
    fill: "#1ED760",
    bg: "#121212",
    path: "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z",
  },
  discord: {
    fill: "#5865F2",
    bg: "#1e1f28",
    path: "M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z",
  },
  steam: {
    fill: "#66c0f4",
    bg: "#171a21",
    path: "M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z",
  },
  epic: {
    fill: "#f2f2f2",
    bg: "#161616",
    path: "M3.537 0C2.165 0 1.66.506 1.66 1.879V18.44a4.262 4.262 0 00.02.433c.031.3.037.59.316.92.027.033.311.245.311.245.153.075.258.13.43.2l8.335 3.491c.433.199.614.276.928.27h.002c.314.006.495-.071.928-.27l8.335-3.492c.172-.07.277-.124.43-.2 0 0 .284-.211.311-.243.28-.33.285-.621.316-.92a4.261 4.261 0 00.02-.434V1.879c0-1.373-.506-1.88-1.878-1.88zm13.366 3.11h.68c1.138 0 1.688.553 1.688 1.696v1.88h-1.374v-1.8c0-.369-.17-.54-.523-.54h-.235c-.367 0-.537.17-.537.539v5.81c0 .369.17.54.537.54h.262c.353 0 .523-.171.523-.54V8.619h1.373v2.143c0 1.144-.562 1.71-1.7 1.71h-.694c-1.138 0-1.7-.566-1.7-1.71V4.82c0-1.144.562-1.709 1.7-1.709zm-12.186.08h3.114v1.274H6.117v2.603h1.648v1.275H6.117v2.774h1.74v1.275h-3.14zm3.816 0h2.198c1.138 0 1.7.564 1.7 1.708v2.445c0 1.144-.562 1.71-1.7 1.71h-.799v3.338h-1.4zm4.53 0h1.4v9.201h-1.4zm-3.13 1.235v3.392h.575c.354 0 .523-.171.523-.54V4.965c0-.368-.17-.54-.523-.54zm-3.74 10.147a1.708 1.708 0 01.591.108 1.745 1.745 0 01.49.299l-.452.546a1.247 1.247 0 00-.308-.195.91.91 0 00-.363-.068.658.658 0 00-.28.06.703.703 0 00-.224.163.783.783 0 00-.151.243.799.799 0 00-.056.299v.008a.852.852 0 00.056.31.7.7 0 00.157.245.736.736 0 00.238.16.774.774 0 00.303.058.79.79 0 00.445-.116v-.339h-.548v-.565H7.37v1.255a2.019 2.019 0 01-.524.307 1.789 1.789 0 01-.683.123 1.642 1.642 0 01-.602-.107 1.46 1.46 0 01-.478-.3 1.371 1.371 0 01-.318-.455 1.438 1.438 0 01-.115-.58v-.008a1.426 1.426 0 01.113-.57 1.449 1.449 0 01.312-.46 1.418 1.418 0 01.474-.309 1.58 1.58 0 01.598-.111 1.708 1.708 0 01.045 0zm11.963.008a2.006 2.006 0 01.612.094 1.61 1.61 0 01.507.277l-.386.546a1.562 1.562 0 00-.39-.205 1.178 1.178 0 00-.388-.07.347.347 0 00-.208.052.154.154 0 00-.07.127v.008a.158.158 0 00.022.084.198.198 0 00.076.066.831.831 0 00.147.06c.062.02.14.04.236.061a3.389 3.389 0 01.43.122 1.292 1.292 0 01.328.17.678.678 0 01.207.24.739.739 0 01.071.337v.008a.865.865 0 01-.081.382.82.82 0 01-.229.285 1.032 1.032 0 01-.353.18 1.606 1.606 0 01-.46.061 2.16 2.16 0 01-.71-.116 1.718 1.718 0 01-.593-.346l.43-.514c.277.223.578.335.9.335a.457.457 0 00.236-.05.157.157 0 00.082-.142v-.008a.15.15 0 00-.02-.077.204.204 0 00-.073-.066.753.753 0 00-.143-.062 2.45 2.45 0 00-.233-.062 5.036 5.036 0 01-.413-.113 1.26 1.26 0 01-.331-.16.72.72 0 01-.222-.243.73.73 0 01-.082-.36v-.008a.863.863 0 01.074-.359.794.794 0 01.214-.283 1.007 1.007 0 01.34-.185 1.423 1.423 0 01.448-.066 2.006 2.006 0 01.025 0zm-9.358.025h.742l1.183 2.81h-.825l-.203-.499H8.623l-.198.498h-.81zm2.197.02h.814l.663 1.08.663-1.08h.814v2.79h-.766v-1.602l-.711 1.091h-.016l-.707-1.083v1.593h-.754zm3.469 0h2.235v.658h-1.473v.422h1.334v.61h-1.334v.442h1.493v.658h-2.255zm-5.3.897l-.315.793h.624zm-1.145 5.19h8.014l-4.09 1.348z",
  },
  battlenet: {
    fill: "#4381C3",
    bg: "#00121e",
    path: "M18.94 8.296C15.9 6.892 11.534 6 7.426 6.332c.206-1.36.714-2.308 1.548-2.508 1.148-.275 2.4.48 3.594 1.854.782.102 1.71.28 2.355.429C12.747 2.013 9.828-.282 7.607.565c-1.688.644-2.553 2.97-2.448 6.094-2.2.468-3.915 1.3-5.013 2.495-.056.065-.181.227-.137.305.034.058.146-.008.194-.04 1.274-.89 2.904-1.373 5.027-1.676.303 3.333 1.713 7.56 4.055 10.952-1.28.502-2.356.536-2.946-.087-.812-.856-.784-2.318-.19-4.04a26.764 26.764 0 0 1-.807-2.254c-2.459 3.934-2.986 7.61-1.143 9.11 1.402 1.14 3.847.725 6.502-.926 1.505 1.672 3.083 2.74 4.667 3.094.084.015.287.043.332-.034.034-.06-.08-.124-.131-.149-1.408-.657-2.64-1.828-3.964-3.515 2.735-1.929 5.691-5.263 7.457-8.988 1.076.86 1.64 1.773 1.398 2.595-.336 1.131-1.615 1.84-3.403 2.185a27.697 27.697 0 0 1-1.548 1.826c4.634.16 8.08-1.22 8.458-3.565.286-1.786-1.295-3.696-4.053-5.17.696-2.139.832-4.04.346-5.588-.029-.08-.106-.27-.196-.27-.068 0-.067.13-.063.187.135 1.547-.263 3.2-1.062 5.19zm-8.533 9.869c-1.96-3.145-3.09-6.849-3.082-10.594 3.702-.124 7.474.748 10.714 2.627-1.743 3.269-4.385 6.1-7.633 7.966h.001z",
  },
};

export function accentFor(id: string): string {
  if (id in PATHS) return PATHS[id].fill;
  if (id === "browser:https://www.disneyplus.com") return "#113ccf";
  if (id === "browser:https://www.hulu.com") return "#1ce783";
  if (id === "browser:https://www.primevideo.com") return "#00a8e1";
  if (id.startsWith("browser:")) return "#2b6cb0";
  if (id.startsWith("exe:")) return hashColor(id);
  return "#6ea8ff";
}

export const TAGLINE: Record<string, string> = {
  youtube: "Stream anything, instantly",
  netflix: "Movies & shows on demand",
  spotify: "Music, wherever this goes",
  discord: "Chat with your crew",
  steam: "Your PC library, big picture",
  epic: "Free games & your Epic library",
  battlenet: "Blizzard's full catalog",
  "browser:https://www.google.com": "Anywhere else on the web",
  "browser:https://www.primevideo.com": "Prime's movies & shows",
  "browser:https://www.disneyplus.com": "Disney, Marvel, Star Wars & more",
  "browser:https://www.hulu.com": "Next-day TV & original series",
};

export function taglineFor(id: string): string {
  return TAGLINE[id] ?? "";
}

// Deterministic-but-varied accent/backing per standalone game so a shelf of
// "exe:" tiles doesn't read as identical gray boxes.
const GAME_PALETTE = ["#8c6fd4", "#3fb0b0", "#d46f8c", "#6f8cd4", "#d4a53f"];
function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GAME_PALETTE[h % GAME_PALETTE.length];
}

function BrandIcon({ id }: { id: string }) {
  const { path, fill, bg } = PATHS[id];
  return (
    <div style={wrap(bg)}>
      <Sheen />
      <Glyph path={path} fill={fill} />
    </div>
  );
}

export function BrowserIcon({ tint = "#2b6cb0" }: { tint?: string }) {
  return (
    <div style={wrap(tint)}>
      <Sheen />
      <svg viewBox="0 0 24 24" width="58%" height="58%">
        <circle cx="12" cy="12" r="9" fill="none" stroke="#fff" strokeWidth="1.6" />
        <ellipse cx="12" cy="12" rx="4" ry="9" fill="none" stroke="#fff" strokeWidth="1.4" />
        <line x1="3" y1="12" x2="21" y2="12" stroke="#fff" strokeWidth="1.4" />
      </svg>
    </div>
  );
}

export function GameIcon({ seed }: { seed: string }) {
  return (
    <div style={wrap(hashColor(seed) + "22")}>
      <Sheen />
      <svg viewBox="0 0 24 24" width="60%" height="60%">
        <rect x="2" y="8" width="20" height="10" rx="5" fill="none" stroke={hashColor(seed)} strokeWidth="2" />
        <line x1="7" y1="11" x2="7" y2="15" stroke={hashColor(seed)} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="5" y1="13" x2="9" y2="13" stroke={hashColor(seed)} strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="16" cy="12" r="1.2" fill={hashColor(seed)} />
        <circle cx="18.5" cy="14.5" r="1.2" fill={hashColor(seed)} />
      </svg>
    </div>
  );
}

/** PS-button-inspired glyphs for the controller hint bar — simplified shape
 * outlines matching the DualSense face buttons, not the official Sony artwork. */
export function GlyphCross() {
  return (
    <svg viewBox="0 0 24 24" width="60%" height="60%">
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function GlyphCircle() {
  return (
    <svg viewBox="0 0 24 24" width="60%" height="60%">
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

export function GlyphSquare() {
  return (
    <svg viewBox="0 0 24 24" width="60%" height="60%">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

export function GlyphTriangle() {
  return (
    <svg viewBox="0 0 24 24" width="60%" height="60%">
      <polygon points="12,5 19,18 5,18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

/** Options button — three short rounded bars, the standard glyph printed on
 * the DualSense Options button itself (not a hamburger-menu metaphor borrowed
 * from elsewhere). */
export function GlyphOptions() {
  return (
    <svg viewBox="0 0 24 24" width="60%" height="60%">
      <line x1="5" y1="8" x2="19" y2="8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="5" y1="16" x2="19" y2="16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** Touchpad swipe hint — the REAL DualSense touchpad outline (traced from
 * daidr/dualsense-tester's design/dualsense.svg, MIT licensed — see that
 * repo's LICENSE). Bounding box (312.83,143.01,492.5,253.86) was read via the
 * browser's getBBox() on the source file, not hand-estimated, so the crop
 * below is exact. Plus a directional arrow overlay for the swipe hint. */
export function GlyphSwipe() {
  return (
    <svg viewBox="292.83 123.01 532.5 313.86" width="60%" height="60%">
      <path
        d="M559.079,143.015c0,0 158.534,-0.805 226.555,15.497c12.437,2.981 21.237,14.507 19.467,24.644c-8.942,51.221 -20.354,109.033 -30.53,160.023c-8.029,40.224 -40.893,53.816 -68.431,53.692c-27.538,-0.124 -147.061,-0.559 -147.061,-0.559c0,0 -119.522,0.435 -147.06,0.559c-27.538,0.124 -60.403,-13.468 -68.431,-53.692c-10.177,-50.99 -21.589,-108.802 -30.531,-160.023c-1.77,-10.137 7.031,-21.663 19.467,-24.644c68.021,-16.302 226.555,-15.497 226.555,-15.497Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
      />
      <path
        d="M479 270h140M589 232l60 38-60 38"
        fill="none"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** D-pad hint — the four real DualSense D-pad arrows in their actual
 * relative arrangement, traced from the same MIT-licensed source SVG.
 * Combined bounding box likewise read via getBBox(), not estimated. */
export function GlyphDpad() {
  return (
    <svg viewBox="63.42 241.69 230.64 231.71" width="60%" height="60%">
      <path
        d="M213.487,271.996c0,-11.214 -9.091,-20.305 -20.305,-20.305l-28.888,-0c-11.215,-0 -20.306,9.091 -20.306,20.305l0,24.336c0,6.286 2.397,12.335 6.703,16.915c6.856,7.293 17.331,18.436 23.351,24.838c1.218,1.296 2.917,2.031 4.696,2.031c1.778,-0 3.478,-0.735 4.696,-2.031c6.019,-6.402 16.494,-17.545 23.35,-24.838c4.306,-4.58 6.703,-10.629 6.703,-16.915c0,-6.766 0,-16.013 0,-24.336Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path d="M168.337,270.016l18.658,0l-9.081,-9.08l-9.577,9.08Z" fill="currentColor" />
      <path
        d="M213.487,443.093c0,11.215 -9.091,20.306 -20.305,20.306l-28.888,-0c-11.215,-0 -20.306,-9.091 -20.306,-20.306l0,-24.125c0,-6.412 2.494,-12.572 6.953,-17.178c6.884,-7.11 17.23,-17.796 23.166,-23.927c1.214,-1.254 2.885,-1.962 4.631,-1.962c1.745,0 3.416,0.708 4.63,1.962c5.936,6.131 16.282,16.817 23.166,23.927c4.46,4.606 6.953,10.766 6.953,17.178c0,6.746 0,15.888 0,24.125Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path d="M168.337,445.073l18.658,0l-9.081,9.08l-9.577,-9.08Z" fill="currentColor" />
      <path
        d="M263.75,322.259c11.215,0 20.306,9.091 20.306,20.306l-0,28.888c-0,11.214 -9.091,20.305 -20.306,20.305l-24.349,0c-6.278,0 -12.32,-2.391 -16.899,-6.687c-7.081,-6.644 -17.749,-16.654 -23.907,-22.433c-1.274,-1.195 -2.008,-2.855 -2.035,-4.601c-0.027,-1.746 0.656,-3.428 1.892,-4.661c6.106,-6.094 16.81,-16.778 23.946,-23.901c4.63,-4.621 10.905,-7.216 17.446,-7.216c6.724,0 15.758,0 23.906,0Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path d="M265.73,367.409l0,-18.657l9.081,9.08l-9.081,9.577Z" fill="currentColor" />
      <path
        d="M93.725,322.259c-11.214,0 -20.306,9.091 -20.306,20.306l0,28.888c0,11.214 9.092,20.305 20.306,20.305l24.349,0c6.278,0 12.321,-2.391 16.899,-6.687c7.081,-6.644 17.749,-16.654 23.908,-22.433c1.273,-1.195 2.007,-2.855 2.034,-4.601c0.027,-1.746 -0.656,-3.428 -1.891,-4.661c-6.106,-6.094 -16.81,-16.778 -23.947,-23.901c-4.63,-4.621 -10.904,-7.216 -17.446,-7.216c-6.724,0 -15.757,0 -23.906,0Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path d="M91.745,367.409l0,-18.657l-9.08,9.08l9.08,9.577Z" fill="currentColor" />
    </svg>
  );
}

// Real icons extracted from the actual installed .exe (icon_extract.rs) — the
// exact icon Explorer/the taskbar shows for that app, on this machine.
// Cached in-memory per tile id for the session (extraction is a real Win32
// GDI call on the Rust side; the backend also memoizes, this just avoids the
// IPC round-trip on every re-render/focus change). Falls back to the
// existing hand-drawn/brand icon while loading or if extraction finds
// nothing (e.g. the game isn't actually installed at its configured path).
const extractedCache = new Map<string, string | null>();

function useExtractedIcon(id: string, eligible: boolean): string | null {
  const [uri, setUri] = useState<string | null>(extractedCache.get(id) ?? null);
  useEffect(() => {
    if (!eligible) return;
    if (extractedCache.has(id)) {
      setUri(extractedCache.get(id) ?? null);
      return;
    }
    let cancelled = false;
    void invoke<string | null>("extract_tile_icon", { tileId: id }).then((result) => {
      extractedCache.set(id, result);
      if (!cancelled) setUri(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, eligible]);
  return uri;
}

function logoSurfaceFor(id: string): string {
  if (id === "browser:https://www.primevideo.com") return "#071a32";
  if (id.includes("disneyplus") || id.includes("Disney+")) return "#07184a";
  if (id.includes("hulu") || id.includes("Hulu")) return "#0b2918";
  if (id.includes("FMHY")) return "#0a0b12";
  if (id.includes("Fortnite")) return "#172a67";
  if (id.includes("Forza Horizon")) return "#08272e";
  return "var(--tile)";
}

function ExtractedIcon({ uri, background = "var(--tile)" }: { uri: string; background?: string }) {
  return (
    <div style={wrap(background)}>
      <Sheen />
      <img src={uri} alt="" style={{ position: "relative", width: "70%", height: "70%", objectFit: "contain" }} />
    </div>
  );
}

export function ServiceIcon({ id }: { id: string }) {
  // Real downloaded logo (gameLogos.ts) wins over everything else — it's
  // curated/verified, unlike Windows icon extraction (often low-res, 32-48px
  // source icons stretched to fill the tile) or the generic fallback glyphs.
  const real = realLogoFor(id);
  if (real) return <ExtractedIcon uri={real} background={logoSurfaceFor(id)} />;

  // Launcher brands are native vectors; only installed-game executables need extraction.
  const eligible = id.startsWith("exe:");
  const extracted = useExtractedIcon(id, eligible);
  if (extracted) return <ExtractedIcon uri={extracted} />;

  if (id in PATHS) return <BrandIcon id={id} />;
  if (id === "browser:https://www.netflix.com/browse") return <BrandIcon id="netflix" />;
  if (id === "browser:https://www.disneyplus.com") return <BrowserIcon tint="#113ccf" />;
  if (id === "browser:https://www.hulu.com") return <BrowserIcon tint="#0b3d2e" />;
  if (id === "browser:https://www.primevideo.com") return <BrowserIcon tint="#00a8e1" />;
  if (id.startsWith("browser:")) return <BrowserIcon />;
  if (id.startsWith("exe:")) return <GameIcon seed={id} />;
  return <div style={wrap("var(--tile)")} />;
}
