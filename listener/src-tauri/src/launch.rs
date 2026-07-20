// Spawn the fullscreen launcher process on triple-click.

use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicU32, Ordering};

use tauri::AppHandle;

/// PID of the live launcher process, or 0 when none is running.
///
/// The launcher is a SEPARATE process we spawn — killing the listener does not
/// touch it. Without this, tray > Exit left `ps5-launcher.exe` alive: hidden,
/// but still polling the DualSense at 60Hz and holding a WebView2 manager, so
/// the console kept reacting to input after the user thought they'd quit.
static LAUNCHER_PID: AtomicU32 = AtomicU32::new(0);

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
            LAUNCHER_PID.store(child.id(), Ordering::Relaxed);
            // Reap the child on its own thread so the listener stays responsive,
            // and re-arm the trigger once the session ends.
            std::thread::spawn(move || {
                let _ = child.wait();
                LAUNCHER_PID.store(0, Ordering::Relaxed);
                crate::hid::SESSION_ACTIVE.store(false, Ordering::Relaxed);
            });
        }
        Err(e) => {
            eprintln!("failed to spawn launcher: {e}");
            crate::hid::SESSION_ACTIVE.store(false, Ordering::Relaxed);
        }
    }
}

/// Terminate the launcher process, if one is running. Called from tray > Exit so
/// quitting actually quits everything instead of orphaning a hidden launcher that
/// keeps reading the controller.
pub fn kill_launcher() {
    let pid = LAUNCHER_PID.swap(0, Ordering::Relaxed);
    if pid == 0 {
        return;
    }
    #[cfg(windows)]
    {
        // /T also takes any child processes the launcher itself spawned
        // (WebView2 host processes), which are what actually keep the
        // "WebView2 manager still active" symptom alive.
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .status();
    }
    crate::hid::SESSION_ACTIVE.store(false, Ordering::Relaxed);
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
