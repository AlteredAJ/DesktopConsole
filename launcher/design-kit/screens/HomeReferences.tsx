import { Dock, Hero, HintPills, IconSurface, TabPills } from "../components/Primitives";
import { taglineFor } from "../../src/components/icons";

const apps = ["youtube","netflix","spotify","discord","browser:https://www.primevideo.com"];
const games = ["steam","exe:E:\\Control\\Control.exe","exe:E:\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe","exe:E:\\Riot Games\\VALORANT\\live\\VALORANT.exe","exe:E:\\rocketleague\\Binaries\\Win64\\RocketLeague.exe","exe:E:\\TheAltoCollection\\The Alto Collection.exe","exe:E:\\SteamLibrary\\steamapps\\common\\assettocorsa\\AssettoCorsa.exe","exe:E:\\SteamLibrary\\steamapps\\common\\BeamNG.drive\\BeamNG.drive.exe"];
const launchers = ["steam","epic","battlenet"];
export function HomeReference({ tab = "Apps" }: { tab?: "Apps" | "Games" | "Launchers" }) { const list = tab === "Apps" ? apps : tab === "Games" ? games : launchers; const focus = tab === "Apps" ? 1 : 1; const label = tab === "Apps" ? "Netflix" : tab === "Games" ? "Control" : "Steam Big Picture"; return <main className={`dk-screen dk-${tab.toLowerCase()}`}><header>PS·5 MODE <span>Home · Wi‑Fi · 9:41 PM</span></header><TabPills active={tab}/><Hero title={label} tagline={taglineFor(list[focus]) || (tab === "Games" ? "A supernatural mystery in the Oldest House" : "Your PC library, big picture")}/><Dock>{list.map((id,i)=><IconSurface id={id} focused={i===focus} running={id==="spotify"}/>)}</Dock><HintPills/></main>; }

export const homeReferenceNotes = `Games deliberately overflow the compact shelf. The focussed game remains visually centred; the unselected tile labels use single-line ellipsis. Each tab's selected content replaces --ps-content-bloom.`;
