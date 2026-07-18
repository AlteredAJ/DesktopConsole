import { ServiceIcon } from "../../src/components/icons";

/** Raised iOS-like icon treatment. Always keep the real ServiceIcon mark. */
export function GlassAppIcon({ id, focused = false }: { id: string; focused?: boolean }) {
  return <div className={`icon-surface ${focused ? "is-focused" : ""} ${id.includes("primevideo") ? "is-prime" : ""}`}><ServiceIcon id={id}/></div>;
}

export const iconSurfaceCss = `
.icon-surface{position:relative;isolation:isolate;overflow:hidden;border-radius:22%;background:linear-gradient(145deg,#ffffff18,#080a0e 70%);box-shadow:0 1.2cqh 2.4cqh -1.5cqh #000,0 .08cqh 0 #ffffff3d inset,0 -.12cqh .3cqh #0008 inset}.icon-surface:before{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(145deg,#fff3,transparent 45%),radial-gradient(100% 60% at 90% 110%,#0009,transparent 65%)}.icon-surface:after{content:"";position:absolute;inset:.16cqh;border-radius:inherit;pointer-events:none;border:1px solid #fff2}.icon-surface.is-focused{box-shadow:0 0 0 .27cqh #fff,0 0 0 .52cqh #ffffff2b,0 1.5cqh 3.5cqh -1cqh var(--ps-content-bloom),0 1.5cqh 3cqh -1cqh #000}.icon-surface.is-prime{background:linear-gradient(145deg,#075b83,#012233 72%)}.icon-surface.is-prime:before{background:linear-gradient(145deg,#fff2,transparent 42%),repeating-linear-gradient(135deg,#ffffff0a 0 1px,transparent 1px 7px),radial-gradient(100% 65% at 84% 100%,#000b,transparent 68%)}`;
