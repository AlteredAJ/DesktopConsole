// Global trackpad-as-mouse mode — active OUTSIDE ps5 mode (desktop, browser,
// any normal app), NOT while the fullscreen launcher grid has focus (there the
// touchpad drives swipe-nav instead — see launcher/hid.rs's own cursor_mode
// which is scoped to embedded panels only).
//
// Gating is done by checking the real Windows foreground window's owning
// process name rather than any cross-process flag — the listener and launcher
// are separate processes/exes, so there's no shared atomic to read. Checking
// GetForegroundWindow() needs no new crate: same raw extern "system" FFI
// pattern as launcher/mouse_inject.rs's mouse_event.
//
// Gesture surface (touchpad physical click, buf[10] & 0x02 — same bit
// launcher/hid.rs already uses):
//   - triple-click (600ms window, same debounce as triple_click.rs) toggles
//     mouse mode on/off.
//   - while ON: touchpad drag moves the real OS cursor, a single tap
//     (press+release under the hold threshold) is a left-click.
//
// Hold-2s-for-keyboard is a SEPARATE gesture, designed but not implemented
// here yet (see HANDOFF.md / design notes) — this module only owns the mouse
// half.

#![cfg(windows)]

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use crate::triple_click::ClickTracker;

/// True while the trackpad is driving the real OS cursor.
pub static MOUSE_MODE: AtomicBool = AtomicBool::new(false);

const MISC_TOUCHPAD_CLICK: u8 = 0x02;
/// PS button, same byte as the touchpad click. Used as a held modifier below.
const MISC_PS: u8 = 0x01;
/// A touchpad click held longer than this is a drag/hold, not a tap-to-click.
const TAP_MAX: Duration = Duration::from_millis(220);
const HOLD_FOR_MOUSE: Duration = Duration::from_millis(2000);

/// Sensitivity is user-adjustable from Settings > Controller (launcher
/// process), persisted to the shared config.json. Re-read from disk each time
/// mouse mode is toggled ON (not every poll tick — this is a cheap once-per-
/// activation file read, not a live watch) so a Settings change takes effect
/// on the next trackpad-mouse session without needing IPC between the two
/// separate exes.
fn read_sensitivity() -> f32 {
    #[derive(serde::Deserialize)]
    struct PartialConfig {
        #[serde(default = "default_sens")]
        cursor_sensitivity: f32,
    }
    fn default_sens() -> f32 {
        1.6
    }
    let Some(path) = dirs::config_dir().map(|d| d.join("ps5-mode").join("config.json")) else {
        return default_sens();
    };
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str::<PartialConfig>(&s).ok())
        .map(|c| c.cursor_sensitivity)
        .unwrap_or_else(default_sens)
}

extern "system" {
    fn mouse_event(dw_flags: u32, dx: i32, dy: i32, dw_data: u32, dw_extra: usize);
    fn GetForegroundWindow() -> isize;
    fn GetWindowThreadProcessId(hwnd: isize, lp_pid: *mut u32) -> u32;
    fn OpenProcess(access: u32, inherit: i32, pid: u32) -> isize;
    fn QueryFullProcessImageNameW(
        process: isize,
        flags: u32,
        buf: *mut u16,
        size: *mut u32,
    ) -> i32;
    fn CloseHandle(h: isize) -> i32;
}

const MOUSEEVENTF_MOVE: u32 = 0x0001;
const MOUSEEVENTF_LEFTDOWN: u32 = 0x0002;
const MOUSEEVENTF_LEFTUP: u32 = 0x0004;
const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;

/// Per-poll-loop state for the touchpad-click gesture tracker. Lives in
/// hid.rs's listen_loop alongside the PS-button ClickTracker.
pub struct State {
    keyboard_clicks: ClickTracker,
    prev_click: bool,
    press_started: Option<Instant>,
    hold_triggered: bool,
    acc_x: f32,
    acc_y: f32,
    prev_touch: Option<(u16, u16)>,
    sens: f32,
}

impl State {
    pub fn new() -> Self {
        Self {
            keyboard_clicks: ClickTracker::new(),
            prev_click: false,
            press_started: None,
            hold_triggered: false,
            acc_x: 0.0,
            acc_y: 0.0,
            prev_touch: None,
            sens: read_sensitivity(),
        }
    }

