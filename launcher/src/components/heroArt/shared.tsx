// Shared hero-art scaffold — a large, accurate brand mark (real logo path,
// not an abstracted shape) centered over a rich layered backdrop. Personal,
// non-distributed use, so accurate logos are fine here (unlike the DualSense
// button glyphs, which stayed generic for trademark reasons regardless).

interface BrandHeroProps {
  /** Real logo path data, 0-24 viewBox (Simple Icons convention). */
  path: string | string[];
  fill: string;
  bg: string;
  /** Small badge in the opposite corner from the grid's running-dot
   * (bottom-center under the tile) — used for tiles that actually open in a
   * browser, so it's clear at a glance what's about to happen. */
  badge?: "chrome";
}

export function ChromeBadge() {
  return (
    <g transform="translate(1430 70) scale(2.2)">
      <circle r="26" fill="#0b0d12" opacity="0.55" />
      <g transform="translate(-12 -12)">
        <path
          d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z"
          fill="#fff"
        />
      </g>
    </g>
  );
}

export function BrandHero({ path, fill, bg, badge }: BrandHeroProps) {
  const paths = Array.isArray(path) ? path : [path];
  const gid = fill.replace("#", "g");
  return (
    <svg viewBox="0 0 1600 900" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`${gid}-glow`} cx="58%" cy="42%" r="62%">
          <stop offset="0%" stopColor={fill} stopOpacity="0.4" />
          <stop offset="45%" stopColor={fill} stopOpacity="0.12" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${gid}-vign`} x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0%" stopColor={bg} />
          <stop offset="100%" stopColor={bg} stopOpacity="0.4" />
        </linearGradient>
      </defs>

      <rect width="1600" height="900" fill={bg} />
      <circle cx="980" cy="380" r="620" fill={`url(#${gid}-glow)`} />

      {/* Faint diagonal rule lines — gives the flat backdrop some structure
          without resorting to generic "floating card" boxes. */}
      <g stroke={fill} strokeOpacity="0.08" strokeWidth="2">
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={i} x1={200 + i * 180} y1="-50" x2={-100 + i * 180} y2="950" />
        ))}
      </g>

      {/* The real logo mark, large and slightly right-of-center so the grid's
          bottom-left title text never overlaps it. */}
      <g transform="translate(1080 430) scale(14)" opacity="0.94">
        <g transform="translate(-12 -12)">
          {paths.map((d, i) => (
            <path key={i} d={d} fill={fill} />
          ))}
        </g>
      </g>

      <rect width="1600" height="900" fill={`url(#${gid}-vign)`} opacity="0.5" />
      {badge === "chrome" && <ChromeBadge />}
    </svg>
  );
}
