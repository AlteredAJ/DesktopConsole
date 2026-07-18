import type { ReactNode } from "react";
import { Clock } from "./Clock";
import { Atmosphere } from "./Atmosphere";

export function CodexPanelShell({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: ReactNode }) {
  return <main className="codex-panel-screen">
    <style>{CSS}</style>
    <Atmosphere variant="panel" />
    <div className="codex-panel-vignette" />
    <header className="codex-panel-topbar"><div className="codex-panel-clock"><Clock /></div></header>
    <section className="codex-panel-card"><header><div className="codex-panel-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></header><div className="codex-panel-content">{children}</div></section>
  </main>;
}

const CSS = `
.codex-panel-screen{position:fixed;inset:0;isolation:isolate;width:100%;height:100%;overflow:hidden;container-type:size;background:#090b10;color:#f4f6fb}.codex-panel-vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(65% 65% at 78% 18%,rgba(75,132,221,.2),transparent 70%),linear-gradient(90deg,rgba(5,7,11,.94),rgba(5,7,11,.35) 62%,rgba(5,7,11,.72)),linear-gradient(0deg,rgba(5,7,11,.86),transparent 38%)}.codex-panel-topbar{position:absolute;z-index:1;top:5cqh;left:5.4cqw;right:5.4cqw;display:flex;align-items:center;justify-content:flex-end}.codex-panel-wordmark{display:flex;align-items:center;gap:.65cqw;font-size:1.1cqh;font-weight:750;letter-spacing:.18em;text-shadow:0 1px 15px #000}.codex-panel-wordmark span{font-size:1.6cqh;letter-spacing:-.12em;font-weight:900;font-style:italic;transform:skew(-12deg)}.codex-panel-clock{position:relative;padding:.85cqh 1.15cqw;border:1px solid rgba(255,255,255,.14);border-radius:1.4cqh;background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.03));backdrop-filter:blur(28px) saturate(180%);box-shadow:inset 0 1px rgba(255,255,255,.35)}.codex-panel-clock>div{font-size:1.05cqh!important;text-align:right!important}.codex-panel-clock>div>div:last-child{display:none}.codex-panel-card{position:absolute;z-index:1;left:8cqw;right:8cqw;top:18cqh;bottom:10cqh;display:flex;flex-direction:column;padding:4cqh 3.4cqw 3cqh;border:1px solid rgba(255,255,255,.15);border-radius:3cqh;background:linear-gradient(135deg,rgba(28,34,47,.72),rgba(10,13,20,.56));backdrop-filter:blur(34px) saturate(170%);box-shadow:inset 0 1px rgba(255,255,255,.34),0 4cqh 8cqh rgba(0,0,0,.38);overflow:hidden}.codex-panel-card:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(80% 50% at 10% 0%,rgba(255,255,255,.12),transparent 62%)}.codex-panel-card>header,.codex-panel-content{position:relative}.codex-panel-eyebrow{font-size:1.05cqh;letter-spacing:.18em;font-weight:800;color:rgba(255,255,255,.65)}.codex-panel-card h1{font-size:4.4cqh;letter-spacing:-.045em;line-height:1;margin:1.1cqh 0 .8cqh}.codex-panel-card>header p{margin:0;color:rgba(255,255,255,.68);font-size:1.6cqh}.codex-panel-content{flex:1;min-height:0;margin-top:3cqh;overflow:auto;padding:.1cqh .5cqw 2cqh 0;scrollbar-color:rgba(255,255,255,.35) transparent}.codex-panel-content::-webkit-scrollbar{width:.6cqh}.codex-panel-content::-webkit-scrollbar-thumb{background:rgba(255,255,255,.28);border-radius:99px}@media (max-aspect-ratio:1/1){.codex-panel-card{left:5cqw;right:5cqw;top:16cqh;bottom:8cqh}.codex-panel-card h1{font-size:3.6cqh}}
`;
