//! OpenRGB bridge, talking the SDK network protocol instead of the CLI.
//!
//! AJ: *"ur rgb controls suck ... u should js add a way for headed controls in
//! the ui itself. it's open source code anyway."* — correct. The old version was
//! 34 lines that shelled out `--mode static --color X` at every device at once:
//! no device list, no modes, no brightness, and **no feedback**, so the UI could
//! never say what your lighting was actually doing.
//!
//! **Ground-rule check:** this is a *client connecting out* to `127.0.0.1:6742`.
//! We never bind or listen. The project's "no public local-network port" rule is
//! about not exposing a service, and that still holds. The address is hardcoded
//! to loopback so it cannot be pointed at another machine.
//!
//! **Fail-safe is a feature.** OpenRGB is installed here but doesn't run at boot
//! (AJ), so every call may find nothing listening. Missing OpenRGB is a normal
//! state, not an error worth shouting about: we try to start it once, and if it
//! still isn't there we return a clean message the UI can show.
//!
//! Protocol reference: OpenRGB's NetworkProtocol.md. Everything is little-endian
//! with a 16-byte header — magic "ORGB", device index, command id, payload size.

use std::io::{Read, Write};
use std::net::{Ipv4Addr, SocketAddrV4, TcpStream};
use std::path::PathBuf;
use std::process::Command;
use std::time::{Duration, Instant};

use serde::Serialize;

const PORT: u16 = 6742;
const MAGIC: &[u8; 4] = b"ORGB";
/// Protocol we ask for. 3 adds per-mode brightness, which affects the struct
/// layout below — the parser branches on the *negotiated* version, not this.
const CLIENT_PROTOCOL: u32 = 3;

const CMD_REQUEST_CONTROLLER_COUNT: u32 = 0;
const CMD_REQUEST_CONTROLLER_DATA: u32 = 1;
const CMD_REQUEST_PROTOCOL_VERSION: u32 = 40;
const CMD_SET_CLIENT_NAME: u32 = 50;
const CMD_UPDATE_LEDS: u32 = 1050;
const CMD_UPDATE_MODE: u32 = 1101;

fn executable() -> Option<PathBuf> {
    [
        PathBuf::from(r"C:\Program Files\OpenRGB\OpenRGB.exe"),
        PathBuf::from(r"C:\Program Files (x86)\OpenRGB\OpenRGB.exe"),
    ]
    .into_iter()
    .find(|path| path.is_file())
}

pub fn open_gui() -> Result<(), String> {
    let exe = executable().ok_or("OpenRGB is not installed in its standard location.")?;
    Command::new(exe).arg("--gui").spawn().map_err(|e| e.to_string())?;
    Ok(())
}

// ── Wire helpers ────────────────────────────────────────────────────────────

/// Bounds-checked little-endian reader. Every field is read through this rather
/// than by offset math: this parses a device's self-description, and a firmware
/// or version quirk that yields a short buffer must surface as a clean error,
/// never a panic that takes the launcher down with it.
struct Cursor<'a> {
    data: &'a [u8],
    at: usize,
}

impl<'a> Cursor<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self { data, at: 0 }
    }
    fn take(&mut self, n: usize) -> Result<&'a [u8], String> {
        let end = self.at.checked_add(n).ok_or("openrgb: length overflow")?;
        let slice = self.data.get(self.at..end).ok_or("openrgb: truncated packet")?;
        self.at = end;
        Ok(slice)
    }
    fn u16(&mut self) -> Result<u16, String> {
        Ok(u16::from_le_bytes(self.take(2)?.try_into().unwrap()))
    }
    fn u32(&mut self) -> Result<u32, String> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }
    fn i32(&mut self) -> Result<i32, String> {
        Ok(i32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }
    /// u16 length prefix, then that many bytes including a trailing NUL.
    fn string(&mut self) -> Result<String, String> {
        let len = self.u16()? as usize;
        let raw = self.take(len)?;
        Ok(String::from_utf8_lossy(raw.split(|b| *b == 0).next().unwrap_or(raw)).into_owned())
    }
    fn skip(&mut self, n: usize) -> Result<(), String> {
        self.take(n).map(|_| ())
    }
}

