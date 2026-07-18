// Settings > Bluetooth — radio on/off + paired device list via WinRT
// (Windows.Devices.Radios / Windows.Devices.Bluetooth). Scoped to that: NOT
// scan-and-pair-new-device, which needs DeviceWatcher + custom pairing
// ceremonies (PIN entry etc.) — meaningfully bigger, and PIN entry has nowhere
// to go until the real swipe-keyboard exists. Toggle + "what's paired" covers
// the everyday case.

#![cfg(windows)]

use windows::Devices::Bluetooth::BluetoothDevice;
use windows::Devices::Enumeration::DeviceInformation;
use windows::Devices::Radios::{Radio, RadioKind, RadioState};

fn bluetooth_radio() -> windows::core::Result<Option<Radio>> {
    let radios = Radio::GetRadiosAsync()?.get()?;
    for i in 0..radios.Size()? {
        let radio = radios.GetAt(i)?;
        if radio.Kind()? == RadioKind::Bluetooth {
            return Ok(Some(radio));
        }
    }
    Ok(None)
}

pub fn enabled() -> bool {
    bluetooth_radio()
        .ok()
        .flatten()
        .and_then(|r| r.State().ok())
        .map(|s| s == RadioState::On)
        .unwrap_or(false)
}

pub fn set_enabled(on: bool) {
    if let Ok(Some(radio)) = bluetooth_radio() {
        let target = if on { RadioState::On } else { RadioState::Off };
        if let Ok(op) = radio.SetStateAsync(target) {
            let _ = op.get();
        }
    }
}

#[derive(serde::Serialize, Clone)]
pub struct PairedDevice {
    pub name: String,
    pub connected: bool,
}

pub fn paired_devices() -> Vec<PairedDevice> {
    let Ok(selector) = BluetoothDevice::GetDeviceSelectorFromPairingState(true) else {
        return Vec::new();
    };
    let Ok(op) = DeviceInformation::FindAllAsyncAqsFilter(&selector) else {
        return Vec::new();
    };
    let Ok(infos) = op.get() else {
        return Vec::new();
    };
    let mut out = Vec::new();
    let Ok(size) = infos.Size() else {
        return out;
    };
    for i in 0..size {
        let Ok(info) = infos.GetAt(i) else { continue };
        let name = info.Name().map(|h| h.to_string()).unwrap_or_default();
        // Best-effort connection state via BluetoothDevice; a lookup failure
        // (device asleep/out of range) just reports "not connected", not an error.
        let connected = info
            .Id()
            .ok()
            .and_then(|id| BluetoothDevice::FromIdAsync(&id).ok())
            .and_then(|op| op.get().ok())
            .and_then(|dev| dev.ConnectionStatus().ok())
            .map(|s| s == windows::Devices::Bluetooth::BluetoothConnectionStatus::Connected)
            .unwrap_or(false);
        out.push(PairedDevice { name, connected });
    }
    out
}
