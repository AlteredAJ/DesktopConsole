// Rich game detail panel — replaces the old three-line mini-menu (Play / Close
// Game / Trainer) with a full-card layout: box art, description, trophy widget,
// screenshot preview, and CTA actions. Gated by the same controller flow
// (expandedTile / moveGameAction / runGameAction / Circle to dismiss) so no
// new input wiring is needed — just a bigger card in the same slot.

import { type CSSProperties } from "react";
import { GlyphCircle, GlyphCross, ServiceIcon } from "./icons";
import { identityFor } from "../appRegistry";
import { accentFor } from "./icons";

interface Tile { id: string; label: string; category: string; needsCursor?: boolean; hasTrainer?: boolean; }
interface GameAction { id: "play" | "close" | "trainer"; label: string; }

interface Props {
  tile: Tile;
  actions: GameAction[];
  actionIndex: number;
  isRunning: boolean;
  onAction: (action: GameAction) => void;
  onClose: () => void;
}

/** Trophy stub — real data would come from a backend (local game index, PSN
 *  API, or a per-game trophy file). */
/** Info carousel — placeholder stub until we wire real playtime/install/settings data. */
function InfoCarousel() {
  return (
    <section className="gamedetail-info">
      <div className="gamedetail-info-page">
        <div className="gamedetail-stat"><b>--<small>h</small></b><s>Played</s></div>
        <div className="gamedetail-stat"><b>--<small>h</small></b><s>This Week</s></div>
        <div className="gamedetail-stat"><b>--</b><s>Sessions</s></div>
        <div className="gamedetail-stat"><b>--</b><s>Last Launch</s></div>
      </div>
    </section>
  );
}

