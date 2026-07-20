//! Settings > About — the "console spec sheet" half.
//!
//! Deliberately built from what's already here: `sysinfo` is an existing
//! dependency (used by active_apps/audio) and `EnumDisplayDevices` comes from
//! the `Win32_Graphics_Gdi` feature `display.rs` already pulls in. No new
//! crates for a read-only info screen.
//!
//! Everything here is best-effort. A missing field reports as `None` and the UI
//! omits that row rather than showing a fabricated value — an About page that
//! confidently states the wrong GPU is worse than one that stays quiet.

use serde::Serialize;

#[derive(Serialize, Default)]
pub struct SystemInfo {
    pub cpu: Option<String>,
    pub cpu_cores: Option<usize>,
    pub gpus: Vec<String>,
    /// Bytes. Formatted UI-side so the units match the rest of the app.
    pub memory_total: Option<u64>,
    pub os_name: Option<String>,
    pub os_version: Option<String>,
    pub kernel_version: Option<String>,
    /// App version from Cargo, and the WebView2 runtime actually rendering us —
    /// a runtime mismatch is a real failure mode worth being able to read off.
    pub app_version: String,
    pub webview_version: Option<String>,
    pub config_path: Option<String>,
}

/// Adapter descriptions via EnumDisplayDevices. Duplicates are common (one
/// entry per attached monitor on the same adapter), so they're collapsed.
#[cfg(windows)]
fn gpus() -> Vec<String> {
    use windows::core::PCWSTR;
    use windows::Win32::Graphics::Gdi::{EnumDisplayDevicesW, DISPLAY_DEVICEW};

    let mut found: Vec<String> = Vec::new();
    let mut index = 0u32;
    loop {
        let mut device = DISPLAY_DEVICEW {
            cb: std::mem::size_of::<DISPLAY_DEVICEW>() as u32,
            ..Default::default()
        };
        let ok = unsafe { EnumDisplayDevicesW(PCWSTR::null(), index, &mut device, 0) };
        if !ok.as_bool() {
            break;
        }
        index += 1;
        let name = String::from_utf16_lossy(&device.DeviceString);
        let name = name.trim_end_matches('\0').trim().to_string();
        if !name.is_empty() && !found.contains(&name) {
            found.push(name);
        }
        // Defensive: EnumDisplayDevices is an unbounded loop by contract.
        if index > 32 {
            break;
        }
    }
    found
}

#[cfg(not(windows))]
fn gpus() -> Vec<String> {
    Vec::new()
}

#[tauri::command]
pub fn system_info() -> SystemInfo {
    use sysinfo::System;

    // Only what's needed — a full new_all() refreshes every process, which is
    // far more work than an info screen justifies.
    let mut sys = System::new();
    sys.refresh_cpu_all();
    sys.refresh_memory();

    let cpu = sys.cpus().first().map(|c| c.brand().trim().to_string()).filter(|s| !s.is_empty());
    let cpu_cores = sys.physical_core_count();

    SystemInfo {
        cpu,
        cpu_cores,
        gpus: gpus(),
        memory_total: Some(sys.total_memory()).filter(|b| *b > 0),
        os_name: System::name(),
        os_version: System::os_version(),
        kernel_version: System::kernel_version(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        webview_version: tauri::webview_version().ok(),
        config_path: dirs::config_dir()
            .map(|d| d.join("ps5-mode").join("config.json").display().to_string()),
    }
}
