// PS5 Mode — background listener (tray-resident).
//
// UNIT A. Responsibilities:
//   1. Poll the DualSense over HID (reuse find_dualsense() + read loop).
//   2. Detect a PS-button triple-click (triple_click.rs).
//   3. On trigger, spawn the fullscreen launcher (launch.rs).
//   4. Live in the system tray with an Exit item (tray.rs).
//   5. Autostart on boot (tauri-plugin-autostart).
//
// This process stays resident. When the launcher is running we keep polling so a
// second triple-click is ignored while a session is active (see hid.rs guard).

mod hid;
mod tray;
mod launch;
mod triple_click;
mod bt_wake;
mod cursor_mode;
mod rumble;

use tauri_plugin_autostart::MacosLauncher;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None, // no extra args
        ))
        .setup(|app| {
            // Enable autostart on first run (idempotent).
            #[cfg(desktop)]
            {
                use tauri_plugin_autostart::ManagerExt;
                let autostart = app.autolaunch();
                let _ = autostart.enable();
            }

            tray::build(app.handle())?;
            hid::spawn_listener_thread(app.handle().clone());
            Ok(())
        })
        // Tray-only app: keep running with no windows open.
        .build(tauri::generate_context!())
        .expect("error while building PS5 listener")
        .run(|_app, event| {
            if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
                // `code` is None for an implicit "last window closed" request —
                // keep the tray process alive in that case. An explicit
                // `app.exit(n)` from the tray's Exit item carries Some(n); let
                // that one through so Exit actually quits.
                if code.is_none() {
                    api.prevent_exit();
                }
            }
        });
}
