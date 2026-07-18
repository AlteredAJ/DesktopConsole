// BT wake handshake — CONFIRMED NECESSARY ON REAL HARDWARE (2026-07-11 verification).
//
// Over Bluetooth, the DualSense starts in a minimal input-report mode and never
// switches to the full 78-byte extended report (0x31) until the host sends it ANY
// output report. Before this write, every read comes back as report id=0x01 with
// n=78 but every button/touchpad byte is permanently zero regardless of input —
// a silent failure mode, not a crash, so it's easy to mistake for wrong byte
// offsets. Reference: dualsense-haptics-windows-src hid.rs:2490-2494 (comment),
// :1036-1091 (report builders).
//
// USB devices don't need this (they start in full-report mode already), but
// sending it is harmless there too — write() is a no-op cost either way — so we
// always send it once right after opening the device rather than branching on
// transport.

use hidapi::HidDevice;

/// Minimal output report: sets the player LED to a fixed pattern. Any valid output
/// report works as the "wake" trigger; this one is easy to eyeball (LED lights up)
/// as a side-channel confirmation that the write actually landed.
pub fn send(device: &HidDevice) {
    let mut usb = [0u8; 48];
    usb[0] = 0x02;
    usb[2] = 0x10; // validFlag1: player LED
    usb[44] = 0x04; // PLAYER_LED pattern (matches dualsense-haptics PLAYER_LED[0])

    let mut bt = [0u8; 78];
    bt[0] = 0x31;
    bt[1] = 0x00; // seq nibble — 0 is fine for a one-shot wake write
    bt[2] = 0x10; // DS_OUTPUT_TAG
    bt[3..50].copy_from_slice(&usb[1..48]);

    let mut hasher = crc32fast::Hasher::new();
    hasher.update(&[0xA2]); // BT_CRC_SEED
    hasher.update(&bt[0..74]);
    let crc = hasher.finalize();
    bt[74..78].copy_from_slice(&crc.to_le_bytes());

    // Best-effort: if this fails (e.g. actually USB, which doesn't want the BT
    // framing), the device just ignores/rejects it — reads still work either way.
    let _ = device.write(&bt);
}
