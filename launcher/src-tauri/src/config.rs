// Persisted config. Same serde + `dirs` pattern as dualsense-haptics settings.rs:1-28.
// Stored at %APPDATA%/ps5-mode/config.json.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::display::DisplayMode;

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct AppConfig {
    /// Preferred display mode to apply on launch (None = leave desktop as-is).
    #[serde(default)]
    pub default_display: Option<DisplayMode>,

    /// Tiles shown on the grid, in order. Extensible without a rebuild.
    #[serde(default)]
    pub apps: Vec<AppTile>,

    /// Trackpad-as-mouse sensitivity (screen pixels per touchpad unit) — read
    /// by the LISTENER process too (cursor_mode.rs), not just this one, since
    /// that's where the global trackpad-mouse gesture actually lives. Default
    /// matches the original hardcoded SENS constant.
    #[serde(default = "default_cursor_sensitivity")]
    pub cursor_sensitivity: f32,
}

fn default_cursor_sensitivity() -> f32 {
    1.6
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AppTile {
    pub id: String,          // "youtube" | "netflix" | "discord" | "steam" | "browser:<url>"
    pub label: String,       // display name
    #[serde(default)]
    pub icon: Option<String>, // path or data-uri; None = default glyph
    #[serde(default = "default_category")]
    pub category: String, // "apps" | "games" | "launchers"
    #[serde(default)]
    pub needs_cursor: bool, // touchpad drives real OS cursor while this tile's app has focus
    /// Game tiles only. Same "exe:<path>" scheme as `id` — a trainer binary
    /// launched independently of the game itself. None = no Trainer option
    /// shown for this tile (most games won't have one).
    #[serde(default)]
    pub trainer: Option<String>,
}

fn default_category() -> String {
    "apps".into()
}

impl AppConfig {
    pub fn path() -> Option<PathBuf> {
        Some(dirs::config_dir()?.join("ps5-mode").join("config.json"))
    }

    pub fn load() -> AppConfig {
        let Some(p) = Self::path() else { return Self::seeded() };
        match std::fs::read_to_string(&p) {
            Ok(txt) => serde_json::from_str(&txt).unwrap_or_else(|_| Self::seeded()),
            Err(_) => Self::seeded(),
        }
    }

    pub fn save(&self) -> std::io::Result<()> {
        let Some(p) = Self::path() else {
            return Err(std::io::Error::other("no config dir"));
        };
        if let Some(dir) = p.parent() {
            std::fs::create_dir_all(dir)?;
        }
        std::fs::write(p, serde_json::to_string_pretty(self).unwrap())
    }

    /// First-run defaults — mirrors the tile set that used to be hardcoded in
    /// Launcher.tsx (ALL_TILES). Once this file exists on disk, it wins; this
    /// only seeds a brand-new install.
    fn seeded() -> AppConfig {
        let tile = |id: &str, label: &str, category: &str, needs_cursor: bool| AppTile {
            id: id.into(),
            label: label.into(),
            icon: None,
            category: category.into(),
            needs_cursor,
            trainer: None,
        };
        AppConfig {
            default_display: None,
            apps: vec![
                tile("youtube", "YouTube", "apps", false),
                // Netflix via the browser (not the app scheme): WebView2 can't
                // play it (no Widevine VMP), and the browser gives the highest
                // quality with content protection intact.
                tile("browser:https://www.netflix.com/browse", "Netflix", "apps", true),
                tile("spotify", "Spotify", "apps", false),
                tile("discord", "Discord", "apps", false),
                tile("browser:https://www.primevideo.com", "Prime Video", "apps", true),
                // Streaming apps installed as Chrome PWAs (chromeless app windows);
                // launched via their Desktop\Apps shortcuts. See app_launch.rs "lnk:".
                tile("lnk:C:\\Users\\Altered\\Desktop\\Apps\\Disney+.lnk", "Disney+", "apps", true),
                tile("lnk:C:\\Users\\Altered\\Desktop\\Apps\\Hulu.lnk", "Hulu", "apps", true),
                tile("lnk:C:\\Users\\Altered\\Desktop\\Apps\\FMHY - freemediaheckyeah.lnk", "FMHY", "apps", true),
                tile("browser:https://cinebolt.org/", "Cinebolt", "apps", true),
                tile("browser:https://www.google.com", "Browser", "apps", true),
                // Seeded from a game_scan.rs scan of this machine's E:\ on
                // 2026-07-14 — the previous hardcoded set pointed at an
                // "E:\Games\..." folder that doesn't exist on this install.
                tile("steam", "Steam", "games", false),
                tile("exe:E:\\Control\\Control.exe", "Control", "games", false),
                tile("exe:E:\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe", "Fortnite", "games", false),
                tile("exe:E:\\Riot Games\\VALORANT\\live\\VALORANT.exe", "VALORANT", "games", false),
                tile("exe:E:\\rocketleague\\Binaries\\Win64\\RocketLeague.exe", "Rocket League", "games", false),
                tile("exe:E:\\TheAltoCollection\\The Alto Collection.exe", "The Alto Collection", "games", false),
                tile("exe:E:\\SteamLibrary\\steamapps\\common\\F1 23\\F1_23.exe", "F1 23", "games", false),
                tile("exe:E:\\SteamLibrary\\steamapps\\common\\assettocorsa\\AssettoCorsa.exe", "Assetto Corsa", "games", false),
                tile("exe:E:\\SteamLibrary\\steamapps\\common\\BeamNG.drive\\BeamNG.drive.exe", "BeamNG.drive", "games", false),
                tile("steam", "Steam Big Picture", "launchers", false),
                tile("epic", "Epic Games", "launchers", true),
                tile("battlenet", "Battle.net", "launchers", true),
                tile("exe:E:\\Riot Games\\Riot Client\\RiotClientElectron\\Riot Client.exe", "Riot Client", "launchers", true),
            ],
            cursor_sensitivity: default_cursor_sensitivity(),
        }
    }
}
