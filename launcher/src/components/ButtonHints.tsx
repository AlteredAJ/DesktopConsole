import type { ReactNode } from "react";
import { GlyphCircle, GlyphCross, GlyphDpad, GlyphOptions, GlyphSquare, GlyphSwipe, GlyphTriangle } from "./icons";

export interface Hint { glyph: string; label: string; }

const GLYPHS: Record<string, ReactNode> = {
  cross: <GlyphCross />, x: <GlyphCross />,
  circle: <GlyphCircle />, o: <GlyphCircle />,
  triangle: <GlyphTriangle />,
  square: <GlyphSquare />,
  options: <GlyphOptions />, swipe: <GlyphSwipe />, dpad: <GlyphDpad />,
};

export function ButtonHints({ hints }: { hints: Hint[] }) {
  if (!hints.length) return null;
  return <div className="dualsense-hints">{hints.map((hint) => <span key={hint.label} className="dualsense-hint"><i>{GLYPHS[hint.glyph] ?? <b>{hint.glyph}</b>}</i><span>{hint.label}</span></span>)}</div>;
}
