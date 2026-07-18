// HID polling for the listener. ADAPTED from dualsense-haptics-windows-src hid.rs
// (find_dualsense @ :2895-2905, read loop @ :2683). Strip ALL haptic-output code —
// this side only reads input to watch the PS button.

use std::ffi::CString;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use tauri::AppHandle;

use crate::triple_click::ClickTracker;

const SONY_VENDOR: u16 = 0x054C;
const DUALSENSE_PRODUCTS: &[u16] = &[0x0CE6, 0x0DF2]; // DualSense + DualSense Edge

// PS button bit. CONFIRMED on real hardware 2026-07-11 (BT): buf[10] & 0x01 fires
// exactly on PS press/release and nothing else.
const PS_BUTTON_MASK: u8 = 0x01;

/// True while a launcher session is active — suppresses re-triggering.
pub static SESSION_ACTIVE: AtomicBool = AtomicBool::new(false);

pub fn spawn_listener_thread(app: AppHandle) {
    thread::spawn(move || supervisor(app));
}

/// Restarts listen_loop if it ever panics or returns — a silently-dead listener
/// thread (tray icon still there, but nothing responds to the controller) is the
/// worst failure mode for a background app, since nothing visibly signals it.
fn supervisor(app: AppHandle) {
    loop {
        let app_for_loop = app.clone();
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            listen_loop(app_for_loop);
        }));
        if let Err(e) = result {
            eprintln!("[listener] listen_loop panicked, restarting: {e:?}");
        } else {
            eprintln!("[listener] listen_loop returned unexpectedly, restarting");
        }
        // SESSION_ACTIVE may be stuck true if the panic happened mid-session —
        // clear it so a restart doesn't leave triple-click permanently disabled.
        SESSION_ACTIVE.store(false, Ordering::Relaxed);
        thread::sleep(Duration::from_millis(500));
    }
}

