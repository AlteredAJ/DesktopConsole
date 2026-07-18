import { ServiceIcon } from "../icons";

// Resolution-independent game backdrop: all geometry is SVG/CSS rather than a
// small bitmap, so it remains crisp on 1440p and 4K displays while a curated
// title-specific raster pack is being built.
export function GameHero({ id }: { id: string }) {
  const hue = hash(id); const title = titleFor(id);
  return <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: `linear-gradient(120deg, hsl(${hue} 42% 7%), hsl(${(hue + 34) % 360} 48% 16%), #080b10)` }}>
    <svg viewBox="0 0 3840 2160" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.9 }} aria-hidden="true">
      <defs><linearGradient id={`g-${hue}`} x1="0" x2="1"><stop stopColor={`hsl(${hue} 78% 60%)`} stopOpacity="0"/><stop offset=".6" stopColor={`hsl(${(hue + 35) % 360} 85% 67%)`} stopOpacity=".72"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient><filter id={`b-${hue}`}><feGaussianBlur stdDeviation="74"/></filter></defs>
      <circle cx="2910" cy="600" r="710" fill={`hsl(${(hue + 28) % 360} 82% 55%)`} opacity=".46" filter={`url(#b-${hue})`}/><path d="M-260 1780C820 1160 1570 2180 4050 350" fill="none" stroke={`url(#g-${hue})`} strokeWidth="260" opacity=".72"/><path d="M-110 2030C1330 1100 2180 2310 4060 820" fill="none" stroke="#fff" strokeOpacity=".1" strokeWidth="11"/>
      {[0,1,2,3,4].map((index) => <rect key={index} x={2050 + index * 240} y={180 + index * 170} width="820" height="10" fill="#fff" opacity={0.07 - index * .008} transform={`rotate(-24 ${2050 + index * 240} ${180 + index * 170})`}/>)}</svg>
    <div style={{ position: "absolute", right: "10%", top: "18%", width: "29%", aspectRatio: "1", opacity: .34, filter: "drop-shadow(0 28px 70px rgba(0,0,0,.58))" }}><ServiceIcon id={id} /></div>
    <div style={{ position: "absolute", right: "8%", bottom: "13%", color: "rgba(255,255,255,.16)", fontWeight: 900, fontSize: "clamp(2rem, 7vw, 9rem)", letterSpacing: "-.06em", textAlign: "right", maxWidth: "58%" }}>{title}</div>
  </div>;
}
function hash(value: string) { let h=0; for(let i=0;i<value.length;i++) h=(h*31+value.charCodeAt(i))>>>0; return h%360; }
function titleFor(id: string) { const part=id.split('\\').pop() ?? id; return part.replace(/\.exe$/i, "").replace(/[-_]/g," "); }
