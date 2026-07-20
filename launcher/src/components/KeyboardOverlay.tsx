import { VirtualKeyboard } from "./VirtualKeyboard";

interface KeyboardOverlayProps {
  title?: string;
  subtitle?: string;
  placeholder?: string;
  secret?: boolean;
  /**
   * "center" — floating glass panel over Home, for console-side text entry.
   * "dock"   — slim bar pinned to the bottom edge, for Desktop Mode. A centred
   *            panel covers exactly what you're typing into in a browser
   *            (search fields, address bars, login forms all sit mid-screen),
   *            so the dock variant never occupies the vertical centre and
   *            skips the full-screen scrim entirely.
   */
  variant?: "center" | "dock";
  onDone: (text: string) => void;
  onCancel: () => void;
}

/**
 * Summonable keyboard overlay — dims the backdrop and floats
 * VirtualKeyboard's `bare` core (swipe-to-select grid + D-pad/stick nav +
 * Cross-commit) instead of its full-screen panel shell.
 * Caller owns mount/unmount (matches every other panel in this app);
 * CodexLauncher must suppress its own Home-nav input while this is up.
 */
export function KeyboardOverlay({ title = "Keyboard", subtitle, placeholder, secret, variant = "center", onDone, onCancel }: KeyboardOverlayProps) {
  const dock = variant === "dock";
  return <div className={dock ? "codex-keyboard-overlay is-dock" : "codex-keyboard-overlay"}>
    <style>{CSS}</style>
    <section className={dock ? "codex-keyboard-overlay-panel is-dock" : "codex-keyboard-overlay-panel"}>
      {!dock && <header className="codex-keyboard-overlay-header"><div className="codex-eyebrow">TEXT INPUT</div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</header>}
      <VirtualKeyboard bare slim={dock} placeholder={placeholder} secret={secret} onDone={onDone} onCancel={onCancel} />
    </section>
  </div>;
}

const CSS = `
.codex-keyboard-overlay{position:fixed;inset:0;z-index:9;display:grid;place-items:center;background:rgba(4,6,10,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:codex-keyboard-overlay-in .22s cubic-bezier(.22,1,.36,1) both}
.codex-keyboard-overlay-panel{width:min(76cqw,60rem);height:58cqh;container-type:size;display:flex;flex-direction:column;gap:1.6cqh;padding:3.2cqh 3cqw 2.4cqh;border-radius:2.6cqh;border:1px solid rgba(255,255,255,.16);background:linear-gradient(135deg,rgba(28,34,47,.78),rgba(10,13,20,.66));box-shadow:0 42px 130px rgba(0,0,0,.68),inset 0 1px rgba(255,255,255,.4);backdrop-filter:blur(38px) saturate(175%);-webkit-backdrop-filter:blur(38px) saturate(175%)}
.codex-keyboard-overlay-header{flex:0 0 auto}
.codex-keyboard-overlay-header .codex-eyebrow{font-size:1.4cqh;letter-spacing:.18em;font-weight:800;color:rgba(255,255,255,.65)}
.codex-keyboard-overlay-header h2{margin:1cqh 0 .4cqh;font-size:3.4cqh;letter-spacing:-.04em}
.codex-keyboard-overlay-header p{margin:0;font-size:1.6cqh;color:rgba(255,255,255,.68)}
.codex-keyboard-overlay .codex-keyboard{flex:1;min-height:0}

/* ── Dock variant ─────────────────────────────────────────────────────────
   No scrim: the whole point is that the page behind stays visible and usable.
   The panel is bottom-anchored and sized by its content rather than given a
   fixed height, and deliberately does NOT set container-type, so the slim
   keyboard's cqh units resolve against the screen instead of against a short
   panel (which would have collapsed the keys to a few pixels). */
.codex-keyboard-overlay.is-dock{display:block;background:none;backdrop-filter:none;-webkit-backdrop-filter:none;animation:codex-keyboard-dock-in .24s cubic-bezier(.22,1,.36,1) both;pointer-events:none}
.codex-keyboard-overlay-panel.is-dock{pointer-events:auto;position:absolute;left:0;right:0;bottom:0;width:100%;height:auto;max-height:33cqh;container-type:normal;gap:.6cqh;padding:1.4cqh 3cqw 1.2cqh;border-radius:1.8cqh 1.8cqh 0 0;border:1px solid rgba(255,255,255,.16);border-bottom:0;
  /* Darker and less transparent than the centred panel: this one has to stay
     legible over an arbitrary web page, including a bright white one. */
  background:linear-gradient(180deg,rgba(10,13,20,.86),rgba(6,8,13,.94));box-shadow:0 -18px 60px rgba(0,0,0,.5),inset 0 1px rgba(255,255,255,.28)}
.codex-keyboard-overlay.is-dock .codex-keyboard{flex:0 0 auto}

@keyframes codex-keyboard-overlay-in{from{opacity:0}to{opacity:1}}
@keyframes codex-keyboard-dock-in{from{opacity:0;transform:translateY(2.5cqh)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.codex-keyboard-overlay{animation:none}.codex-keyboard-overlay.is-dock{animation:none}}
/* No glass-on-glass (design contract): if the user has asked for reduced
   transparency, or this sits over the Quick Menu's glass, the dock goes flat. */
@media (prefers-reduced-transparency: reduce){
  .codex-keyboard-overlay-panel,.codex-keyboard-overlay-panel.is-dock{backdrop-filter:none;-webkit-backdrop-filter:none;background:#0b0e15}
}
`;
