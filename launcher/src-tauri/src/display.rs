// UNIT D — resolution / refresh-rate switching via Win32 (windows crate).
//
// Rules (from plan):
//   1. ENUMERATE actual supported modes (EnumDisplaySettingsW) — never hardcode the
//      1080/1440/4K x 120/144/240/360 grid; most monitors can't do arbitrary pairs.
//   2. ALWAYS restore the original mode on exit AND on crash (panic hook) — otherwise
//      a failed 4K/360 switch can strand the desktop until reboot.

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub struct DisplayMode {
    pub width: u32,
    pub height: u32,
    pub hz: u32,
}

#[cfg(windows)]
mod win {
    use super::DisplayMode;
    use std::sync::OnceLock;

    use windows::core::PCWSTR;
    use windows::Win32::Graphics::Gdi::{
        ChangeDisplaySettingsExW, EnumDisplaySettingsW, CDS_TYPE, DEVMODEW,
        DISP_CHANGE_SUCCESSFUL, ENUM_CURRENT_SETTINGS, ENUM_DISPLAY_SETTINGS_MODE,
    };

    // Snapshot of the desktop mode captured before we touch anything.
    static ORIGINAL: OnceLock<DisplayMode> = OnceLock::new();

    fn devmode_zeroed() -> DEVMODEW {
        let mut dm: DEVMODEW = unsafe { std::mem::zeroed() };
        dm.dmSize = std::mem::size_of::<DEVMODEW>() as u16;
        dm
    }

    fn current_mode() -> Option<DisplayMode> {
        let mut dm = devmode_zeroed();
        let ok = unsafe {
            EnumDisplaySettingsW(PCWSTR::null(), ENUM_CURRENT_SETTINGS, &mut dm)
        };
        ok.as_bool().then(|| DisplayMode {
            width: dm.dmPelsWidth,
            height: dm.dmPelsHeight,
            hz: dm.dmDisplayFrequency,
        })
    }

    /// Capture the desktop mode once, at startup. Idempotent.
    fn ensure_original() {
        if ORIGINAL.get().is_none() {
            if let Some(m) = current_mode() {
                let _ = ORIGINAL.set(m);
            }
        }
    }

    pub fn list_supported_modes() -> Vec<DisplayMode> {
        ensure_original();
        let mut out = Vec::new();
        let mut i = 0u32;
        loop {
            let mut dm = devmode_zeroed();
            let ok = unsafe {
                EnumDisplaySettingsW(
                    PCWSTR::null(),
                    ENUM_DISPLAY_SETTINGS_MODE(i),
                    &mut dm,
                )
            };
            if !ok.as_bool() {
                break;
            }
            i += 1;
            let m = DisplayMode {
                width: dm.dmPelsWidth,
                height: dm.dmPelsHeight,
                hz: dm.dmDisplayFrequency,
            };
            // Skip legacy low-bpp dupes; only keep unique w/h/hz triples.
            if !out.contains(&m) {
                out.push(m);
            }
        }
        out
    }

    pub fn apply_mode(mode: &DisplayMode) -> windows::core::Result<()> {
        ensure_original();
        let mut dm = devmode_zeroed();
        dm.dmPelsWidth = mode.width;
        dm.dmPelsHeight = mode.height;
        dm.dmDisplayFrequency = mode.hz;
        // DM_PELSWIDTH | DM_PELSHEIGHT | DM_DISPLAYFREQUENCY
        dm.dmFields = windows::Win32::Graphics::Gdi::DM_PELSWIDTH
            | windows::Win32::Graphics::Gdi::DM_PELSHEIGHT
            | windows::Win32::Graphics::Gdi::DM_DISPLAYFREQUENCY;

        let result = unsafe {
            ChangeDisplaySettingsExW(PCWSTR::null(), Some(&dm), None, CDS_TYPE(0), None)
        };
        if result == DISP_CHANGE_SUCCESSFUL {
            Ok(())
        } else {
            Err(windows::core::Error::from_win32())
        }
    }

    pub fn restore_original() {
        if let Some(m) = ORIGINAL.get().copied() {
            let _ = apply_mode(&m);
        }
    }

    pub fn install_panic_restore_hook() {
        ensure_original();
        let prev = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            restore_original();
            prev(info);
        }));
    }
}

// ── Public API (thin cross-platform shims over the win module) ─────────────────

#[cfg(windows)]
pub fn list_supported_modes() -> Vec<DisplayMode> {
    win::list_supported_modes()
}
#[cfg(windows)]
pub fn apply_mode(mode: &DisplayMode) -> Result<(), String> {
    win::apply_mode(mode).map_err(|e| e.to_string())
}
#[cfg(windows)]
pub fn restore_original() {
    win::restore_original();
}
#[cfg(windows)]
pub fn install_panic_restore_hook() {
    win::install_panic_restore_hook();
}

// Non-Windows stubs so the crate still type-checks on dev machines.
#[cfg(not(windows))]
pub fn list_supported_modes() -> Vec<DisplayMode> {
    Vec::new()
}
#[cfg(not(windows))]
pub fn apply_mode(_mode: &DisplayMode) -> Result<(), String> {
    Err("display switching is Windows-only".into())
}