fn listen_loop(app: AppHandle) {
    let mut tracker = ClickTracker::new();
    let mut prev_ps = false;
    #[cfg(windows)]
    let mut launcher_guard_until: Option<Instant> = None;
    #[cfg(windows)]
    let mut cursor_state = crate::cursor_mode::State::new();

    loop {
        // Windows may grant this HID device exclusively. Once the listener has
        // opened a launcher, release the handle so that launcher can receive
        // D-pad, stick, and touchpad reports. The child-wait thread clears
        // SESSION_ACTIVE when the launcher closes, then we reconnect.
        if SESSION_ACTIVE.load(Ordering::Relaxed) {
            thread::sleep(Duration::from_millis(250));
            continue;
        }
        // (Re)connect: DualSense may be unplugged / asleep. Retry politely.
        let path = match find_dualsense() {
            Some(p) => p,
            None => {
                thread::sleep(Duration::from_millis(400));
                continue;
            }
        };

        let api = match hidapi::HidApi::new() {
            Ok(a) => a,
            Err(_) => {
                thread::sleep(Duration::from_millis(400));
                continue;
            }
        };
        let device = match api.open_path(&path) {
            Ok(d) => d,
            Err(_) => {
                thread::sleep(Duration::from_millis(400));
                continue;
            }
        };

        // CONFIRMED NECESSARY on real hardware (BT): without this, every read comes
        // back as the crippled 10-byte report and buf[10] never changes no matter
        // what's pressed. See bt_wake.rs for details. Harmless if actually USB.
        crate::bt_wake::send(&device);
        thread::sleep(Duration::from_millis(150));

        let mut buf = [0u8; 78];
        loop {
            // read_timeout keeps CPU near-zero when idle (pattern from hid.rs:2683).
            match device.read_timeout(&mut buf, 100) {
                Ok(0) => continue,        // timeout, no data
                Ok(_) => {}
                Err(_) => break,          // device dropped — reconnect
            }

            // CONFIRMED on real hardware: USB/pre-wake reports use id 0x01 (off=0),
            // post-wake BT extended reports use id 0x31 (off=1, one extra header byte).
            let off = report_offset(&buf);
            let b10 = buf.get(off + 10).copied().unwrap_or(0);

            #[cfg(debug_assertions)]
            dump_raw_report(&buf, off);

            // Touchpad: same confirmed offsets as launcher/src-tauri/src/hid.rs
            // (buf[33] bit7 = finger-up when set; buf[34..37] packed 12-bit X/Y).
            #[cfg(windows)]
            {
                let g = |i: usize| buf.get(off + i).copied().unwrap_or(0);
                let touch_active = (g(33) & 0x80) == 0;
                let touch_x = (g(34) as u16) | (((g(35) & 0x0F) as u16) << 8);
                let touch_y = ((g(35) >> 4) as u16) | ((g(36) as u16) << 4);
                cursor_state.feed(b10, touch_active, touch_x, touch_y);
            }

            let ps_now = (b10 & PS_BUTTON_MASK) != 0;
            let rising_edge = ps_now && !prev_ps;
            prev_ps = ps_now;

            #[cfg(debug_assertions)]
            if rising_edge {
                eprintln!("[triple_click] PS rising edge at {:?}", std::time::Instant::now());
            }

            #[cfg(windows)]
            if rising_edge && crate::cursor_mode::foreground_is_launcher() {
                // If the launcher was opened directly, this gesture belongs to
                // its own UI. Keep a short guard even if it minimizes before
                // this listener receives the final press.
                launcher_guard_until = Some(Instant::now() + Duration::from_millis(750));
            }

            if !SESSION_ACTIVE.load(Ordering::Relaxed) && tracker.feed(rising_edge) {
                #[cfg(windows)]
                if launcher_guard_until.is_some_and(|until| Instant::now() <= until) {
                    launcher_guard_until = None;
                    continue;
                }
                #[cfg(debug_assertions)]
                eprintln!("[triple_click] FIRED â€” spawning launcher");
                SESSION_ACTIVE.store(true, Ordering::Relaxed);
                #[cfg(windows)]
                crate::cursor_mode::MOUSE_MODE.store(false, Ordering::Relaxed);
                crate::launch::spawn_launcher(&app);
                // Drop this reader immediately; the launcher now owns controller input.
                break;
            }
        }
    }
}

/// Byte offset into the raw report: 0 for USB (0x01), 1 for BT extended (0x31).
/// TODO(Unit A): confirm against hid.rs — the reference derives this from buf[0].
fn report_offset(buf: &[u8]) -> usize {
    match buf.first() {
        Some(0x31) => 1, // Bluetooth extended report
        _ => 0,          // USB
    }
}

/// Enumerate HID devices and return the DualSense path. Copy of hid.rs:2895-2905.
fn find_dualsense() -> Option<CString> {
    let api = hidapi::HidApi::new().ok()?;
    let dev = api.device_list().find(|d| {
        d.vendor_id() == SONY_VENDOR && DUALSENSE_PRODUCTS.contains(&d.product_id())
    })?;
    Some(dev.path().to_owned())
}

/// TEMP debug aid (Unit A step 1). Prints buf[8..12] so you can watch which bit of
/// buf[10] the PS button toggles. DELETE once PS_BUTTON_MASK is confirmed.
#[cfg(debug_assertions)]
fn dump_raw_report(buf: &[u8], off: usize) {
    use std::sync::atomic::{AtomicU32, Ordering};
    static N: AtomicU32 = AtomicU32::new(0);
    // Throttle: every ~30th report to keep the console readable.
    if N.fetch_add(1, Ordering::Relaxed) % 30 != 0 {
        return;
    }
    let s = |i: usize| buf.get(off + i).copied().unwrap_or(0);
    eprintln!(
        "raw off={off} b8={:08b} b9={:08b} b10={:08b} b11={:08b}",
        s(8), s(9), s(10), s(11)
    );
}

// Suppress unused warning until Unit B (used there for the launcher hand-off, kept
// here so the shared reconnect logic has one home if we later factor it out).
#[allow(dead_code)]
type Reconnect = Arc<AtomicBool>;