    /// Feed one HID poll tick. The listener owns these gestures only while a
    /// normal Windows app is foreground; the fullscreen launcher keeps its
    /// touchpad for swipe navigation.
    pub fn feed(&mut self, b10: u8, touch_active: bool, touch_x: u16, touch_y: u16) {
        let click_now = (b10 & MISC_TOUCHPAD_CLICK) != 0;
        let ps_held = (b10 & MISC_PS) != 0;
        let rising = click_now && !self.prev_click;
        let falling = !click_now && self.prev_click;
        self.prev_click = click_now;

        if foreground_is_launcher() {
            self.press_started = None;
            self.hold_triggered = false;
            self.prev_touch = None;
            // Returning to the console always ends a desktop-mouse session, so
            // the mode can never still be armed the next time an app or game
            // takes focus.
            if MOUSE_MODE.swap(false, Ordering::Relaxed) {
                eprintln!("[cursor_mode] mouse mode -> false (back on console)");
            }
            return;
        }

        if rising {
            self.press_started = Some(Instant::now());
            self.hold_triggered = false;
        }

        // Toggling desktop mouse mode requires PS HELD + a 2.5s touchpad press.
        //
        // The bare touchpad hold this used to use is not safe outside the
        // console: "not the launcher" includes every game, and the touchpad is
        // a live game input. Playing Assetto Corsa with a hand resting on the
        // touchpad was silently flipping mouse mode on and then injecting real
        // OS cursor movement and clicks into the running game. PS is never a
        // game input (the game never sees it — we consume it), so requiring it
        // as a modifier makes this gesture impossible to trigger by accident
        // while playing, without needing cross-process IPC to know whether the
        // foreground app is a game or a browser.
        if click_now && ps_held && !self.hold_triggered
            && self.press_started.is_some_and(|started| started.elapsed() >= HOLD_FOR_MOUSE)
        {
            let now = !MOUSE_MODE.load(Ordering::Relaxed);
            MOUSE_MODE.store(now, Ordering::Relaxed);
            self.acc_x = 0.0;
            self.acc_y = 0.0;
            self.prev_touch = None;
            self.hold_triggered = true;
            if now {
                self.sens = read_sensitivity();
            }
            crate::rumble::mouse_mode_changed(now);
            eprintln!("[cursor_mode] mouse mode -> {now}");
        }

        // PS HELD + triple-click opens Windows' own on-screen keyboard from any
        // non-launcher app. PS is required for the same reason as the toggle
        // above — a bare triple-click is reachable during normal play, and this
        // gesture spawns osk.exe on top of whatever is running.
        if self.keyboard_clicks.feed(rising && ps_held) {
            let keyboard = std::env::var_os("WINDIR")
                .map(|dir| std::path::PathBuf::from(dir).join("System32").join("osk.exe"))
                .unwrap_or_else(|| std::path::PathBuf::from(r"C:\\Windows\\System32\\osk.exe"));
            let _ = std::process::Command::new(keyboard).spawn();
        }

        if !MOUSE_MODE.load(Ordering::Relaxed) {
            if falling {
                self.press_started = None;
                self.hold_triggered = false;
            }
            return;
        }

        if falling {
            if let Some(started) = self.press_started.take() {
                if !self.hold_triggered && started.elapsed() <= TAP_MAX {
                    unsafe {
                        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
                    }
                }
            }
            self.hold_triggered = false;
        }

        if !touch_active {
            self.prev_touch = None;
            return;
        }
        let Some((px, py)) = self.prev_touch else {
            self.prev_touch = Some((touch_x, touch_y));
            return;
        };
        self.prev_touch = Some((touch_x, touch_y));
        let dx = touch_x as i32 - px as i32;
        let dy = touch_y as i32 - py as i32;

        self.acc_x += dx as f32 * self.sens;
        self.acc_y += dy as f32 * self.sens;
        let ix = self.acc_x.trunc() as i32;
        let iy = self.acc_y.trunc() as i32;
        self.acc_x -= ix as f32;
        self.acc_y -= iy as f32;
        if ix != 0 || iy != 0 {
            unsafe { mouse_event(MOUSEEVENTF_MOVE, ix, iy, 0, 0) };
        }
    }
}

/// True if ps5-launcher.exe currently owns the foreground window (the
/// fullscreen grid is up) — in that case the touchpad stays swipe-nav and
/// this module's gestures are inert. Re-checked every poll rather than cached
/// since foreground focus can change between HID reads at any time.
pub fn foreground_is_launcher() -> bool {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd == 0 {
            return false;
        }
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return false;
        }
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle == 0 {
            return false;
        }
        let mut buf = [0u16; 260];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut len);
        CloseHandle(handle);
        if ok == 0 {
            return false;
        }
        let path = String::from_utf16_lossy(&buf[..len as usize]);
        path.rsplit(['\\', '/'])
            .next()
            .map(|name| name.eq_ignore_ascii_case("ps5-launcher.exe"))
            .unwrap_or(false)
    }
}
