// Haptic confirmation pulses — fired ONLY when the frontend actually acts on an
// input (focus moved, tab switched, tile opened, swipe accepted). No pulse means
// "that didn't register" — the whole point per the user's ask, so callers must
// gate on a real state change, not just an input attempt.
//
// Runs on its own thread with its own HID handle so a pulse's on/off write-and-
// sleep sequence never blocks the input read loop (which owns the read-side
// handle in hid.rs). Two independent hidapi opens to the same device is fine on
// Windows for non-exclusive HID access — the existing dualsense-haptics codebase
// relies on the same assumption for its read/write split.
//
// Report format CONFIRMED from dualsense-haptics-windows-src hid.rs:1232-1245
// (with_rumble): validFlag0 |= 0x02 (HAPTICS_SELECT), byte 39 |= 0x04
// (COMPATIBLE_VIBRATION2) — the legacy flag0 bit 0x01 path is deliberately
// firmware-attenuated and must NOT be set alongside this, or it falls back weak.

use std::sync::mpsc::{self, Sender};
use std::sync::OnceLock;
use std::thread;
use std::time::Duration;

const SONY_VENDOR: u16 = 0x054C;
const DUALSENSE_PRODUCT: u16 = 0x0CE6;

struct Pulse {
    left: u8,
    right: u8,
    duration_ms: u64,
}

static SENDER: OnceLock<Sender<Pulse>> = OnceLock::new();

pub fn init() {
    let (tx, rx) = mpsc::channel::<Pulse>();
    let _ = SENDER.set(tx);
    thread::spawn(move || rumble_thread(rx));
}

/// Light nav tick — confirms focus actually moved (D-pad, swipe, tab switch).
/// CONFIRMED on real hardware: the original values here (55/90, 45ms) were too
/// weak/short to feel at all, especially with the pad resting on a couch/bed.
/// Bumped well above the DualSense's felt threshold.
pub fn confirm() {
    send(Pulse { left: 130, right: 170, duration_ms: 70 });
}

/// Stronger pulse for a committed action (tile opened, app launched) — should
/// read as distinctly heavier than a nav tick, not just a longer version of it.
pub fn select() {
    send(Pulse { left: 210, right: 230, duration_ms: 110 });
}

fn send(p: Pulse) {
    if let Some(tx) = SENDER.get() {
        // Non-blocking from the caller's perspective; drop if the rumble thread
        // is mid-pulse and the channel briefly backs up rather than queuing a
        // pile of stale buzzes.
        let _ = tx.send(p);
    }
}

fn rumble_thread(rx: std::sync::mpsc::Receiver<Pulse>) {
    // CONFIRMED bug fix: opening a fresh HID connection for every single pulse
    // (open -> write -> sleep -> write -> drop) was unreliable over Bluetooth —
    // rapid open/close cycles on a BT HID device don't reliably land the write
    // before teardown. Hold ONE persistent connection instead, same pattern as
    // hid.rs's input loop, and reconnect only on an actual read/write failure.
    let mut device: Option<hidapi::HidDevice> = None;

    loop {
        let Ok(pulse) = rx.recv() else { return };

        if device.is_none() {
            device = connect();
            if device.is_none() {
                eprintln!("[rumble] no DualSense found, dropping pulse");
                continue;
            }
        }
        let dev = device.as_ref().unwrap();

        let on_ok = write_report(dev, &to_bt_report(&build_rumble(pulse.left, pulse.right)));
        thread::sleep(Duration::from_millis(pulse.duration_ms));
        let off_ok = write_report(dev, &to_bt_report(&build_rumble(0, 0)));

        #[cfg(debug_assertions)]
        eprintln!("[rumble] pulse l={} r={} dur={}ms on_write_ok={on_ok} off_write_ok={off_ok}",
            pulse.left, pulse.right, pulse.duration_ms);

        if !on_ok || !off_ok {
            // Write failed — handle is probably stale (device slept/reconnected).
            // Drop it so the next pulse reconnects.
            device = None;
        }

        // Drain any pulses that queued up while this one was playing so a burst
        // of nav input doesn't leave a backlog of delayed buzzes.
        while rx.try_recv().is_ok() {}
    }
}

fn connect() -> Option<hidapi::HidDevice> {
    let path = find_dualsense()?;
    let api = hidapi::HidApi::new().ok()?;
    api.open_path(&path).ok()
}

fn write_report(device: &hidapi::HidDevice, report: &[u8; 78]) -> bool {
    // CONFIRMED bug: hidapi's returned byte count over Bluetooth does NOT
    // reliably match the report length (bt_wake's own write logged 547 bytes
    // for a 78-byte report during hardware verification) — comparing against
    // report.len() made every single write register as "failed" even though
    // it landed, which then forced a full reconnect after every pulse. Any
    // Ok(_) means the OS accepted the write; that's the only thing to check.
    match device.write(report) {
        Ok(_) => true,
        Err(_e) => {
            #[cfg(debug_assertions)]
            eprintln!("[rumble] write failed: {_e}");
            false
        }
    }
}

fn build_rumble(left: u8, right: u8) -> [u8; 48] {
    let mut b = [0u8; 48];
    b[0] = 0x02;
    if left > 0 || right > 0 {
        b[1] |= 0x02; // HAPTICS_SELECT
        b[39] |= 0x04; // COMPATIBLE_VIBRATION2
        b[3] = right; // right motor: high-freq, weak
        b[4] = left; // left motor: low-freq, strong
    }
    b
}

/// Same BT wrapping as bt_wake.rs, EXCEPT the sequence nibble now increments —
/// CONFIRMED root cause of "no haptics felt at all": the reference codebase's own
/// comment on this exact header says a wrong/stale sequence makes the pad
/// silently drop every report (hid.rs:1063-1064 in dualsense-haptics). bt_wake.rs
/// gets away with a hardcoded 0 because it only ever sends ONE report per
/// connection; rumble sends many in a row and needs each to look new.
fn to_bt_report(usb: &[u8; 48]) -> [u8; 78] {
    use std::sync::atomic::{AtomicU8, Ordering};
    static SEQ: AtomicU8 = AtomicU8::new(1);
    let seq = SEQ.fetch_add(1, Ordering::Relaxed) & 0x0F;

    let mut bt = [0u8; 78];
    bt[0] = 0x31;
    bt[1] = seq << 4;
    bt[2] = 0x10;
    bt[3..50].copy_from_slice(&usb[1..48]);

    let mut hasher = crc32fast::Hasher::new();
    hasher.update(&[0xA2]);
    hasher.update(&bt[0..74]);
    let crc = hasher.finalize();
    bt[74..78].copy_from_slice(&crc.to_le_bytes());
    bt
}

fn find_dualsense() -> Option<std::ffi::CString> {
    let api = hidapi::HidApi::new().ok()?;
    let dev = api
        .device_list()
        .find(|d| d.vendor_id() == SONY_VENDOR && d.product_id() == DUALSENSE_PRODUCT)?;
    Some(dev.path().to_owned())
}
