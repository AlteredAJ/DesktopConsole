// Settings > Audio — master volume/mute via Windows Core Audio
// (IAudioEndpointVolume on the default render endpoint). Kept to master-only
// scope on purpose (not a full per-app mixer, which needs IAudioSessionManager2
// and process-id-to-label plumbing) — this covers the actual everyday control
// people reach for, at a fraction of the code and failure surface.

#![cfg(windows)]

use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{
    eConsole, eRender, IAudioSessionManager2, IMMDeviceEnumerator, ISimpleAudioVolume, MMDeviceEnumerator,
};
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_APARTMENTTHREADED};
use windows::core::Interface;

fn endpoint_volume() -> windows::core::Result<IAudioEndpointVolume> {
    unsafe {
        // Idempotent per-thread; returns S_FALSE (not an error) if this thread
        // already has an apartment, which is fine to ignore.
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
        device.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None)
    }
}

pub fn get_volume() -> f32 {
    endpoint_volume()
        .and_then(|v| unsafe { v.GetMasterVolumeLevelScalar() })
        .unwrap_or(0.0)
}

pub fn set_volume(level: f32) {
    if let Ok(v) = endpoint_volume() {
        unsafe {
            let _ = v.SetMasterVolumeLevelScalar(level.clamp(0.0, 1.0), std::ptr::null());
        }
    }
}

pub fn get_mute() -> bool {
    endpoint_volume()
        .and_then(|v| unsafe { v.GetMute() })
        .map(|b| b.as_bool())
        .unwrap_or(false)
}

pub fn set_mute(muted: bool) {
    if let Ok(v) = endpoint_volume() {
        unsafe {
            let _ = v.SetMute(muted, std::ptr::null());
        }
    }
}

/// Opens Windows' own output-device picker (mmsys.cpl, Playback tab).
/// Deliberately NOT a custom in-app device switcher: that needs
/// `IPolicyConfig`, an undocumented COM interface with a vtable layout that
/// varies across Windows versions (the approach EarTrumpet/SoundSwitch use,
/// reverse-engineered, not Microsoft-documented) — a wrong vtable slot there
/// is a hard crash, not a compile error. Not worth that risk for a settings
/// row when Windows' own picker already does this reliably.
pub fn open_device_picker() {
    let _ = std::process::Command::new("control").args(["mmsys.cpl,,0"]).spawn();
}

#[derive(serde::Serialize, Clone)]
pub struct MixerSession {
    pub process_id: u32,
    pub name: String,
    pub volume: f32,
    pub muted: bool,
}

fn session_manager() -> windows::core::Result<IAudioSessionManager2> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
        device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None)
    }
}

/// Per-app volume mixer — one row per process currently playing/holding an
/// audio session on the default output. Process display names come from
/// `sysinfo` (already a dependency) keyed by the session's real PID, since
/// `IAudioSessionControl::GetDisplayName` is usually empty (apps rarely set
/// it) — the exe name is what's actually useful to show.
pub fn mixer_sessions() -> Vec<MixerSession> {
    let Ok(mgr) = session_manager() else { return Vec::new() };
    let Ok(sessions) = (unsafe { mgr.GetSessionEnumerator() }) else { return Vec::new() };
    let Ok(count) = (unsafe { sessions.GetCount() }) else { return Vec::new() };

    let mut sys = sysinfo::System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All);

    let mut out = Vec::new();
    for i in 0..count {
        let Ok(control) = (unsafe { sessions.GetSession(i) }) else { continue };
        let Ok(control2) = control.cast::<windows::Win32::Media::Audio::IAudioSessionControl2>() else { continue };
        unsafe {
            if control2.IsSystemSoundsSession().is_ok() {
                continue; // skip the "system sounds" pseudo-session
            }
            let Ok(pid) = control2.GetProcessId() else { continue };
            let Ok(vol_ctl) = control2.cast::<ISimpleAudioVolume>() else { continue };
            let volume = vol_ctl.GetMasterVolume().unwrap_or(0.0);
            let muted = vol_ctl.GetMute().map(|b| b.as_bool()).unwrap_or(false);
            let name = sys
                .process(sysinfo::Pid::from_u32(pid))
                .map(|p| p.name().to_string_lossy().to_string())
                .unwrap_or_else(|| format!("PID {pid}"));
            out.push(MixerSession { process_id: pid, name, volume, muted });
        }
    }
    out
}

pub fn set_session_volume(process_id: u32, level: f32) {
    apply_to_session(process_id, |v| unsafe {
        let _ = v.SetMasterVolume(level.clamp(0.0, 1.0), std::ptr::null());
    });
}

pub fn set_session_mute(process_id: u32, muted: bool) {
    apply_to_session(process_id, |v| unsafe {
        let _ = v.SetMute(muted, std::ptr::null());
    });
}

fn apply_to_session(process_id: u32, f: impl Fn(&ISimpleAudioVolume)) {
    let Ok(mgr) = session_manager() else { return };
    let Ok(sessions) = (unsafe { mgr.GetSessionEnumerator() }) else { return };
    let Ok(count) = (unsafe { sessions.GetCount() }) else { return };
    for i in 0..count {
        let Ok(control) = (unsafe { sessions.GetSession(i) }) else { continue };
        let Ok(control2) = control.cast::<windows::Win32::Media::Audio::IAudioSessionControl2>() else { continue };
        let matches = unsafe { control2.GetProcessId() }.map(|pid| pid == process_id).unwrap_or(false);
        if !matches {
            continue;
        }
        if let Ok(vol_ctl) = control2.cast::<ISimpleAudioVolume>() {
            f(&vol_ctl);
        }
        break;
    }
}
