//! Desktop Mode text entry — synthesize keystrokes into whatever app currently
//! has focus.
//!
//! This is the sanctioned mechanism, and deliberately the ONLY one: `SendInput`
//! is the documented Win32 API for synthetic input, the same one Windows' own
//! on-screen keyboard uses. It posts to the foreground window through the normal
//! input queue. No DLL injection, no `SetWindowsHookEx`, no writing another
//! process' memory — all of which are permanently off the table for this project
//! (see PROJECT_STATUS.md's constraints), both on principle and because they are
//! exactly what anti-cheat flags.
//!
//! Characters are sent as UTF-16 with `KEYEVENTF_UNICODE` rather than as virtual
//! key codes. That means no keyboard-layout math and no dead-key handling: the
//! target app receives the literal character regardless of the user's layout.
//! Non-BMP characters (emoji) arrive as their surrogate pair, which is what
//! `encode_utf16` yields and what Windows expects.

#[cfg(windows)]
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_UNICODE,
    VIRTUAL_KEY,
};

/// One UTF-16 code unit as a key-down/key-up pair.
#[cfg(windows)]
fn unit_events(unit: u16) -> [INPUT; 2] {
    let make = |flags| INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VIRTUAL_KEY(0), // ignored when KEYEVENTF_UNICODE is set
                wScan: unit,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    [make(KEYEVENTF_UNICODE), make(KEYEVENTF_UNICODE | KEYEVENTF_KEYUP)]
}

/// Type `text` into the focused window.
///
/// The caller must ensure the launcher itself is not focused, or it types into
/// its own webview. In Desktop Mode that already holds: the console is hidden
/// (`yield_focus`) and the keyboard dock's window is built `focusable(false)`
/// and click-through, so the browser underneath keeps focus the whole time.
#[tauri::command]
pub fn send_text(text: String) -> Result<(), String> {
    if text.is_empty() {
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        let _ = text;
        Err("synthetic text entry is Windows-only".into())
    }
    #[cfg(windows)]
    {
        // One batched call rather than a call per character: SendInput
        // guarantees the events in a single call are not interleaved with other
        // input, so a fast typist (or a paste-like burst) can't get characters
        // reordered by real hardware input arriving mid-sequence.
        let events: Vec<INPUT> = text.encode_utf16().flat_map(unit_events).collect();
        let sent = unsafe { SendInput(&events, std::mem::size_of::<INPUT>() as i32) };
        if sent as usize != events.len() {
            // Most commonly UIPI: the foreground window runs at a higher
            // integrity level than us (an elevated app) and Windows silently
            // refuses. Worth surfacing rather than looking like a dead keyboard.
            return Err(format!(
                "sent {sent} of {} input events - the focused window may be running elevated",
                events.len()
            ));
        }
        Ok(())
    }
}
