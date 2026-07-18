// Prevents an extra console window on Windows in release builds.
// NOTE: keep this a plain `windows` subsystem so the tray app has no console.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ps5_listener_lib::run()
}