export function GameDetailPanel({ tile, actions, actionIndex, isRunning, onAction, onClose }: Props) {
  const accent = accentFor(tile.id);
  const identity = identityFor(tile.id);
  const heroArt = identity?.art;
  const panelStyle: CSSProperties = {
    "--game-accent": accent,
    maxWidth: "min(76cqw,56rem)",
    width: "min(76cqw,56rem)",
    minHeight: "48cqh",
    padding: "3.2cqh 3.4cqw",
  } as CSSProperties;

  return (
    <div className="codex-confirm-backdrop" onClick={onClose}>
      <section
        className="codex-power-panel codex-glass gamedetail-panel"
        style={{
          ...panelStyle,
          background: `radial-gradient(110% 92% at 9% -8%, rgba(255,255,255,.22), transparent 39%), radial-gradient(70% 100% at 100% 100%, color-mix(in srgb, var(--game-accent) 24%, transparent), transparent 66%), linear-gradient(145deg, rgba(22,32,52,.78), rgba(8,12,24,.88))`,
          borderColor: "rgba(225,240,255,.32)",
          boxShadow: `0 42px 130px rgba(0,0,0,.72), 0 0 0 1px color-mix(in srgb, var(--game-accent) 14%, transparent), inset 0 1px rgba(255,255,255,.48), inset 0 -24px 54px rgba(0,4,18,.35)`,
          backdropFilter: "blur(48px) saturate(175%)",
          WebkitBackdropFilter: "blur(48px) saturate(175%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{CSS}</style>

        {/* Header row: icon + title + status */}
        <header className="gamedetail-header">
          <span className="gamedetail-header-icon">
            <ServiceIcon id={tile.id} />
          </span>
          <div className="gamedetail-header-text">
            <div className="codex-eyebrow">
              <i className="codex-live-dot" />
              {isRunning ? "NOW PLAYING" : tile.category.toUpperCase()}
            </div>
            <h2>{tile.label}</h2>
          </div>
          {isRunning && <span className="gamedetail-status-pill">Running</span>}
        </header>

        {/* Body: left column = screenshot + description, right column = box art */}
        <div className="gamedetail-body">
          <div className="gamedetail-body-left">
            <div className="gamedetail-screenshot" style={heroArt ? { backgroundImage: `url("${heroArt}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
              {!heroArt && <span className="gamedetail-screenshot-placeholder">Screenshot Gallery</span>}
            </div>
          </div>
          <div className="gamedetail-body-right">
            <div className="gamedetail-boxart" style={heroArt ? { backgroundImage: `url("${heroArt}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
              {!heroArt && <ServiceIcon id={tile.id} />}
            </div>
          </div>
        </div>

        <InfoCarousel />

        {/* CTA actions — same controller-driven selection as the old menu */}
        <div className="gamedetail-actions">
          {actions.map((action, index) => (
            <button
              key={action.id}
              className={`gamedetail-action-btn ${index === actionIndex ? "selected" : ""}`}
              style={
                index === actionIndex
                  ? {
                      background: `linear-gradient(105deg, color-mix(in srgb, var(--game-accent) 34%, rgba(255,255,255,.16)), rgba(255,255,255,.12))`,
                      boxShadow: `0 0 0 .24cqh rgba(255,255,255,.19), 0 1.2cqh 2.5cqh color-mix(in srgb, var(--game-accent) 23%, transparent), inset 0 1px rgba(255,255,255,.46)`,
                    }
                  : undefined
              }
              onClick={() => onAction(action)}
            >
              {action.id === "play" ? (
                <i className="gamedetail-action-glyph">&#9654;</i>
              ) : action.id === "close" ? (
                <i className="gamedetail-action-glyph">&#9632;</i>
              ) : (
                <i className="gamedetail-action-glyph">&#9776;</i>
              )}
              <b>{action.label}</b>
              {action.id === "play" && <small>{isRunning ? "Resume" : "Launch"}</small>}
              {action.id === "close" && <small>Terminate</small>}
              {action.id === "trainer" && <small>Cheat engine</small>}
            </button>
          ))}
        </div>

        <footer className="codex-power-footer" style={{ marginTop: "2.6cqh" }}>
          Up / Down to choose <b><i className="codex-dualsense-inline"><GlyphCross /></i>Select</b> <span><i className="codex-dualsense-inline"><GlyphCircle /></i>Back</span>
        </footer>
      </section>
    </div>
  );
}

const CSS = `
.gamedetail-panel {
  animation: codex-panel-in .22s cubic-bezier(.22,1,.36,1) both;
}
.gamedetail-header {
  display: flex; align-items: center; gap: 1.6cqw; margin-bottom: 2.8cqh;
}
.gamedetail-header-icon {
  width: 7.2cqh; height: 7.2cqh; flex-shrink: 0; border-radius: 1.8cqh;
  background: linear-gradient(145deg, rgba(255,255,255,.14), rgba(255,255,255,.04));
  border: 1px solid rgba(255,255,255,.14);
  display: flex; align-items: center; justify-content: center;
  font-size: 3.2cqh;
  box-shadow: 0 8px 24px rgba(0,0,0,.4), inset 0 1px rgba(255,255,255,.25);
}
.gamedetail-header-text { flex: 1; }
.gamedetail-header-text h2 {
  font-size: 4.2cqh; font-weight: 800; letter-spacing: -.03em; margin: 0;
  text-shadow: 0 2px 12px rgba(0,0,0,.5);
  line-height: 1.1;
}
.gamedetail-status-pill {
  padding: .4cqh 1.1cqw; border-radius: 1.2cqh;
  background: rgba(26,255,132,.14); border: 1px solid rgba(26,255,132,.25);
  color: #1AFF84; font-size: 1.05cqh; font-weight: 700; letter-spacing: .06em;
}
.gamedetail-body {
  display: flex; gap: 2.2cqw; margin-bottom: 2.2cqh;
}
.gamedetail-body-left { flex: 1; min-width: 0; }
.gamedetail-body-right { width: 22cqh; flex-shrink: 0; }
.gamedetail-screenshot {
  width: 100%; aspect-ratio: 16/9; border-radius: 1.4cqh; overflow: hidden;
  border: 1px solid rgba(255,255,255,.1);
  background: linear-gradient(135deg, rgba(255,255,255,.04), rgba(0,0,0,.2));
  box-shadow: 0 6px 24px rgba(0,0,0,.35);
  display: flex; align-items: center; justify-content: center;
}
.gamedetail-screenshot-placeholder {
  font-size: 1.4cqh; font-weight: 600; letter-spacing: .08em;
  color: rgba(255,255,255,.18); text-transform: uppercase;
}
.gamedetail-boxart {
  width: 100%; aspect-ratio: 1; border-radius: 1.4cqh; overflow: hidden;
  border: 1px solid rgba(255,255,255,.12);
  background: linear-gradient(145deg, rgba(255,255,255,.06), rgba(0,0,0,.25));
  display: flex; align-items: center; justify-content: center;
  font-size: 5cqh; color: rgba(255,255,255,.06);
  box-shadow: 0 8px 32px rgba(0,0,0,.45);
}
.gamedetail-trophies {
  display: flex; align-items: center; gap: 2.8cqw;
  padding: 1.8cqh 2.1cqw; border-radius: 1.2cqh;
  background: rgba(0,0,0,.38); backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,.06);
  margin-bottom: 2.4cqh;
}
.gamedetail-trophy-item { text-align: center; min-width: 5.6cqh; }
.gamedetail-trophy-icon { font-size: 2.2cqh; display: block; line-height: 1; }
.gamedetail-trophy-item b { display: block; font-size: 1.7cqh; font-weight: 700; margin-top: .3cqh; }
.gamedetail-trophy-item small { font-size: .95cqh; font-weight: 400; color: rgba(255,255,255,.5); letter-spacing: .02em; }
.gamedetail-trophy-summary {
  margin-left: auto; font-size: 1.05cqh; font-weight: 600; color: rgba(255,255,255,.42);
  letter-spacing: .04em; text-transform: uppercase;
}
.gamedetail-actions {
  display: flex; gap: 1.1cqw;
}
.gamedetail-action-btn {
  flex: 1; display: flex; align-items: center; gap: 1.1cqw;
  min-height: 7.6cqh; padding: 1.2cqh 1.8cqw; border-radius: 1.4cqh; border: none;
  background: linear-gradient(110deg, rgba(255,255,255,.13), rgba(255,255,255,.035));
  color: #fff; font: inherit; cursor: pointer;
  box-shadow: inset 0 1px rgba(255,255,255,.22);
  transition: background .14s, box-shadow .14s, transform .1s;
}
.gamedetail-action-btn:hover { background: rgba(255,255,255,.1); }
.gamedetail-action-glyph { font-size: 2.4cqh; font-style: normal; flex-shrink: 0; }
.gamedetail-action-btn b   { font-size: 1.7cqh; font-weight: 700; text-align: left; flex: 1; }
.gamedetail-action-btn small { font-size: 1.1cqh; font-weight: 500; color: rgba(255,255,255,.5); }
.gamedetail-action-btn.selected {
  box-shadow: inset 0 1px rgba(255,255,255,.46);
  transform: translateY(-2px);
}
@keyframes codex-panel-in { from { opacity: 0; transform: scale(.97) translateY(12px); } to { opacity: 1; transform: none; } }
`;
