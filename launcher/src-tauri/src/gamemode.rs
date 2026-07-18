// Settings > System — Windows' own Game Mode toggle
// (HKCU\Software\Microsoft\GameBar\AutoGameModeEnabled). Deliberately just
// flips the OS setting Windows already has (scheduling priority for the
// foreground game, suppressed notifications, etc.) instead of building a
// custom "performance mode" — same effect, zero new engineering/failure surface.

#![cfg(windows)]

use windows::Win32::System::Registry::{
    RegCreateKeyExW, RegSetValueExW, RegGetValueW, HKEY, HKEY_CURRENT_USER, KEY_ALL_ACCESS,
    REG_DWORD, RRF_RT_REG_DWORD,
};
use windows::core::w;

pub fn enabled() -> bool {
    unsafe {
        let mut value: u32 = 1; // default-on, matching Windows' own default
        let mut size = std::mem::size_of::<u32>() as u32;
        let status = RegGetValueW(
            HKEY_CURRENT_USER,
            w!("Software\\Microsoft\\GameBar"),
            w!("AutoGameModeEnabled"),
            RRF_RT_REG_DWORD,
            None,
            Some(&mut value as *mut _ as *mut _),
            Some(&mut size),
        );
        status.is_ok() && value != 0 || status.is_err()
    }
}

pub fn set_enabled(on: bool) {
    unsafe {
        let mut key: HKEY = HKEY::default();
        if RegCreateKeyExW(
            HKEY_CURRENT_USER,
            w!("Software\\Microsoft\\GameBar"),
            0,
            None,
            Default::default(),
            KEY_ALL_ACCESS,
            None,
            &mut key,
            None,
        )
        .is_err()
        {
            return;
        }
        let value: u32 = if on { 1 } else { 0 };
        let bytes = value.to_le_bytes();
        let _ = RegSetValueExW(key, w!("AutoGameModeEnabled"), 0, REG_DWORD, Some(&bytes));
    }
}
