// PS5 Mode Ã¢â‚¬â€ fullscreen launcher.
//
// UNIT A skeleton; B/C/D extend it. Boots a fullscreen borderless window, streams
// controller state to the frontend, and handles the PS+Options exit combo.

mod hid;
mod commands;
mod config;
mod bt_wake;
mod rumble;
mod power;
mod active_apps;

// Unit B Ã¢â‚¬â€ swipe detection lives in the frontend (useTouchpad.ts) since it
// already consumes the pad-state stream; mouse_inject stays backend-side since
// it injects real OS cursor events.
mod mouse_inject;
// Desktop Mode text entry via SendInput (see send_text.rs for why that API and
// not any form of injection).
mod send_text;
// Unit C
mod app_launch;
// Unit D
mod display;
// Settings: Audio/Network/Bluetooth/Game Mode
mod audio;
mod network;
mod bluetooth;
mod gamemode;
mod icon_extract;
mod game_scan;
mod openrgb;
mod live_backdrop;
// Settings > About - read-only spec sheet (see system_info.rs).
mod system_info;

use tauri::Manager;

pub fn run() {
    // Prefer a colocated fixed WebView2 runtime when this build is shipped
    // with one. Otherwise use Windows' installed Evergreen runtime. Never
    // depend on another project or a particular Windows user profile.
    #[cfg(windows)]
    {
        let mut runtime_candidates = Vec::new();
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                runtime_candidates.push(dir.join("wv2runtime"));
                runtime_candidates.push(dir.join("resources").join("wv2runtime"));
            }
        }
        runtime_candidates.push(std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("wv2runtime"));
        if let Some(runtime) = runtime_candidates
            .into_iter()
            .find(|path| path.join("msedgewebview2.exe").exists())
        {
            std::env::set_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", &runtime);
            eprintln!("[wv2] using bundled runtime at {}", runtime.display());
        }
    }

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::get_controller_state,
            commands::launch_app,        // Unit C
            commands::list_display_modes, // Unit D
            commands::set_display_mode,   // Unit D
            commands::exit_mode,
            commands::minimize_console,
            commands::show_console_window,
            commands::hide_quick_overlay_command,
            commands::open_console_home,
            commands::get_overlay_context,
            commands::open_rgb_controls,
            commands::set_rgb_scene,
            commands::haptic_confirm,
            commands::haptic_select,
            commands::set_cursor_mode,
            commands::enter_idle_power_save,
            commands::exit_idle_power_save,
            commands::running_tile_ids,
            commands::get_config,
            commands::save_config,
            commands::get_cursor_sensitivity,
            commands::set_cursor_sensitivity,
            commands::get_master_volume,
            commands::set_master_volume,
            commands::get_master_mute,
            commands::set_master_mute,
            commands::open_audio_device_picker,
            commands::get_mixer_sessions,
            commands::set_session_volume,
            commands::set_session_mute,
            commands::wifi_status,
            commands::wifi_scan,
            commands::wifi_connect,
            commands::wifi_disconnect,
            commands::open_location_settings,
            commands::bluetooth_enabled,
            commands::set_bluetooth_enabled,
            commands::bluetooth_paired_devices,
            commands::game_mode_enabled,
            commands::set_game_mode_enabled,
            commands::extract_tile_icon,
            commands::lock_workstation,
            commands::sleep_machine,
            commands::shutdown_machine,
            commands::close_tile_app,
            commands::launch_trainer,
            commands::scan_game_library,
            commands::sync_game_library,
            commands::get_game_index,
            commands::prepare_live_backdrop,
            send_text::send_text,
            system_info::system_info,
        ])
        .setup(|app| {
            rumble::init();
            #[cfg(windows)]
            mouse_inject::init();
            // Unit D: snapshot the current display mode + arm crash-safe restore
            // BEFORE anything can change it.
            #[cfg(windows)]
            display::install_panic_restore_hook();

            // Show the window only after setup so we never flash a half-built frame.
            // NOTE: this silently no-ops if "main" doesn't match tauri.conf.json's
            // window label Ã¢â‚¬â€ cost us a debugging session once already. If the
            // window never appears, check that label match first.
            match app.get_webview_window("main") {
                Some(win) => {
                    // Focus is not console state. The click-through overlay can
                    // legitimately make this window lose focus while the console
                    // is still visible; only explicit yield/restore commands may
                    // change YIELDED.
                    let _ = win.show();
                    let _ = win.set_focus();
                }
                None => eprintln!(
                    "FATAL: no webview window labeled \"main\" Ã¢â‚¬â€ check tauri.conf.json"
                ),
            }

            // Prewarm the hidden quick menu now so opening it in-game is a
            // cheap visibility change rather than a second WebView2 startup.
            commands::prewarm_quick_overlay(&app.handle().clone());

            hid::spawn_input_thread(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running PS5 launcher");
}
