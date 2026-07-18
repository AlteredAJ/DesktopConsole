//! Short, immediate DualSense pulses for listener-owned desktop gestures.

use std::thread;
use std::time::Duration;

const SONY_VENDOR: u16 = 0x054C;
const PRODUCTS: &[u16] = &[0x0CE6, 0x0DF2];

pub fn mouse_mode_changed(enabled: bool) {
    thread::spawn(move || {
        let Some(device) = connect() else { return };
        let (left, right, duration) = if enabled { (205, 230, 100) } else { (105, 145, 58) };
        let _ = device.write(&bt_report(left, right));
        thread::sleep(Duration::from_millis(duration));
        let _ = device.write(&bt_report(0, 0));
    });
}

fn connect() -> Option<hidapi::HidDevice> {
    let api = hidapi::HidApi::new().ok()?;
    let path = api.device_list().find(|device| {
        device.vendor_id() == SONY_VENDOR && PRODUCTS.contains(&device.product_id())
    })?.path().to_owned();
    api.open_path(&path).ok()
}

fn bt_report(left: u8, right: u8) -> [u8; 78] {
    use std::sync::atomic::{AtomicU8, Ordering};
    static SEQUENCE: AtomicU8 = AtomicU8::new(1);
    let mut usb = [0u8; 48];
    usb[0] = 0x02;
    if left != 0 || right != 0 {
        usb[1] |= 0x02;
        usb[39] |= 0x04;
        usb[3] = right;
        usb[4] = left;
    }
    let mut bt = [0u8; 78];
    bt[0] = 0x31;
    bt[1] = (SEQUENCE.fetch_add(1, Ordering::Relaxed) & 0x0F) << 4;
    bt[2] = 0x10;
    bt[3..50].copy_from_slice(&usb[1..48]);
    let mut hasher = crc32fast::Hasher::new();
    hasher.update(&[0xA2]);
    hasher.update(&bt[..74]);
    bt[74..78].copy_from_slice(&hasher.finalize().to_le_bytes());
    bt
}