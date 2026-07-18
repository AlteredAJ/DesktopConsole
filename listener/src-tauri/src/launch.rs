// Spawn the fullscreen launcher process on triple-click.

use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::Ordering;

use tauri::AppHandle;

/// Launch the sibling `ps5-launcher.exe`. When it exits we clear SESSION_ACTIVE so
/// the next triple-click works again.
pub fn spawn_launcher(_app: &AppHandle) {
    let exe = match launcher_exe_path() {
        Some(p) => p,
        None => {
            eprintln!("launcher exe not found next to listener");
            crate::hid::SESSION_ACTIVE.store(false, Ordering::Relaxed);
            return;
        }
    };

    match Command::new(&exe).spawn() {
        Ok(mut child) => {
            // Reap the child on its own thread so the listener stays responsive,
            // and re-arm the trigger once the session ends.
            std::thread::spawn(move || {
                let _ = child.wait();
                crate::hid::SESSION_ACTIVE.store(false, Ordering::Relaxed);
            });
        }
        Err(e) => {
            eprintln!("failed to spawn launcher: {e}");
            crate::hid::SESSION_ACTIVE.store(false, Ordering::Relaxed);
        }
    }
}

/// Resolve the launcher exe relative to the listener exe so the install layout is
/// portable. Expected side-by-side after bundling:
///   <install>/ps5-listener.exe
///   <install>/ps5-launcher.exe
/// During dev, fall back to the launcher's target/debug build.
fn launcher_exe_path() -> Option<PathBuf> {
    let dir = std::env::current_exe().ok()?.parent()?.to_path_buf();

    let sibling = dir.join("ps5-launcher.exe");
    if sibling.exists() {
        return Some(sibling);
    }

    // Dev fallback: ../../launcher/src-tauri/target/debug/ps5-launcher.exe
    // TODO(Unit A): adjust once the workspace layout is finalized.
    let dev = dir
        .join("..")
        .join("..")
        .join("..")
        .join("launcher")
        .join("src-tauri")
        .join("target")
        .join("debug")
        .join("ps5-launcher.exe");
    dev.exists().then_some(dev)
}
