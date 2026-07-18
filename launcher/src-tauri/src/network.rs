// Settings > Network. Wi-Fi access is handled through Windows' own WLAN
// profiles; nothing is stored in the launcher config. Windows 11 may require
// Location access before it will reveal nearby SSIDs, so that state is surfaced
// to the controller UI instead of being mistaken for an empty scan.

#![cfg(windows)]

use std::process::{Command, Output};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(serde::Serialize, Clone)]
pub struct WifiNetwork {
    pub ssid: String,
    pub signal_percent: u8,
    pub known: bool,
    pub security: String,
}

#[derive(serde::Serialize, Clone, Default)]
pub struct WifiScan {
    pub networks: Vec<WifiNetwork>,
    pub requires_location: bool,
    pub error: Option<String>,
}

#[derive(serde::Serialize, Clone, Default)]
pub struct WifiStatus {
    pub connected: bool,
    pub ssid: Option<String>,
    pub signal_percent: Option<u8>,
}

fn output_text(output: Output) -> String {
    let mut text = String::from_utf8_lossy(&output.stdout).to_string();
    text.push_str(&String::from_utf8_lossy(&output.stderr));
    text
}

fn run_netsh(args: &[&str]) -> String {
    Command::new("netsh").args(args).output().map(output_text).unwrap_or_default()
}

fn run_netsh_checked(args: &[&str]) -> Result<String, String> {
    let output = Command::new("netsh").args(args).output().map_err(|error| error.to_string())?;
    let text = output_text(output);
    if text.to_ascii_lowercase().contains("location services") {
        return Err("Windows requires Location access before Wi-Fi can scan. Enable it in the Location settings page, then try again.".to_string());
    }
    if text.trim().is_empty() { return Err("Windows did not return a Wi-Fi response.".to_string()); }
    Ok(text)
}

pub fn status() -> WifiStatus {
    let out = run_netsh(&["wlan", "show", "interfaces"]);
    let mut status = WifiStatus::default();
    for line in out.lines() {
        let line = line.trim();
        if let Some(value) = line.strip_prefix("State") {
            status.connected = value.contains("connected") && !value.contains("disconnected");
        } else if let Some(value) = line.strip_prefix("SSID") {
            if let Some(index) = value.find(':') { status.ssid = Some(value[index + 1..].trim().to_string()); }
        } else if let Some(value) = line.strip_prefix("Signal") {
            if let Some(index) = value.find(':') { status.signal_percent = value[index + 1..].trim().trim_end_matches('%').parse().ok(); }
        }
    }
    status
}

fn known_profiles() -> Vec<String> {
    run_netsh(&["wlan", "show", "profiles"])
        .lines()
        .filter_map(|line| line.trim().strip_prefix("All User Profile"))
        .map(|value| value.trim_start_matches(':').trim().to_string())
        .filter(|value| !value.is_empty())
        .collect()
}

fn security_label(value: &str) -> String {
    let value = value.to_ascii_lowercase();
    if value.contains("open") { "Open".to_string() }
    else if value.contains("wpa3") { "WPA3-Personal".to_string() }
    else if value.contains("wpa2") { "WPA2-Personal".to_string() }
    else if value.contains("wpa") { "WPA-Personal".to_string() }
    else { "Secured".to_string() }
}

/// One controller-selectable entry per SSID, retaining the strongest BSSID signal.
pub fn scan() -> WifiScan {
    let out = run_netsh(&["wlan", "show", "networks", "mode=bssid"]);
    let lower = out.to_ascii_lowercase();
    if lower.contains("location services") || lower.contains("location permission") {
        return WifiScan { networks: Vec::new(), requires_location: true, error: Some("Windows has blocked Wi-Fi scanning until Location access is enabled.".to_string()) };
    }
    if lower.contains("requires elevation") || lower.contains("access is denied") {
        return WifiScan { networks: Vec::new(), requires_location: false, error: Some("Windows denied this Wi-Fi scan. Open Location settings, enable access, then refresh.".to_string()) };
    }
    let known = known_profiles();
    let mut networks: Vec<WifiNetwork> = Vec::new();
    let mut current_ssid: Option<String> = None;
    let mut current_security = "Secured".to_string();
    for line in out.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("SSID ") {
            if let Some(index) = rest.find(':') {
                let ssid = rest[index + 1..].trim();
                current_ssid = (!ssid.is_empty()).then(|| ssid.to_string());
                current_security = "Secured".to_string();
            }
        } else if let Some(value) = line.strip_prefix("Authentication") {
            if let Some(index) = value.find(':') { current_security = security_label(value[index + 1..].trim()); }
        } else if let Some(value) = line.strip_prefix("Signal") {
            if let (Some(ssid), Some(index)) = (&current_ssid, value.find(':')) {
                let signal_percent = value[index + 1..].trim().trim_end_matches('%').parse().unwrap_or(0);
                if let Some(existing) = networks.iter_mut().find(|network| network.ssid == *ssid) {
                    existing.signal_percent = existing.signal_percent.max(signal_percent);
                    if existing.security == "Secured" { existing.security = current_security.clone(); }
                } else {
                    networks.push(WifiNetwork { ssid: ssid.clone(), signal_percent, known: known.iter().any(|profile| profile == ssid), security: current_security.clone() });
                }
            }
        }
    }
    networks.sort_by(|a, b| b.signal_percent.cmp(&a.signal_percent).then_with(|| a.ssid.cmp(&b.ssid)));
    WifiScan { networks, requires_location: false, error: None }
}

