// Game-library scanner â€” walks one or more drive/folder roots (e.g. "E:\"),
// finds real installed game executables, and picks the one "main" exe per
// game folder. Cached to disk (%APPDATA%/ps5-mode/game_index.json) so this
// only has to actually walk the filesystem when explicitly re-scanned (a
// fresh install, or after adding new games) â€” not on every launch.
//
// Handles two shapes:
//   - Steam library folders (`<root>/steamapps/common/<Game>`) â€” the
//     sibling `steamapps/appmanifest_*.acf` gives the real store name, so
//     tile labels aren't a raw folder name.
//   - Everything else â€” a plain top-level folder (Control, Fortnite,
//     rocketleague, ...) is treated as one game. A folder whose own files
//     don't look like a game (e.g. "Riot Games", which only contains the
//     Riot Client launcher + per-title subfolders) is expanded one level so
//     its subfolders (VALORANT, ...) are scanned as their own candidates.
//
// This is a heuristic, not a guarantee â€” see NOISE_PATTERNS below. Result is
// meant to seed config.rs's tile list / a "add to library" UI, not to be
// blindly trusted for anything destructive.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GameCandidate {
    pub id: String,    // "exe:<path>" â€” matches config.rs's AppTile.id convention
    pub label: String, // display name (Steam's official name when known, else folder name)
    pub path: String,
    pub source: String, // "steam" | "standalone"
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct GameIndex {
    pub scanned_roots: Vec<String>,
    pub games: Vec<GameCandidate>,
    /// Folders that were walked but produced no confident exe pick â€” surfaced
    /// so a human can look, instead of silently dropping them.
    pub unresolved: Vec<String>,
}

/// Folder / file name fragments (matched case-insensitively as substrings)
/// that mean "not the game's main exe" â€” installers, anti-cheat helpers,
/// redist packages, crash reporters, editor/server tools, etc.
const NOISE_PATTERNS: &[&str] = &[
    "unins", "setup", "install", "redist", "prereq", "vcredist", "vc_redist",
    "dotnetfx", "directx", "dxsetup", "crashreport", "crashhandler", "crashpad",
    "crashsender", "eac", "easyanticheat", "battleye", "webhelper", "updater", "riotclient", "riot client",
    "bootstrapper", "overlay", "servicehost", "helper", "dependencies",
    "thirdparty", "console", "showroom", "server", "servermanager",
    "statisticsreader", "versionselector", "support",
];

/// Top-level folder names that are never a game themselves (launchers,
/// redist bundles, packaged-app stores) â€” skipped entirely rather than
/// walked, so we don't waste time descending into them.
const SKIP_TOP_LEVEL: &[&str] = &[
    "$recycle.bin", "system volume information", "windowsapps",
    "directxredist", "gameinputredist", "launcher",
];

// Library roots that contain individual title folders rather than a game binary.
const CONTAINER_FOLDERS: &[&str] = &["riot games", "xbox games"];

const MAX_DEPTH: usize = 6;

fn is_noise(name_lower: &str) -> bool {
    NOISE_PATTERNS.iter().any(|p| name_lower.contains(p))
}

fn clean_label(raw: &str) -> String {
    raw.trim()
        .replace(['\u{ae}', '\u{2122}'], "") // strip Â® / â„¢
        .replace('_', " ")
        .trim()
        .to_string()
}

/// Every .exe directly under `dir`, or up to `max_depth` deep â€” bounded so a
/// game with a deep asset tree doesn't turn into a multi-minute walk.
fn find_exes(dir: &Path, max_depth: usize) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let mut stack = vec![(dir.to_path_buf(), 0usize)];
    while let Some((d, depth)) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&d) else { continue };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if depth < max_depth {
                    stack.push((path, depth + 1));
                }
            } else if path.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("exe")).unwrap_or(false) {
                out.push(path);
            }
        }
    }
    out
}

/// Pick the best candidate exe for a game folder: filter obvious noise, then
/// prefer the one whose filename most closely matches the folder name,
/// falling back to the largest remaining file (real game binaries dwarf
/// leftover helper tools in size).
fn pick_main_exe(folder_name: &str, exes: &[PathBuf]) -> Option<PathBuf> {
    // Publisher/library roots need one candidate per child title, not one
    // arbitrary nested executable labeled after the container.
    if CONTAINER_FOLDERS.iter().any(|name| name.eq_ignore_ascii_case(folder_name)) {
        return None;
    }
    let folder_key: String = folder_name.chars().filter(|c| c.is_alphanumeric()).collect::<String>().to_lowercase();

    let candidates: Vec<&PathBuf> = exes
        .iter()
        .filter(|p| {
            let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
            !is_noise(&stem)
        })
        .collect();
    if candidates.is_empty() {
        return None;
    }

    if let Some(exact) = candidates.iter().find(|p| {
        let stem_key: String = p
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .chars()
            .filter(|c| c.is_alphanumeric())
            .collect::<String>()
            .to_lowercase();
        !folder_key.is_empty() && (stem_key == folder_key || stem_key.starts_with(&folder_key))
    }) {
        return Some((*exact).clone());
    }

    candidates
        .into_iter()
        .max_by_key(|p| std::fs::metadata(p).map(|m| m.len()).unwrap_or(0))
        .cloned()
}

