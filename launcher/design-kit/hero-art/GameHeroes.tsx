type Scene = "control" | "fortnite" | "valorant" | "rocket" | "alto" | "f1" | "assetto" | "beam";

function GameScene({ kind, title, color }: { kind: Scene; title: string; color: string }) {
  const gid = `game-${kind}`;
  return <svg viewBox="0 0 1600 900" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
    <defs>
      <radialGradient id={`${gid}-g`} cx="67%" cy="42%" r="64%"><stop stopColor={color} stopOpacity=".8"/><stop offset=".5" stopColor={color} stopOpacity=".18"/><stop offset="1" stopColor="#05070b" stopOpacity="0"/></radialGradient>
      <linearGradient id={`${gid}-v`} x1="0" x2="1"><stop stopColor="#07090e" stopOpacity=".9"/><stop offset=".56" stopColor="#07090e" stopOpacity=".15"/><stop offset="1" stopColor="#07090e" stopOpacity=".48"/></linearGradient>
    </defs>
    <rect width="1600" height="900" fill="#0a0d13"/><rect width="1600" height="900" fill={`url(#${gid}-g)`}/>
    {kind === "control" && <><g fill="#d8343d" opacity=".46"><rect x="960" y="-80" width="160" height="460"/><rect x="1170" y="150" width="240" height="600"/><rect x="760" y="460" width="310" height="150"/></g><g stroke="#e9e4db" strokeWidth="8" opacity=".16"><path d="M770 120h620M700 350h560M810 620h550"/></g></>}
    {kind === "fortnite" && <><path d="M700 700 980 280l170 235 150-370 210 555z" fill="#7560ff" opacity=".46"/><circle cx="1240" cy="240" r="95" fill="#ff63d8" opacity=".42"/><path d="M710 735q370-160 850-20" fill="none" stroke="#59d5ff" strokeWidth="16" opacity=".55"/></>}
    {kind === "valorant" && <><path d="M1040 110 1450 450 1040 790 1220 450z" fill="#ff4655" opacity=".54"/><path d="m760 450 320-310-160 310 160 310z" fill="#ff4655" opacity=".27"/><g stroke="#77e2d3" strokeWidth="3" opacity=".45"><path d="M760 180h680M700 720h720M860 100v700"/></g></>}
    {kind === "rocket" && <><ellipse cx="1190" cy="420" rx="430" ry="220" fill="none" stroke="#3ec9ff" strokeWidth="16" opacity=".35"/><path d="M800 650q270-430 600-250" fill="none" stroke="#ff9a3d" strokeWidth="30" opacity=".72"/><circle cx="1300" cy="280" r="58" fill="#fff" opacity=".72"/></>}
    {kind === "alto" && <><path d="M620 760 1010 260l190 255 145-160 250 405z" fill="#d69680" opacity=".48"/><circle cx="1240" cy="260" r="115" fill="#ffd9a7" opacity=".52"/><path d="M650 735q400-100 900 35" fill="none" stroke="#f4e7df" strokeWidth="8" opacity=".46"/></>}
    {kind === "f1" && <><path d="M730 690h670l-130-95h-115l-80-220h-90l-65 220H815z" fill="#d82f38" opacity=".62"/><path d="M780 730h590" stroke="#f1e9e9" strokeWidth="9" opacity=".5"/><g stroke="#fff" strokeWidth="4" opacity=".2"><path d="M780 180h600M740 270h770M760 360h680"/></g></>}
    {kind === "assetto" && <><path d="M650 750Q880 350 1080 470t430 280" fill="none" stroke="#aeb7c3" strokeWidth="44" opacity=".38"/><path d="M700 750Q930 350 1130 470t390 270" fill="none" stroke="#f8f8f8" strokeWidth="4" strokeDasharray="20 24" opacity=".55"/><g stroke="#7d8792" strokeWidth="2" opacity=".42">{Array.from({length:10}).map((_,i)=><path key={i} d={`M${740+i*70} 100v650`}/>)}</g></>}
    {kind === "beam" && <><g fill="#e88936" opacity=".54"><rect x="890" y="180" width="370" height="70"/><rect x="1120" y="240" width="70" height="430"/><rect x="760" y="610" width="580" height="60"/></g><g stroke="#bec5c8" strokeWidth="6" opacity=".22"><path d="M780 160 1400 750M780 750l620-590"/></g></>}
    <text x="1090" y="780" fill="#fff" fontSize="72" fontWeight="800" letterSpacing="14" textAnchor="middle" opacity=".82">{title.toUpperCase()}</text><rect width="1600" height="900" fill={`url(#${gid}-v)`}/>
  </svg>;
}
export const ControlHero=()=> <GameScene kind="control" title="Control" color="#e3313a"/>;
export const FortniteHero=()=> <GameScene kind="fortnite" title="Fortnite" color="#775cff"/>;
export const ValorantHero=()=> <GameScene kind="valorant" title="VALORANT" color="#ff4655"/>;
export const RocketLeagueHero=()=> <GameScene kind="rocket" title="Rocket League" color="#1baeff"/>;
export const AltoHero=()=> <GameScene kind="alto" title="The Alto Collection" color="#d79681"/>;
export const F1Hero=()=> <GameScene kind="f1" title="F1 23" color="#d82f38"/>;
export const AssettoHero=()=> <GameScene kind="assetto" title="Assetto Corsa" color="#aeb7c3"/>;
export const BeamHero=()=> <GameScene kind="beam" title="BeamNG.drive" color="#e88936"/>;