fn xml_escape(value: &str) -> String {
    value.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&apos;")
}

fn profile_xml(ssid: &str, password: Option<&str>, security: &str) -> Result<String, String> {
    let ssid = xml_escape(ssid);
    if security.eq_ignore_ascii_case("Open") {
        return Ok(format!(r#"<?xml version="1.0"?><WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1"><name>{ssid}</name><SSIDConfig><SSID><name>{ssid}</name></SSID></SSIDConfig><connectionType>ESS</connectionType><connectionMode>auto</connectionMode><MSM><security><authEncryption><authentication>open</authentication><encryption>none</encryption><useOneX>false</useOneX></authEncryption></security></MSM></WLANProfile>"#));
    }
    let password = password.map(str::trim).filter(|value| !value.is_empty()).ok_or_else(|| "Enter this network's password first.".to_string())?;
    let authentication = if security.eq_ignore_ascii_case("WPA3-Personal") { "WPA3SAE" } else if security.eq_ignore_ascii_case("WPA-Personal") { "WPAPSK" } else { "WPA2PSK" };
    Ok(format!(r#"<?xml version="1.0"?><WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1"><name>{ssid}</name><SSIDConfig><SSID><name>{ssid}</name></SSID></SSIDConfig><connectionType>ESS</connectionType><connectionMode>auto</connectionMode><MSM><security><authEncryption><authentication>{authentication}</authentication><encryption>AES</encryption><useOneX>false</useOneX></authEncryption><sharedKey><keyType>passPhrase</keyType><protected>false</protected><keyMaterial>{}</keyMaterial></sharedKey></security></MSM></WLANProfile>"#, xml_escape(password)))
}

fn connect_profile(name: &str, ssid: &str) -> Result<(), String> {
    let output = Command::new("netsh").args(["wlan", "connect", &format!("name={name}"), &format!("ssid={ssid}")]).output().map_err(|error| error.to_string())?;
    let text = output_text(output);
    if text.to_ascii_lowercase().contains("success") || text.to_ascii_lowercase().contains("completed") { Ok(()) }
    else { Err(if text.trim().is_empty() { "Windows could not start the Wi-Fi connection.".to_string() } else { text }) }
}

/// Uses a saved Windows profile when available; otherwise creates a per-user profile
/// from the entered password. The temporary XML is removed before this returns.
pub fn connect(ssid: &str, password: Option<String>, security: Option<String>) -> Result<(), String> {
    let ssid = ssid.trim();
    if ssid.is_empty() { return Err("Choose a Wi-Fi network first.".to_string()); }
    if known_profiles().iter().any(|profile| profile == ssid) { return connect_profile(ssid, ssid); }
    let xml = profile_xml(ssid, password.as_deref(), &security.unwrap_or_else(|| "WPA2-Personal".to_string()))?;
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).map(|duration| duration.as_nanos()).unwrap_or(0);
    let file = std::env::temp_dir().join(format!("ps5-mode-wifi-{nonce}.xml"));
    std::fs::write(&file, xml).map_err(|error| error.to_string())?;
    let add_result = run_netsh_checked(&["wlan", "add", "profile", &format!("filename={}", file.display()), "user=current"]);
    let _ = std::fs::remove_file(&file);
    add_result?;
    connect_profile(ssid, ssid)
}

pub fn disconnect() { let _ = run_netsh(&["wlan", "disconnect"]); }