fn steam_appmanifest_names(steamapps_dir: &Path) -> HashMap<String, String> {
    // installdir -> official store name, read from appmanifest_<id>.acf's
    // "installdir"/"name" fields (simple line-based parse â€” full VDF syntax
    // isn't needed for these two flat fields).
    let mut map = HashMap::new();
    let Ok(entries) = std::fs::read_dir(steamapps_dir) else { return map };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("acf") {
            continue;
        }
        let Ok(text) = std::fs::read_to_string(&path) else { continue };
        // VDF is a simple `"key"    "value"` line format for the two flat
        // fields we need â€” no need for a full VDF parser.
        let field = |key: &str| -> Option<String> {
            text.lines().find_map(|line| {
                let line = line.trim();
                if !line.starts_with(&format!("\"{key}\"")) {
                    return None;
                }
                let last_quote = line.rfind('"')?;
                let value_start = line[..last_quote].trim_end().rfind('"')? + 1;
                Some(line[value_start..last_quote].to_string())
            })
        };
        if let (Some(installdir), Some(name)) = (field("installdir"), field("name")) {
            map.insert(installdir, clean_label(&name));
        }
    }
    map
}

/// `steamapps_dir` is the `steamapps` folder itself (its `common/` holds the
/// games, its `appmanifest_*.acf` files give their official names).
fn scan_steam_library(steamapps_dir: &Path, unresolved: &mut Vec<String>) -> Vec<GameCandidate> {
    let common = steamapps_dir.join("common");
    let names = steam_appmanifest_names(steamapps_dir);
    let mut out = Vec::new();
    let Ok(entries) = std::fs::read_dir(&common) else { return out };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let folder_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
        let exes = find_exes(&path, 3); // steam titles are rarely nested deep
        match pick_main_exe(&folder_name, &exes) {
            Some(exe) => {
                let label = names.get(&folder_name).cloned().unwrap_or_else(|| clean_label(&folder_name));
                out.push(GameCandidate {
                    id: format!("exe:{}", exe.display()),
                    label,
                    path: exe.display().to_string(),
                    source: "steam".to_string(),
                });
            }
            None => unresolved.push(path.display().to_string()),
        }
    }
    out
}

/// Scan one root (a drive like `E:\` or any folder). Steam libraries are
/// detected by the presence of a `steamapps` subfolder; everything else is
/// treated as a flat list of top-level game folders, with one level of
/// expansion for "container" folders that hold sub-games instead of being
/// one themselves (e.g. a publisher's own multi-title folder).
pub fn scan_root(root: &Path) -> (Vec<GameCandidate>, Vec<String>) {
    let mut games = Vec::new();
    let mut unresolved = Vec::new();

    let Ok(entries) = std::fs::read_dir(root) else { return (games, unresolved) };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
        let name_lower = name.to_lowercase();
        if SKIP_TOP_LEVEL.contains(&name_lower.as_str()) {
            continue;
        }

        if path.join("steamapps").is_dir() {
            games.extend(scan_steam_library(&path.join("steamapps"), &mut unresolved));
            continue;
        }

        let exes = find_exes(&path, MAX_DEPTH);
        match pick_main_exe(&name, &exes) {
            Some(exe) => games.push(GameCandidate {
                id: format!("exe:{}", exe.display()),
                label: clean_label(&name),
                path: exe.display().to_string(),
                source: "standalone".to_string(),
            }),
            None => {
                // No confident pick at this level â€” this is exactly the
                // "container folder" shape (e.g. a publisher folder holding
                // a launcher + several per-title subfolders). Expand one
                // level and scan each subfolder as its own candidate instead
                // of giving up.
                let mut found_any = false;
                if let Ok(subentries) = std::fs::read_dir(&path) {
                    for sub in subentries.flatten() {
                        let sub_path = sub.path();
                        if !sub_path.is_dir() {
                            continue;
                        }
                        let sub_name = sub_path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                        let sub_exes = find_exes(&sub_path, MAX_DEPTH - 1);
                        if let Some(exe) = pick_main_exe(&sub_name, &sub_exes) {
                            games.push(GameCandidate {
                                id: format!("exe:{}", exe.display()),
                                label: clean_label(&sub_name),
                                path: exe.display().to_string(),
                                source: "standalone".to_string(),
                            });
                            found_any = true;
                        }
                    }
                }
                if !found_any {
                    unresolved.push(path.display().to_string());
                }
            }
        }
    }

    (games, unresolved)
}

fn index_path() -> Option<PathBuf> {
    Some(dirs::config_dir()?.join("ps5-mode").join("game_index.json"))
}

/// Scan every given root, write the merged result to the on-disk cache, and
/// return it. This is the only path that touches the filesystem â€” everything
/// else reads the cache.
pub fn scan_and_cache(roots: &[String]) -> GameIndex {
    let mut all_games = Vec::new();
    let mut all_unresolved = Vec::new();
    for root in roots {
        let (games, unresolved) = scan_root(Path::new(root));
        all_games.extend(games);
        all_unresolved.extend(unresolved);
    }
    let index = GameIndex {
        scanned_roots: roots.to_vec(),
        games: all_games,
        unresolved: all_unresolved,
    };
    if let Some(p) = index_path() {
        if let Some(dir) = p.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(p, serde_json::to_string_pretty(&index).unwrap_or_default());
    }
    index
}

/// Read the cached index without touching the filesystem. Empty if a scan
/// has never been run.
pub fn cached_index() -> GameIndex {
    let Some(p) = index_path() else { return GameIndex::default() };
    let Ok(text) = std::fs::read_to_string(p) else { return GameIndex::default() };
    serde_json::from_str(&text).unwrap_or_default()
}
