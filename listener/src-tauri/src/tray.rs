// System tray via Tauri v2's built-in TrayIconBuilder (no extra plugin needed).

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager};

pub fn build(app: &AppHandle) -> tauri::Result<()> {
    let exit = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&exit])?;

    TrayIconBuilder::with_id("ps5-listener-tray")
        .tooltip("PS5 Mode — triple-click PS to launch")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            if event.id() == "exit" {
                app.exit(0);
            }
        })
        .build(app)?;

    Ok(())
}