fn header(device: u32, command: u32, size: u32) -> Vec<u8> {
    let mut out = Vec::with_capacity(16);
    out.extend_from_slice(MAGIC);
    out.extend_from_slice(&device.to_le_bytes());
    out.extend_from_slice(&command.to_le_bytes());
    out.extend_from_slice(&size.to_le_bytes());
    out
}

struct Client {
    stream: TcpStream,
    protocol: u32,
}

impl Client {
    fn connect() -> Result<Self, String> {
        let address = SocketAddrV4::new(Ipv4Addr::LOCALHOST, PORT);
        let stream = TcpStream::connect_timeout(&address.into(), Duration::from_millis(600))
            .map_err(|_| "not running".to_string())?;
        stream.set_read_timeout(Some(Duration::from_millis(1500))).ok();
        stream.set_write_timeout(Some(Duration::from_millis(1500))).ok();
        // Nagle would add latency to these tiny request/response round-trips.
        stream.set_nodelay(true).ok();

        let mut client = Client { stream, protocol: 0 };
        client.send(0, CMD_SET_CLIENT_NAME, b"PS5 Mode\0")?;
        client.protocol = client.negotiate_protocol().unwrap_or(0);
        Ok(client)
    }

    fn send(&mut self, device: u32, command: u32, payload: &[u8]) -> Result<(), String> {
        let mut packet = header(device, command, payload.len() as u32);
        packet.extend_from_slice(payload);
        self.stream.write_all(&packet).map_err(|e| e.to_string())
    }

    /// Read one packet's payload, checking the magic so a desynchronised stream
    /// fails loudly instead of being parsed as garbage.
    fn recv(&mut self) -> Result<Vec<u8>, String> {
        let mut head = [0u8; 16];
        self.stream.read_exact(&mut head).map_err(|e| e.to_string())?;
        if &head[0..4] != MAGIC {
            return Err("openrgb: bad magic (stream out of sync)".into());
        }
        let size = u32::from_le_bytes(head[12..16].try_into().unwrap()) as usize;
        // Sanity bound: a controller blob is kilobytes, not megabytes. Prevents
        // a corrupt length from asking us to allocate wildly.
        if size > 4 * 1024 * 1024 {
            return Err("openrgb: implausible packet size".into());
        }
        let mut body = vec![0u8; size];
        self.stream.read_exact(&mut body).map_err(|e| e.to_string())?;
        Ok(body)
    }

    fn negotiate_protocol(&mut self) -> Result<u32, String> {
        self.send(0, CMD_REQUEST_PROTOCOL_VERSION, &CLIENT_PROTOCOL.to_le_bytes())?;
        let body = self.recv()?;
        let server = u32::from_le_bytes(body.get(0..4).ok_or("openrgb: short version")?.try_into().unwrap());
        Ok(server.min(CLIENT_PROTOCOL))
    }

    fn controller_count(&mut self) -> Result<u32, String> {
        self.send(0, CMD_REQUEST_CONTROLLER_COUNT, &[])?;
        let body = self.recv()?;
        Ok(u32::from_le_bytes(body.get(0..4).ok_or("openrgb: short count")?.try_into().unwrap()))
    }

    fn controller(&mut self, index: u32) -> Result<Device, String> {
        self.send(index, CMD_REQUEST_CONTROLLER_DATA, &self.protocol.to_le_bytes())?;
        let body = self.recv()?;
        parse_device(index, &body, self.protocol)
    }
}

// ── Device model ────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct Mode {
    pub index: u32,
    pub name: String,
}

#[derive(Serialize, Clone)]
pub struct Device {
    pub index: u32,
    pub name: String,
    pub kind: String,
    pub led_count: u32,
    pub active_mode: i32,
    pub modes: Vec<Mode>,
}

/// Device type enum from the SDK, mapped to something a person reads.
fn device_kind(value: u32) -> &'static str {
    match value {
        0 => "Motherboard",
        1 => "DRAM",
        2 => "GPU",
        3 => "Cooler",
        4 => "LED Strip",
        5 => "Keyboard",
        6 => "Mouse",
        7 => "Mousemat",
        8 => "Headset",
        9 => "Headset Stand",
        10 => "Gamepad",
        11 => "Light",
        12 => "Speaker",
        13 => "Virtual",
        14 => "Storage",
        15 => "Case",
        16 => "Microphone",
        17 => "Accessory",
        18 => "Keypad",
        _ => "Unknown",
    }
}

