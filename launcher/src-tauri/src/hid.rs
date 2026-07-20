// Full controller input parsing for the launcher.
// UNIT A: buttons + sticks + PS/Options for exit combo.
// UNIT B: + touchpad X/Y (see TOUCHPAD offsets — VERIFY on hardware first).
//
// Byte offsets reused from dualsense-haptics-windows-src hid.rs:2558-2562.

use std::ffi::CString;
use std::thread;
use std::time::{Duration, Instant};
use std::sync::atomic::Ordering;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

const SONY_VENDOR: u16 = 0x054C;
const DUALSENSE_PRODUCTS: &[u16] = &[0x0CE6, 0x0DF2]; // DualSense + DualSense Edge

// ── Button bit masks ──────────────────────────────────────────────────────────
// ALL CONFIRMED on real hardware 2026-07-11 (Bluetooth, after the wake handshake —
// see bt_wake.rs; without it every one of these bytes reads zero forever).
//
// buf[8]  = face byte: ✕=0x20 (confirmed), plus the d-pad hat in the low nibble
//           (0x08 = neutral/no direction, confirmed). ○/□/△ inferred from
//           hid.rs:2596-2613 (○=0x40, □=0x10, △=0x80) — not independently
//           re-verified here, only ✕ was pressed during the hardware pass.
// buf[9]  = shoulders/misc: Options=0x20 (confirmed — NOT buf[10], the original
//           assumption here was wrong). L1/R1=0x01/0x02 per hid.rs:2618-2619,
//           not re-verified.
// buf[10] = misc: touchpad click=0x02 (hid.rs:2562, not re-verified), PS
//           button=0x01 (confirmed).
const FACE_CROSS: u8 = 0x20;
const FACE_CIRCLE: u8 = 0x40;
const FACE_SQUARE: u8 = 0x10;
const FACE_TRIANGLE: u8 = 0x80;

const MISC_TOUCHPAD_CLICK: u8 = 0x02;
const MISC_PS: u8 = 0x01; // buf[10] — confirmed
const SHOULDER_OPTIONS: u8 = 0x20; // buf[9] — confirmed (was wrongly on buf[10])

/// Snapshot pushed to the frontend each poll.
#[derive(Serialize, Clone, Default, PartialEq)]
pub struct PadState {
    pub lx: u8,
    pub ly: u8,
    pub rx: u8,
    pub ry: u8,
    pub buttons: u16, // (face) | (shoulders << 8), same packing as hid.rs:2560
    pub dpad: u8,     // decoded hat 0..8 (8 = neutral)
    pub cross: bool,
    pub circle: bool,
    pub square: bool, // Close Application on a focused, running grid tile
    pub triangle: bool, // opens Settings from anywhere (App.tsx)
    pub touchpad_btn: bool,
    pub ps: bool,
    pub options: bool,
    /// DualSense status byte reports battery in 10% steps (0..10).
    pub battery_percent: Option<u8>,
    pub charging: bool,

    // Unit B — populated once touchpad offsets are confirmed.
    pub touch_active: bool,
    pub touch_x: u16,
    pub touch_y: u16,
}

pub fn spawn_input_thread(app: AppHandle) {
    thread::spawn(move || supervisor(app));
}

/// If input_loop panics, the PS+Options exit combo stops working — the only way
/// out would be killing the process. Restart instead so exit always stays reachable.
fn supervisor(app: AppHandle) {
    loop {
        let app_for_loop = app.clone();
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            input_loop(app_for_loop);
        }));
        // input_loop only returns normally via the PS+Options exit path, which
        // already calls app.exit(0) — if we get here the process is on its way
        // down, but restart anyway in the panic case so exit stays reachable.
        if let Err(e) = result {
            eprintln!("[launcher] input_loop panicked, restarting: {e:?}");
            std::thread::sleep(Duration::from_millis(300));
        } else {
            break;
        }
    }
}

