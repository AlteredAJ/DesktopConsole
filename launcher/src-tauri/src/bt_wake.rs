// BT wake handshake — CONFIRMED NECESSARY ON REAL HARDWARE (2026-07-11 verification).
// Identical to listener/src/bt_wake.rs — see that file's header comment for the
// full explanation. Kept duplicated rather than shared across the two crates to
// avoid introducing a third workspace member just for ~25 lines.

use hidapi::HidDevice;

pub fn send(device: &HidDevice) {
    let mut usb = [0u8; 48];
    usb[0] = 0x02;
    usb[2] = 0x10;
    usb[44] = 0x04;

    let mut bt = [0u8; 78];
    bt[0] = 0x31;
    bt[1] = 0x00;
    bt[2] = 0x10;
    bt[3..50].copy_from_slice(&usb[1..48]);

    let mut hasher = crc32fast::Hasher::new();
    hasher.update(&[0xA2]);
    hasher.update(&bt[0..74]);
    let crc = hasher.finalize();
    bt[74..78].copy_from_slice(&crc.to_le_bytes());

    let _ = device.write(&bt);
}