/// Parse one controller blob. Layout is version-dependent — protocol 3 adds
/// per-mode brightness, and 4 adds a per-mode flag block — so the fields we
/// don't use are still *skipped by the right amount* for the negotiated
/// version. Getting that wrong silently shifts everything after it.
fn parse_device(index: u32, body: &[u8], protocol: u32) -> Result<Device, String> {
    let mut c = Cursor::new(body);
    c.skip(4)?; // total data size, already known from the header
    let kind = c.u32()?;
    let name = c.string()?;
    // `vendor` sits between name and description. Verified against a live
    // server (2026-07-20): the DualSense reports name "Sony DualSense (BT)"
    // then vendor "Sony". Omitting it shifted every subsequent field by one
    // string and blew up inside the mode loop with a bogus 23KB length — which
    // is exactly the failure mode the bounds-checked cursor exists to turn into
    // an error instead of a panic.
    let _vendor = c.string()?;
    let _description = c.string()?;
    let _version = c.string()?;
    let _serial = c.string()?;
    let _location = c.string()?;

    let mode_count = c.u16()? as usize;
    let active_mode = c.i32()?;
    let mut modes = Vec::with_capacity(mode_count);
    for i in 0..mode_count {
        let mode_name = c.string()?;
        c.skip(4)?; // value
        c.skip(4)?; // flags
        c.skip(4 + 4)?; // speed_min, speed_max
        if protocol >= 3 {
            c.skip(4 + 4)?; // brightness_min, brightness_max
        }
        c.skip(4 + 4)?; // colors_min, colors_max
        c.skip(4)?; // speed
        if protocol >= 3 {
            c.skip(4)?; // brightness
        }
        c.skip(4)?; // direction
        c.skip(4)?; // color_mode
        let colors = c.u16()? as usize;
        c.skip(colors * 4)?;
        modes.push(Mode { index: i as u32, name: mode_name });
    }

    // Zones — skipped, but their variable-length matrix has to be consumed
    // exactly or the LED count read after it is nonsense.
    let zone_count = c.u16()? as usize;
    for _ in 0..zone_count {
        let _zone_name = c.string()?;
        c.skip(4)?; // type
        c.skip(4 + 4 + 4)?; // leds_min, leds_max, leds_count
        let matrix_len = c.u16()? as usize;
        c.skip(matrix_len)?;
    }

    let led_count = c.u16()? as u32;

    Ok(Device { index, name, kind: device_kind(kind).to_string(), led_count, active_mode, modes })
}

// ── Public API ──────────────────────────────────────────────────────────────

/// Try to connect; if nothing is listening, start OpenRGB's server once and
/// wait briefly for it. AJ has it installed but it doesn't launch at boot, so
/// this is the normal path, not an edge case.
fn connect_or_start() -> Result<Client, String> {
    if let Ok(client) = Client::connect() {
        return Ok(client);
    }

    // CRITICAL: never spawn a second instance. Verified on this machine
    // (2026-07-20) that OpenRGB can be running with its SDK server switched
    // off — the GUI's "Enable SDK Server" is a setting, and launching without
    // `--server` leaves nothing listening. In that state a naive "connect
    // failed, so start it" would fire up a *second* OpenRGB, and two processes
    // driving the same RGB controllers over USB is a good way to wedge the
    // hardware. If one is already running, say what's wrong instead.
    if openrgb_is_running() {
        return Err(
            "OpenRGB is running but its SDK server is off. Turn on \
             Settings > General > Enable SDK Server in OpenRGB, or restart it \
             with --server."
                .into(),
        );
    }

    let exe = executable().ok_or("OpenRGB is not installed in its standard location.")?;
    Command::new(exe)
        .args(["--server", "--startminimized"])
        .spawn()
        .map_err(|e| format!("could not start OpenRGB: {e}"))?;

    // Poll rather than sleeping a fixed amount — first start enumerates real
    // hardware and can take a couple of seconds, but usually it's much faster.
    let deadline = Instant::now() + Duration::from_secs(6);
    while Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(250));
        if let Ok(client) = Client::connect() {
            return Ok(client);
        }
    }
    Err("OpenRGB did not start listening in time.".into())
}

