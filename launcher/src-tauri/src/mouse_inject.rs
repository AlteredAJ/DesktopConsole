// UNIT B — touchpad-as-mouse cursor injection.
// PORT of dualsense-haptics-windows-src hid.rs:2827-2885 (aim_loop). Same sub-pixel
// f32 accumulator pattern, but fed by TOUCHPAD deltas instead of gyro so slow drags
// aren't quantized away.

#![cfg(windows)]

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, Sender};
use std::sync::OnceLock;

/// True while an embedded-content panel (YouTube) has focus — gates touchpad
/// deltas into cursor movement instead of grid-nav swipes. Grid/tab panels never
/// enable this, so a swipe there stays a discrete nav event, not a cursor drag.
pub static CURSOR_MODE: AtomicBool = AtomicBool::new(false);
/// Trackpad mouse mode while the console is minimized and Windows is foreground.
/// It is intentionally separate from panel cursor mode so the home grid keeps swipe navigation.
pub static GLOBAL_MOUSE_MODE: AtomicBool = AtomicBool::new(false);

static CURSOR_TX: OnceLock<Sender<(i16, i16)>> = OnceLock::new();

extern "system" {
    // user32 relative mouse move. dx/dy are signed for MOUSEEVENTF_MOVE.
    fn mouse_event(dw_flags: u32, dx: i32, dy: i32, dw_data: u32, dw_extra: usize);
}

const MOUSEEVENTF_MOVE: u32 = 0x0001;
#[allow(dead_code)]
const MOUSEEVENTF_LEFTDOWN: u32 = 0x0002;
#[allow(dead_code)]
const MOUSEEVENTF_LEFTUP: u32 = 0x0004;

/// Cursor sensitivity: screen pixels per touchpad unit. Tune in Unit B verification.
const SENS: f32 = 1.6;

/// Spawn the cursor-injection thread and return its sender for hid.rs to feed
/// touchpad deltas into (only while CURSOR_MODE is set).
pub fn init() -> Sender<(i16, i16)> {
    let (tx, rx) = std::sync::mpsc::channel();
    let _ = CURSOR_TX.set(tx.clone());
    std::thread::spawn(move || cursor_loop(rx));
    tx
}

pub fn feed(dx: i16, dy: i16) {
    if CURSOR_MODE.load(Ordering::Relaxed) || GLOBAL_MOUSE_MODE.load(Ordering::Relaxed) {
        if let Some(tx) = CURSOR_TX.get() {
            let _ = tx.send((dx, dy));
        }
    }
}

/// Consume (dx, dy) touchpad deltas and drive the OS cursor. Runs on its own thread.
fn cursor_loop(rx: Receiver<(i16, i16)>) {
    let (mut acc_x, mut acc_y) = (0.0f32, 0.0f32);

    while let Ok((dx, dy)) = rx.recv() {
        acc_x += dx as f32 * SENS;
        acc_y += dy as f32 * SENS;

        let ix = acc_x.trunc() as i32;
        let iy = acc_y.trunc() as i32;
        acc_x -= ix as f32;
        acc_y -= iy as f32;

        if ix != 0 || iy != 0 {
            unsafe { mouse_event(MOUSEEVENTF_MOVE, ix, iy, 0, 0) };
        }
    }
}

/// Toggle desktop trackpad-mouse mode. Returns the new enabled state.
pub fn toggle_global_mode() -> bool {
    let next = !GLOBAL_MOUSE_MODE.load(Ordering::Relaxed);
    GLOBAL_MOUSE_MODE.store(next, Ordering::Relaxed);
    next
}

/// Left click via the touchpad physical click (buf[10] & 0x02).
pub fn click() {
    unsafe {
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
    }
}