fn input_loop(app: AppHandle) {
    loop {
        let path = match find_dualsense() {
            Some(p) => p,
            None => {
                thread::sleep(Duration::from_millis(500));
                continue;
            }
        };
        let api = match hidapi::HidApi::new() {
            Ok(a) => a,
            Err(_) => {
                thread::sleep(Duration::from_millis(500));
                continue;
            }
        };
        let device = match api.open_path(&path) {
            Ok(d) => d,
            Err(_) => {
                thread::sleep(Duration::from_millis(500));
                continue;
            }
        };

        // CONFIRMED NECESSARY on real hardware (BT) — see bt_wake.rs. Without this
        // the pad stays in its minimal report mode and every field below is zero.
        crate::bt_wake::send(&device);
        thread::sleep(Duration::from_millis(150));

        let mut buf = [0u8; 78];
        let mut prev_options = false;
        // Alternate exit gesture: PS+Options requires holding two buttons at
        // once, which is fiddly — triple-clicking Options alone exits too.
        let mut exit_tracker = TripleClickTracker::new();
        // Cursor deltas need full read-rate updates for smoothness — unlike the
        // frontend emit below, this is a lightweight OS call, not React, so no
        // throttle needed here.
        let mut prev_touch: Option<(u16, u16)> = None;
        // CONFIRMED NECESSARY: the raw HID read rate over BT measured 600-1400
        // reports/sec (verification pass, 2026-07-11). Emitting a Tauri IPC event
        // per read at that rate flooded the webview's message queue and caused the
        // "freezing on easy commands" symptom during real testing — button/nav
        // exits and combo detection still run on EVERY read below (so nothing
        // physical feels delayed), only the frontend-facing emit is throttled.
        let mut last_emit = std::time::Instant::now();
        let mut last_emitted: Option<PadState> = None;
        let mut rearm_after_yield = false;
        #[cfg(windows)]
        let mut outside_prev_click = false;
        #[cfg(windows)]
        let mut outside_prev_ps = false;
        #[cfg(windows)]
        let mut outside_ps_taps = 0u8;
        #[cfg(windows)]
        let mut outside_last_ps_tap: Option<Instant> = None;
        #[cfg(windows)]
        let mut outside_prev_share = false;
        #[cfg(windows)]
        let mut outside_share_taps = 0u8;
        #[cfg(windows)]
        let mut outside_last_share_tap: Option<Instant> = None;
        #[cfg(windows)]
        let mut outside_hold_started: Option<Instant> = None;
        #[cfg(windows)]
        let mut outside_hold_fired = false;
        #[cfg(windows)]
        let mut outside_tap_count = 0u8;
        #[cfg(windows)]
        let mut outside_last_tap: Option<Instant> = None;
        #[cfg(windows)]
        let mut outside_prev_touch: Option<(u16, u16)> = None;
        const EMIT_INTERVAL: Duration = Duration::from_millis(16); // ~60Hz

        loop {
            match device.read_timeout(&mut buf, 16) {
                Ok(0) => continue,
                Ok(_) => {}
                Err(_) => break,
            }

            let off = report_offset(&buf);
            let s = parse(&buf, off);

            // PS + Options (hold both) exits, OR triple-click Options alone —
            // whichever's easier to land reliably (restores display either way).
            if s.ps && s.options {
                commands::request_exit(&app);
                return;
            }
            let options_edge = s.options && !prev_options;
            prev_options = s.options;
            if exit_tracker.feed(options_edge) {
                commands::request_exit(&app);
                return;
            }


            // Keep the emergency PS/Options controls above alive, but never feed
            // dashboard actions or touchpad mouse movement while another Windows
            // app has focus. A neutral release is required on return so the
            // restoring gesture cannot select an item underneath it.
            if crate::commands::YIELDED.load(Ordering::Relaxed) {
                #[cfg(windows)]
                {
                    let ps_rising = s.ps && !outside_prev_ps;
                    if ps_rising {
                        const DOUBLE_PS_WINDOW: Duration = Duration::from_millis(420);
                        let now = Instant::now();
                        if outside_last_ps_tap.is_none_or(|last| now.duration_since(last) > DOUBLE_PS_WINDOW) {
                            outside_ps_taps = 0;
                        }
                        outside_ps_taps += 1;
                        outside_last_ps_tap = Some(now);
                        if outside_ps_taps >= 2 {
                            crate::commands::toggle_quick_overlay(&app);
                            outside_ps_taps = 0;
                            outside_last_ps_tap = None;
                        }
                    }
                    outside_prev_ps = s.ps;

                    // Double-Share summons the keyboard — "use double share
                    // anywhere" (AJ), so the same gesture that opens it on Home
                    // opens the Desktop Mode dock out here. Only when the
                    // overlay isn't already up, so it can't fight the Quick
                    // Menu for the same window.
                    const SHARE_BUTTON: u8 = 0x10; // shoulders byte
                    let share_now = ((s.buttons >> 8) as u8 & SHARE_BUTTON) != 0;
                    let share_rising = share_now && !outside_prev_share;
                    if share_rising && !crate::commands::OVERLAY_ACTIVE.load(Ordering::Relaxed) {
                        const DOUBLE_SHARE_WINDOW: Duration = Duration::from_millis(420);
                        let now = Instant::now();
                        if outside_last_share_tap.is_none_or(|last| now.duration_since(last) > DOUBLE_SHARE_WINDOW) {
                            outside_share_taps = 0;
                        }
                        outside_share_taps += 1;
                        outside_last_share_tap = Some(now);
                        if outside_share_taps >= 2 {
                            crate::commands::show_keyboard_dock(&app);
                            outside_share_taps = 0;
                            outside_last_share_tap = None;
                        }
                    }
                    outside_prev_share = share_now;

                    // While the overlay is visible it receives the same
                    // controller stream, but the minimized dashboard stays
                    // inert and the game keeps keyboard/mouse focus.
                    if crate::commands::OVERLAY_ACTIVE.load(Ordering::Relaxed) {
                        let changed = last_emitted.as_ref() != Some(&s);
                        let due = last_emit.elapsed() >= EMIT_INTERVAL;
                        if changed && due {
                            // Do not wake the hidden full dashboard at input
                            // rate. The compact overlay is the sole consumer
                            // while an external app has focus.
                            let _ = app.emit_to("overlay", "pad-state", &s);
                            last_emitted = Some(s.clone());
                            last_emit = std::time::Instant::now();
                        }
                        continue;
                    }
                }
                // Touchpad gestures (double-click restore, triple-click osk,
                // drag-to-move-cursor) are ONLY for browser/PWA tiles, which
                // set needs_cursor at launch. In a game the touchpad is a live
                // game input, so leaving these armed meant ordinary play kept
                // tripping restore_focus() — which cleared YIELDED and brought
                // the whole hidden dashboard back to processing input mid-race.
                // While a game holds focus the ONLY things still listened for
                // are the PS gestures above (double-PS quick menu) and the
                // PS+Options emergency exit — neither is a game input.
                #[cfg(windows)]
                if crate::mouse_inject::CURSOR_MODE.load(Ordering::Relaxed) {
                    handle_outside_trackpad(
                        &app,
                        &s,
                        &mut outside_prev_click,
                        &mut outside_hold_started,
                        &mut outside_hold_fired,
                        &mut outside_tap_count,
                        &mut outside_last_tap,
                        &mut outside_prev_touch,
                    );
                }
                rearm_after_yield = true;
                last_emitted = None;
                prev_touch = None;
                continue;
            }
            #[cfg(windows)]
            {
                outside_prev_ps = s.ps;
                outside_ps_taps = 0;
                outside_last_ps_tap = None;
            }
            if rearm_after_yield {
                let sticks_neutral = [s.lx, s.ly, s.rx, s.ry]
                    .iter()
                    .all(|value| value.abs_diff(128) < 24);
                let neutral = s.dpad == 8
                    && !s.cross && !s.circle && !s.square && !s.triangle
                    && !s.touchpad_btn && !s.ps && !s.options && !s.touch_active
                    && sticks_neutral;
                if !neutral {
                    continue;
                }
                rearm_after_yield = false;
                last_emitted = Some(s);
                last_emit = std::time::Instant::now();
                continue;
            }
            #[cfg(windows)]
            {
                if s.touch_active {
                    if let Some((px, py)) = prev_touch {
                        let dx = s.touch_x as i32 - px as i32;
                        let dy = s.touch_y as i32 - py as i32;
                        crate::mouse_inject::feed(dx as i16, dy as i16);
                    }
                    prev_touch = Some((s.touch_x, s.touch_y));
                } else {
                    prev_touch = None;
                }
            }

            let changed = last_emitted.as_ref() != Some(&s);
            let due = last_emit.elapsed() >= EMIT_INTERVAL;
            if changed && due {
                // emit_to("main"), NOT emit(). `emit` is a global broadcast to
                // EVERY window, and the quick overlay is prewarmed hidden at
                // startup (commands::prewarm_quick_overlay) — so a plain emit
                // fed the hidden Quick Menu every pad frame alongside Home, and
                // both windows processed the same input at once. That directly
                // violates the "never route controller events to two consumers"
                // rule. Each surface now gets an explicitly targeted stream.
                let _ = app.emit_to("main", "pad-state", &s);
                last_emitted = Some(s);
                last_emit = std::time::Instant::now();
            }
        }
    }
}

