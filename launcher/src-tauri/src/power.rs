// Idle power management — swaps the active Windows power plan to Power Saver
// when the launcher goes idle, and restores whatever was active beforehand on
// wake. Uses `powercfg` (built into Windows, no extra dependency) rather than
// the SetThreadExecutionState API — that API only PREVENTS sleep, it has no
// equivalent for actively dropping into a lower-power scheme, which is what we
// actually want here (idle a PC that's sitting there fullscreen doing nothing).

use std::process::Command;
use std::sync::{Mutex, OnceLock};

// Built-in Windows scheme GUID — present on every Windows install, not
// machine-specific (unlike custom user-created plans).
const POWER_SAVER_GUID: &str = "a1841308-3541-4fab-bc81-f71556f20b4a";

static PREVIOUS_SCHEME: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn previous_scheme_slot() -> &'static Mutex<Option<String>> {
    PREVIOUS_SCHEME.get_or_init(|| Mutex::new(None))
}

/// Capture the currently active scheme, then switch to Power Saver. Safe to
/// call repeatedly — only the FIRST call in an idle period records the
/// "previous" scheme, so a second accidental call doesn't overwrite it with
/// "Power Saver" itself.
pub fn enter_idle() {
    let slot = previous_scheme_slot();
    let mut guard = slot.lock().unwrap();
    if guard.is_none() {
        if let Some(guid) = current_scheme_guid() {
            *guard = Some(guid);
        }
    }
    drop(guard);
    let _ = Command::new("powercfg")
        .args(["/setactive", POWER_SAVER_GUID])
        .status();
}

/// Restore whatever scheme was active before enter_idle(). No-op if we never
/// recorded one (e.g. exit_idle called without a matching enter_idle).
pub fn exit_idle() {
    let slot = previous_scheme_slot();
    let mut guard = slot.lock().unwrap();
    if let Some(guid) = guard.take() {
        let _ = Command::new("powercfg").args(["/setactive", &guid]).status();
    }
}

fn current_scheme_guid() -> Option<String> {
    let out = Command::new("powercfg").args(["/getactivescheme"]).output().ok()?;
    let text = String::from_utf8(out.stdout).ok()?;
    // Format: "Power Scheme GUID: a1841308-3541-4fab-bc81-f71556f20b4a  (Power saver)"
    let guid = text.split("GUID:").nth(1)?.trim().split_whitespace().next()?;
    Some(guid.to_string())
}
