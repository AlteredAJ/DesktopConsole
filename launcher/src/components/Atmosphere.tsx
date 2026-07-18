// Local, self-contained living background — the PS5/Apple-TV "living dashboard"
// feel, rendered entirely in-app with no network dependency (it replaces the old
// remote fluid.krackeddevs.com iframe the panels used to embed).
//
// All motion is compositor-only: see the performance contract on `.atmos` in
// styles.css. The orb hues follow `--focus-bloom` (set by the home screen when a
// tile is focused) and fall back to `--accent` when no focus context exists
// (panels), so the room quietly retints as you move around.

export function Atmosphere({ variant = "home" }: { variant?: "home" | "panel" }) {
  return (
    <div className={`atmos atmos-${variant}`} aria-hidden="true">
      <div className="atmos-base" />
      <div className="atmos-orb atmos-orb-a" />
      <div className="atmos-orb atmos-orb-b" />
      <div className="atmos-orb atmos-orb-c" />
      <div className="atmos-sheen" />
      <div className="atmos-grain" />
    </div>
  );
}
