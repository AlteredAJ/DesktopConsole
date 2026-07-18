import { ServiceIcon } from "../../src/components/icons";

export function IconSurface({ id, focused = false, running = false }: { id: string; focused?: boolean; running?: boolean }) {
  return <div className={`dk-tile ${focused ? "is-focused" : ""}`}><div className="dk-icon"><ServiceIcon id={id} /></div>{running && <i className="dk-running" />}</div>;
}
export function Dock({ children }: { children: React.ReactNode }) { return <div className="dk-dock ps-glass ps-glass--dock">{children}</div>; }
export function Hero({ eyebrow = "NOW SELECTED", title, tagline }: { eyebrow?: string; title: string; tagline: string }) { return <section className="dk-hero"><small>● {eyebrow}</small><h1>{title}</h1><p>{tagline}</p><i /></section>; }
export function TabPills({ active }: { active: string }) { return <nav className="dk-tabs">{["Apps","Games","Launchers"].map(x => <span className={x === active ? "ps-glass ps-glass--chip on" : ""}>{x}</span>)}</nav>; }
export function HintPills() { return <footer className="dk-hints"><span className="ps-glass ps-glass--chip">× Select</span><span className="ps-glass ps-glass--chip">L1/R1 Switch tab</span><span className="ps-glass ps-glass--chip">↔ Swipe</span><span className="ps-glass ps-glass--chip">☰ Options</span></footer>; }

export const primitiveCss = `
.dk-dock{height:16cqh;display:flex;align-items:center;gap:1.1cqw;padding:1.6cqh 1.4cqw}.dk-tile{position:relative;width:8.1cqw;flex:none}.dk-icon{width:100%;aspect-ratio:1;border-radius:1.8cqh;overflow:hidden;box-shadow:0 8px 20px -12px #000}.dk-tile.is-focused .dk-icon{transform:translateY(-1.3cqh) scale(1.1);box-shadow:0 0 0 .27cqh #fff,0 0 0 .52cqh #ffffff2b,0 1.5cqh 3.5cqh -1cqh var(--ps-content-bloom),0 1.5cqh 3cqh -1cqh #000}.dk-running{position:absolute;bottom:-1cqh;left:50%;width:.58cqh;height:.58cqh;border-radius:50%;background:#fff;box-shadow:0 0 1cqh #fff}.dk-hero small{font-size:1.02cqh;letter-spacing:.18em;font-weight:800}.dk-hero h1{margin:1.35cqh 0 .8cqh;font-size:6.7cqh;line-height:.96;letter-spacing:-.055em}.dk-hero p{font-size:2.1cqh;margin:0}.dk-hero>i{display:block;width:5.2cqw;height:.25cqh;margin-top:2.8cqh;background:#fff}.dk-tabs,.dk-hints{display:flex;gap:.65cqw}.dk-tabs span,.dk-hints span{padding:.8cqh 1.1cqw;border-radius:1.1cqh}.dk-tabs .on{color:#fff}`;
