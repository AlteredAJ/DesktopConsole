// UNIT C — launch external apps / streaming services.
//
// CRITICAL (from research): Netflix CANNOT be embedded in a WebView (WebView2 lacks
// Widevine Verified Media Path). Only YouTube embeds — that's handled in the frontend
// (<YouTubeEmbed>). Everything here launches EXTERNALLY via URI scheme, with a
// default-browser fallback when no scheme handler is registered.

use std::process::Command;

/// Launch a tile by its config id. Ids: "youtube" (external browser fallback),
/// "netflix", "discord", "steam", "spotify", "epic", "battlenet",
/// "browser:<url>", or "exe:<path>" for a standalone local game.
pub fn launch(target: &str) -> std::io::Result<()> {
    if let Some(path) = target.strip_prefix("exe:") {
        Command::new(path).spawn()?;
        return Ok(());
    }

    let uri = match target {
        "netflix" => "netflix:".to_string(),
        "discord" => "discord:".to_string(),
        "steam" => "steam://open/bigpicture".to_string(),
        "youtube" => "https://www.youtube.com/tv".to_string(),
        "spotify" => "spotify:".to_string(),
        // Epic's own launcher registers this scheme; opens straight to the app.
        "epic" => "com.epicgames.launcher://start".to_string(),
        "battlenet" => "battlenet://".to_string(),
        other if other.starts_with("browser:") => {
            other.trim_start_matches("browser:").to_string()
        }
        other => {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("unknown launch target: {other}"),
            ));
        }
    };

    open_external(&uri)
}

/// Hand the URI to the shell. `start` resolves both custom schemes (netflix:, steam:)
/// and plain URLs (-> default browser) — and when a scheme has no handler, Windows
/// falls back to a browser search or a "how do you want to open this" prompt rather
/// than erroring, which is acceptable for v1.
fn open_external(uri: &str) -> std::io::Result<()> {
    // `cmd /C start "" <uri>` — the empty "" is the window title arg `start` eats.
    Command::new("cmd").args(["/C", "start", "", uri]).spawn()?;
    Ok(())
}

// TODO(Unit C):
//   - After launching, tell the frontend to hide the launcher window (PS+Options
//     re-summons it). Consider a `launched` event so the UI can show a "press
//     PS+Options to return" hint.
//   - Optional: use sysinfo to detect already-running Discord/Steam and focus
//     instead of relaunching.