#[cfg(windows)]
fn handle_outside_trackpad(
    app: &AppHandle,
    state: &PadState,
    previous_click: &mut bool,
    hold_started: &mut Option<Instant>,
    hold_fired: &mut bool,
    tap_count: &mut u8,
    last_tap: &mut Option<Instant>,
    previous_touch: &mut Option<(u16, u16)>,
) {
    const HOLD_FOR_MOUSE: Duration = Duration::from_millis(2000);
    const TAP_MAX: Duration = Duration::from_millis(220);
    const MULTI_TAP_WINDOW: Duration = Duration::from_millis(450);

    let rising = state.touchpad_btn && !*previous_click;
    let falling = !state.touchpad_btn && *previous_click;
    *previous_click = state.touchpad_btn;
    if rising {
        *hold_started = Some(Instant::now());
        *hold_fired = false;
    }

    if state.touchpad_btn && !*hold_fired
        && hold_started.is_some_and(|started| started.elapsed() >= HOLD_FOR_MOUSE)
    {
        let enabled = crate::mouse_inject::toggle_global_mode();
        if enabled {
            crate::rumble::select();
        } else {
            crate::rumble::confirm();
        }
        *hold_fired = true;
        *previous_touch = None;
    }

    // Two rapid physical clicks return the minimized console. The action waits
    // briefly for a possible third click, which instead opens Windows' keyboard;
    // that keeps the double/triple gestures unambiguous.
    if rising {
        let now = Instant::now();
        if last_tap.is_none_or(|last| now.duration_since(last) > MULTI_TAP_WINDOW) {
            *tap_count = 0;
        }
        *tap_count += 1;
        *last_tap = Some(now);
        if *tap_count >= 3 {
            let keyboard = std::env::var_os("WINDIR")
                .map(|dir| std::path::PathBuf::from(dir).join("System32").join("osk.exe"))
                .unwrap_or_else(|| std::path::PathBuf::from(r"C:\Windows\System32\osk.exe"));
            let _ = std::process::Command::new(keyboard).spawn();
            *tap_count = 0;
            *last_tap = None;
        }
    }
    if *tap_count == 2 && last_tap.is_some_and(|last| last.elapsed() >= MULTI_TAP_WINDOW) {
        *tap_count = 0;
        *last_tap = None;
        crate::commands::restore_focus(app);
        return;
    }

    if falling {
        if let Some(started) = hold_started.take() {
            if !*hold_fired && started.elapsed() <= TAP_MAX
                && crate::mouse_inject::GLOBAL_MOUSE_MODE.load(Ordering::Relaxed)
            {
                crate::mouse_inject::click();
            }
        }
        *hold_fired = false;
    }

    if !state.touch_active {
        *previous_touch = None;
        return;
    }
    let Some((x, y)) = *previous_touch else {
        *previous_touch = Some((state.touch_x, state.touch_y));
        return;
    };
    *previous_touch = Some((state.touch_x, state.touch_y));
    crate::mouse_inject::feed(
        (state.touch_x as i32 - x as i32) as i16,
        (state.touch_y as i32 - y as i32) as i16,
    );
}
/// Same debounce logic as listener/src/triple_click.rs, duplicated rather than
/// shared across crates for ~20 lines (see bt_wake.rs's note on this tradeoff).
struct TripleClickTracker {
    presses: std::collections::VecDeque<std::time::Instant>,
}

