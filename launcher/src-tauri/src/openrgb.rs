// Minimal, local-only OpenRGB bridge. We deliberately use OpenRGB's documented
// CLI rather than opening a network socket or shipping another RGB runtime.
use std::path::PathBuf;
use std::process::Command;

fn executable() -> Option<PathBuf> {
    [
        PathBuf::from(r"C:\Program Files\OpenRGB\OpenRGB.exe"),
        PathBuf::from(r"C:\Program Files (x86)\OpenRGB\OpenRGB.exe"),
    ].into_iter().find(|path| path.is_file())
}

pub fn open_gui() -> Result<(), String> {
    let exe = executable().ok_or("OpenRGB is not installed in its standard location.")?;
    Command::new(exe).arg("--gui").spawn().map_err(|error| error.to_string())?;
    Ok(())
}

pub fn set_scene(scene: &str) -> Result<(), String> {
    let color = match scene {
        "ice" => "75C8FF",
        "violet" => "9D7CFF",
        "warm" => "FF9A61",
        "off" => "000000",
        _ => return Err("Unknown RGB scene.".into()),
    };
    let exe = executable().ok_or("OpenRGB is not installed in its standard location.")?;
    Command::new(exe)
        .args(["--mode", "static", "--color", color])
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}
