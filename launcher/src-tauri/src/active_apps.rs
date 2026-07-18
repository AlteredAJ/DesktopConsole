// Live "what's currently running" detection — PS5-switcher-style, minus the
// actual overlay-over-fullscreen-games part (agreed to skip that, it's hard
// and fragile). This just answers "is app X running right now" by matching
// known process names against the live process list, so the frontend can put
// a small active-indicator dot on the matching tile.

use sysinfo::System;

/// Known launch target -> process name(s) that indicate it's running. Matched
/// case-insensitively against the process executable name (no extension).
/// "exe:" targets aren't listed here — see running_tile_ids, which derives
/// their process name directly from the path instead of needing an entry.
fn known_process_names(tile_id: &str) -> &'static [&'static str] {
    match tile_id {
        "discord" => &["Discord"],
        "spotify" => &["Spotify"],
        "steam" => &["steam"],
        "epic" => &["EpicGamesLauncher"],
        "battlenet" => &["Battle.net"],
        _ => &[],
    }
}

/// Returns which of the given tile ids currently have a matching process
/// running. `exe:` ids are matched by the executable's own file stem; named
/// service ids (discord, steam, etc) use the table above.
pub fn running_tile_ids(tile_ids: &[String]) -> Vec<String> {
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All);

    let running: Vec<String> = sys
        .processes()
        .values()
        .filter_map(|p| p.name().to_str())
        .map(|n| n.trim_end_matches(".exe").to_lowercase())
        .collect();

    tile_ids
        .iter()
        .filter(|id| {
            if let Some(path) = id.strip_prefix("exe:") {
                let stem = std::path::Path::new(path)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                !stem.is_empty() && running.contains(&stem)
            } else {
                known_process_names(id)
                    .iter()
                    .any(|name| running.contains(&name.to_lowercase()))
            }
        })
        .cloned()
        .collect()
}

/// PS5-style "Close Application" — terminates every process matching the
/// same name rule running_tile_ids uses to detect it (kills all matches, not
/// just the first, in case a game spawns a same-named helper/child process).
/// Returns true if at least one process was actually killed.
pub fn kill_tile(tile_id: &str) -> bool {
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All);

    let target_stem = tile_id.strip_prefix("exe:").map(|path| {
        std::path::Path::new(path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase()
    });
    let known_names: Vec<String> = known_process_names(tile_id).iter().map(|n| n.to_lowercase()).collect();

    let mut killed_any = false;
    for p in sys.processes().values() {
        let Some(name) = p.name().to_str() else { continue };
        let stem = name.trim_end_matches(".exe").to_lowercase();
        let matches = target_stem.as_deref().map(|t| !t.is_empty() && t == stem).unwrap_or(false)
            || known_names.contains(&stem);
        if matches && p.kill() {
            killed_any = true;
        }
    }
    killed_any
}