impl TripleClickTracker {
    fn new() -> Self {
        Self { presses: std::collections::VecDeque::with_capacity(3) }
    }

    fn feed(&mut self, rising_edge: bool) -> bool {
        let now = std::time::Instant::now();
        let window = Duration::from_millis(600);
        while let Some(&front) = self.presses.front() {
            if now.duration_since(front) > window {
                self.presses.pop_front();
            } else {
                break;
            }
        }
        if rising_edge {
            self.presses.push_back(now);
            if self.presses.len() >= 3 {
                self.presses.clear();
                return true;
            }
        }
        false
    }
}

fn parse(buf: &[u8], off: usize) -> PadState {
    let g = |i: usize| buf.get(off + i).copied().unwrap_or(0);
    let face = g(8);
    let shoulders = g(9);
    let misc = g(10);

    let battery_status = g(53);
    let battery_steps = battery_status & 0x0f;
    PadState {
        lx: g(1),
        ly: g(2),
        rx: g(3),
        ry: g(4),
        buttons: (face as u16) | ((shoulders as u16) << 8),
        dpad: face & 0x0F, // low nibble = hat (hid.rs decodes this range)
        cross: (face & FACE_CROSS) != 0,
        circle: (face & FACE_CIRCLE) != 0,
        square: (face & FACE_SQUARE) != 0,
        triangle: (face & FACE_TRIANGLE) != 0,
        touchpad_btn: (misc & MISC_TOUCHPAD_CLICK) != 0,
        ps: (misc & MISC_PS) != 0,
        options: (shoulders & SHOULDER_OPTIONS) != 0,
        battery_percent: (battery_steps <= 10).then_some(battery_steps.saturating_mul(10)),
        charging: (battery_status & 0x10) != 0,

        // CONFIRMED on real hardware: buf[33] bit7 clear while dragging, set (jumps
        // to ~130+) when the finger lifts — matches the standard hid-playstation
        // touch1 layout exactly. 12-bit X/Y packed across buf[34..37].
        touch_active: (g(33) & 0x80) == 0,
        touch_x: (g(34) as u16) | (((g(35) & 0x0F) as u16) << 8),
        touch_y: ((g(35) >> 4) as u16) | ((g(36) as u16) << 4),
    }
}

fn report_offset(buf: &[u8]) -> usize {
    match buf.first() {
        Some(0x31) => 1,
        _ => 0,
    }
}

fn find_dualsense() -> Option<CString> {
    let api = hidapi::HidApi::new().ok()?;
    let dev = api
        .device_list()
        .find(|d| d.vendor_id() == SONY_VENDOR && DUALSENSE_PRODUCTS.contains(&d.product_id()))?;
    Some(dev.path().to_owned())
}

use crate::commands;
