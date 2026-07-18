// HID byte verifier — `cargo run -p ps5-listener --example dump`
//
// Prints buf[8..11] whenever they CHANGE, plus the assumed touchpad bytes [33..37].
// Use it to confirm:
//   1. PS button bit      (press PS alone — watch b10)
//   2. Options button bit (press Options alone — watch b9/b10)
//   3. Touchpad X/Y bytes (drag a finger — watch t33..t36)
// Ctrl+C to quit.

use std::time::Duration;

const SONY_VENDOR: u16 = 0x054C;
const DUALSENSE_PRODUCT: u16 = 0x0CE6;

fn main() {
    let api = hidapi::HidApi::new().expect("hidapi init failed");

    // Sanity check: list EVERYTHING hidapi can see, so a total-enumeration failure
    // is distinguishable from "just this VID/PID isn't found."
    let all: Vec<_> = api.device_list().collect();
    println!("hidapi sees {} total HID devices:", all.len());
    for d in &all {
        println!(
            "  vid={:#06x} pid={:#06x} usage_page={:#06x} usage={:#06x} product={:?} path={:?}",
            d.vendor_id(),
            d.product_id(),
            d.usage_page(),
            d.usage(),
            d.product_string(),
            d.path()
        );
    }
    println!();

    let dev_info = api
        .device_list()
        .find(|d| d.vendor_id() == SONY_VENDOR && d.product_id() == DUALSENSE_PRODUCT)
        .expect("no DualSense found — plug it in (USB) or pair over BT");
    println!(
        "found DualSense: {:?} (usage_page {:#06x})",
        dev_info.product_string(),
        dev_info.usage_page()
    );
    let device = api.open_path(dev_info.path()).expect("open failed");

    // BT WAKE HANDSHAKE: the pad starts in a minimal report mode over Bluetooth and
    // only switches to the full 78-byte 0x31 report after receiving ANY output
    // report. Send a harmless "set player LED" report once to trigger that switch.
    // (Confirmed via dualsense-haptics-windows-src hid.rs:2490-2494, 1036-1080.)
    {
        let mut usb = [0u8; 48];
        usb[0] = 0x02;
        usb[2] = 0x10;
        usb[44] = 0x04; // player LED pattern, arbitrary non-zero value

        let mut bt = [0u8; 78];
        bt[0] = 0x31;
        bt[1] = 0x00 << 4;
        bt[2] = 0x10;
        bt[3..50].copy_from_slice(&usb[1..48]);
        let mut hasher = crc32fast::Hasher::new();
        hasher.update(&[0xA2]);
        hasher.update(&bt[0..74]);
        let crc = hasher.finalize();
        bt[74..78].copy_from_slice(&crc.to_le_bytes());

        match device.write(&bt) {
            Ok(n) => println!("wake handshake: wrote {n} bytes"),
            Err(e) => println!("wake handshake FAILED: {e} (continuing anyway — might be USB)"),
        }
    }
    std::thread::sleep(Duration::from_millis(200));

    let mut buf = [0u8; 78];
    let mut prev: Option<([u8; 4], [u8; 4])> = None;
    let mut reads = 0u64;
    let mut timeouts = 0u64;
    let mut last_heartbeat = std::time::Instant::now();

    println!("press buttons / drag touchpad — printing on change…");
    loop {
        if last_heartbeat.elapsed() > Duration::from_secs(2) {
            println!("[heartbeat] reads={reads} timeouts={timeouts} (last 2s)");
            reads = 0;
            timeouts = 0;
            last_heartbeat = std::time::Instant::now();
        }
        match device.read_timeout(&mut buf, 100) {
            Ok(0) => {
                timeouts += 1;
                continue;
            }
            Ok(n) => {
                reads += 1;
                // BT extended report (0x31) is offset by 1 vs USB (0x01).
                let off = if buf[0] == 0x31 { 1 } else { 0 };
                let g = |i: usize| buf.get(off + i).copied().unwrap_or(0);

                let btn = [g(8), g(9), g(10), g(11)];
                let tp = [g(33), g(34), g(35), g(36)];
                let cur = (btn, tp);

                if prev.as_ref() != Some(&cur) {
                    println!(
                        "id={:#04x} n={n:2} | b8={:08b} b9={:08b} b10={:08b} b11={:08b} | t33={:3} t34={:3} t35={:3} t36={:3}",
                        buf[0], btn[0], btn[1], btn[2], btn[3], tp[0], tp[1], tp[2], tp[3]
                    );
                    prev = Some(cur);
                }
            }
            Err(e) => {
                eprintln!("read error: {e} — device dropped?");
                std::thread::sleep(Duration::from_millis(500));
            }
        }
    }
}