/// Is an OpenRGB process already up? Uses `sysinfo`, already a dependency.
fn openrgb_is_running() -> bool {
    use sysinfo::System;
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All);
    sys.processes()
        .values()
        .any(|p| p.name().to_string_lossy().eq_ignore_ascii_case("OpenRGB.exe"))
}

#[derive(Serialize)]
pub struct RgbState {
    pub available: bool,
    pub message: Option<String>,
    pub devices: Vec<Device>,
}

/// Enumerate everything OpenRGB can see. This is the whole point of the rebuild:
/// the UI can finally show what lighting exists and what it's doing.
pub fn devices() -> RgbState {
    match connect_or_start() {
        Ok(mut client) => {
            let count = match client.controller_count() {
                Ok(n) => n,
                Err(error) => {
                    return RgbState { available: false, message: Some(error), devices: Vec::new() }
                }
            };
            let mut devices = Vec::new();
            let mut first_error = None;
            for i in 0..count {
                match client.controller(i) {
                    Ok(device) => devices.push(device),
                    // One unparseable device must not hide the rest.
                    Err(error) => {
                        if first_error.is_none() {
                            first_error = Some(error);
                        }
                    }
                }
            }
            RgbState { available: true, message: first_error, devices }
        }
        Err(error) => RgbState { available: false, message: Some(error), devices: Vec::new() },
    }
}

/// Set every LED on one device to a single colour.
///
/// OpenRGB packs colours as 0x00BBGGRR, not RGB — getting this backwards is the
/// classic bug here and shows up as red/blue swapped.
pub fn set_device_color(index: u32, red: u8, green: u8, blue: u8) -> Result<(), String> {
    let mut client = connect_or_start()?;
    let device = client.controller(index)?;
    let leds = device.led_count.max(1) as usize;

    let mut payload = Vec::with_capacity(6 + leds * 4);
    payload.extend_from_slice(&0u32.to_le_bytes()); // data size, filled in below
    payload.extend_from_slice(&(leds as u16).to_le_bytes());
    for _ in 0..leds {
        payload.extend_from_slice(&[red, green, blue, 0]);
    }
    let size = payload.len() as u32;
    payload[0..4].copy_from_slice(&size.to_le_bytes());

    client.send(index, CMD_UPDATE_LEDS, &payload)
}

/// Switch a device to one of the modes it reported.
pub fn set_device_mode(index: u32, mode: u32) -> Result<(), String> {
    let mut client = connect_or_start()?;
    // UPDATE_MODE echoes back the full mode struct. Rather than re-serialising
    // it (and risking a malformed write to hardware), send the mode index with
    // an empty descriptor, which OpenRGB accepts as "switch to this mode".
    let mut payload = Vec::new();
    payload.extend_from_slice(&0u32.to_le_bytes()); // size placeholder
    payload.extend_from_slice(&mode.to_le_bytes());
    let size = payload.len() as u32;
    payload[0..4].copy_from_slice(&size.to_le_bytes());
    client.send(index, CMD_UPDATE_MODE, &payload)
}

/// The curated presets, kept as one-press shortcuts on top of real control
/// rather than instead of it. Now applied through the SDK to every enumerated
/// device, so they report failure properly instead of firing a CLI into the void.
pub fn set_scene(scene: &str) -> Result<(), String> {
    let (r, g, b) = match scene {
        "ice" => (0x75, 0xC8, 0xFF),
        "violet" => (0x9D, 0x7C, 0xFF),
        "warm" => (0xFF, 0x9A, 0x61),
        "off" => (0x00, 0x00, 0x00),
        _ => return Err("Unknown RGB scene.".into()),
    };
    let state = devices();
    if !state.available {
        return Err(state.message.unwrap_or_else(|| "OpenRGB is unavailable.".into()));
    }
    let mut last_error = None;
    for device in &state.devices {
        if let Err(error) = set_device_color(device.index, r, g, b) {
            last_error = Some(error);
        }
    }
    match last_error {
        Some(error) => Err(error),
        None => Ok(()),
    }
}
