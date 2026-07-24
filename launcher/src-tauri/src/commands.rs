// Tauri IPC surface. Frontend calls these via `invoke(...)`.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{LazyLock, Mutex};

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::app_launch;
use crate::display::{self, DisplayMode};

/// True while the launcher window is minimized/yielded (either because an
/// external app was launched, or the user triple-clicked to minimize it
/// manually). Lets the triple-click handler in hid.rs act as a toggle instead
/// of "restore only."
pub static YIELDED: AtomicBool = AtomicBool::new(false);
/// The compact quick menu lives in a second transparent window. It never owns
/// keyboard/mouse focus; controller input continues through the HID stream.
pub static OVERLAY_ACTIVE: AtomicBool = AtomicBool::new(false);
/// Serializes hide/show work from controller gestures. Window transitions are
/// synchronous on Windows, but fast repeated buttons used to stack several
/// fullscreen/minimize operations behind each other.
static WINDOW_TRANSITION: AtomicBool = AtomicBool::new(false);
static OVERLAY_CONTEXT: LazyLock<Mutex<String>> = LazyLock::new(|| Mutex::new("desktop".into()));

fn set_overlay_context(target: &str) {
    let context = if target.starts_with("exe:") || target == "steam" {
        format!("game:{target}")
    } else {
        format!("app:{target}")
    };
    if let Ok(mut current) = OVERLAY_CONTEXT.lock() {
        *current = context;
    }
}

#[tauri::command]
pub fn get_overlay_context() -> String {
    OVERLAY_CONTEXT.lock().map(|context| context.clone()).unwrap_or_else(|_| "desktop".into())
}

fn overlay_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    if let Some(window) = app.get_webview_window("overlay") {
        return Ok(window);
    }
    let window = WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("index.html?overlay=1".into()))
        .fullscreen(true)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .focusable(false)
        .visible(false)
        .build()
        .map_err(|error| error.to_string())?;
    // Keep game mouse and keyboard input underneath the HUD. Windows layered
    // click-through is the non-injected overlay model documented by Microsoft.
    let _ = window.set_ignore_cursor_events(true);
    Ok(window)
}

/// Build the hidden WebView2 surface while the console is idle. The first PS
/// press over a game then only shows a ready window instead of paying WebView
/// startup cost in the middle of play.
pub fn prewarm_quick_overlay(app: &AppHandle) {
    if let Err(error) = overlay_window(app) {
        eprintln!("[overlay prewarm] {error}");
    }
}

pub fn hide_quick_overlay(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("overlay") {
        let _ = window.hide();
    }
    OVERLAY_ACTIVE.store(false, Ordering::Relaxed);
    // Always fall back to the Quick Menu, so the next double-PS shows the menu
    // rather than whatever surface happened to be up last.
    let _ = app.emit_to("overlay", "overlay-mode", "quick");
}

/// Show the overlay window as the Desktop Mode keyboard dock (double-Share
/// while an ordinary app has focus). Same prewarmed window as the Quick Menu,
/// different mode — see OverlayRoot.tsx for why only one surface mounts.
///
/// The window is intentionally never focused: it's built `focusable(false)` and
/// click-through, so the app underneath keeps keyboard focus and send_text's
/// synthesized keystrokes land there instead of in our own webview.
pub fn show_keyboard_dock(app: &AppHandle) {
    if WINDOW_TRANSITION.swap(true, Ordering::AcqRel) {
        return;
    }
    match overlay_window(app) {
        Ok(window) => {
            // Mode first, then show — so the dock is what appears, rather than
            // the Quick Menu flashing for a frame before switching.
            let _ = app.emit_to("overlay", "overlay-mode", "keyboard");
            let _ = window.show();
            OVERLAY_ACTIVE.store(true, Ordering::Relaxed);
        }
        Err(error) => eprintln!("[keyboard dock] {error}"),
    }
    WINDOW_TRANSITION.store(false, Ordering::Release);
}

pub fn toggle_quick_overlay(app: &AppHandle) {
    if WINDOW_TRANSITION.swap(true, Ordering::AcqRel) {
        return;
    }
    if OVERLAY_ACTIVE.load(Ordering::Relaxed) {
        hide_quick_overlay(app);
        crate::rumble::confirm();
        WINDOW_TRANSITION.store(false, Ordering::Release);
        return;
    }
    match overlay_window(app) {
        Ok(window) => {
            // Explicit mode, in case the dock was the last surface shown.
            let _ = app.emit_to("overlay", "overlay-mode", "quick");
            let _ = window.show();
            OVERLAY_ACTIVE.store(true, Ordering::Relaxed);
            crate::rumble::select();
        }
        Err(error) => eprintln!("[overlay] {error}"),
    }
    WINDOW_TRANSITION.store(false, Ordering::Release);
}

#[tauri::command]
pub fn hide_quick_overlay_command(app: AppHandle) {
    hide_quick_overlay(&app);
}

#[tauri::command]
pub fn open_console_home(app: AppHandle) {
    hide_quick_overlay(&app);
    restore_focus(&app);
}

#[tauri::command]
pub fn open_rgb_controls() -> Result<(), String> { crate::openrgb::open_gui() }

#[tauri::command]
pub fn set_rgb_scene(scene: String) -> Result<(), String> { crate::openrgb::set_scene(&scene) }

#[tauri::command]
pub fn rgb_devices() -> crate::openrgb::RgbState { crate::openrgb::devices() }

#[tauri::command]
pub fn set_rgb_device_color(index: u32, red: u8, green: u8, blue: u8) -> Result<(), String> {
    crate::openrgb::set_device_color(index, red, green, blue)
}

#[tauri::command]
pub fn set_rgb_device_mode(index: u32, mode: u32) -> Result<(), String> {
    crate::openrgb::set_device_mode(index, mode)
}

/// Native preflight for Home's live-app backdrop. A missing/ambiguous/protected
/// source deliberately returns None so the frontend can keep Hero art without
/// a visible error or a late flicker.
#[tauri::command]
pub fn prepare_live_backdrop(tile_id: String) -> Option<crate::live_backdrop::LiveBackdropFrame> {
    crate::live_backdrop::prepare(tile_id)
}

/// Frontend can pull a one-shot snapshot; the steady stream is the "pad-state" event.
#[tauri::command]
pub fn get_controller_state() -> crate::hid::PadState {
    // TODO(Unit A): return the last emitted snapshot from shared state. For now the
    // event stream (hid.rs -> "pad-state") is the source of truth; this is a stub.
    crate::hid::PadState::default()
}

/// Unit C Ã¢â‚¬â€ launch an external app / streaming service by tile id, then yield
/// focus (drop always-on-top + fullscreen, minimize) so the launched app is
/// actually reachable Ã¢â‚¬â€ alwaysOnTop+fullscreen otherwise permanently blocks
/// alt-tab, which makes external launches unusable (confirmed on real testing).
///
/// `needs_cursor`: some external apps aren't controller-navigable (Epic,
/// Battle.net, browser-based streaming sites) Ã¢â‚¬â€ for those the frontend passes
/// true so the touchpad drives the real OS cursor while that app has focus.
/// Controller-native launches (Steam Big Picture, Discord's overlay-friendly UI)
/// pass false so swipes stay grid-nav even after PS+Options round-trips.
#[tauri::command]
pub fn launch_app(app: AppHandle, target: String, needs_cursor: bool) -> Result<(), String> {
    app_launch::launch(&target).map_err(|e| e.to_string())?;
    set_overlay_context(&target);
    #[cfg(windows)]
    crate::mouse_inject::CURSOR_MODE.store(needs_cursor, Ordering::Relaxed);
    yield_focus(&app);
    Ok(())
}

/// Drop the "stay on top of everything" posture so a launched app (browser,
/// Discord, Steam) can actually be brought to the foreground / alt-tabbed to.
pub fn yield_focus(app: &AppHandle) {
    if YIELDED.swap(true, Ordering::AcqRel) {
        return;
    }
    hide_quick_overlay(app);
    if let Some(win) = app.get_webview_window("main") {
        // Keep the fullscreen/compositor state intact. Toggling fullscreen and
        // topmost for every launch forces expensive WebView2 relayouts and was
        // the main cause of repeated close/launch stutters.
        let _ = win.hide();
    }
}

/// Bring the launcher back to the foreground after a triple-click while a
/// session is already active (see hid.rs's local triple-click tracker).
pub fn restore_focus(app: &AppHandle) {
    let was_yielded = YIELDED.swap(false, Ordering::AcqRel);
    hide_quick_overlay(app);
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
    if was_yielded {
        let _ = app.emit("window-restored", ());
    }
    #[cfg(windows)]
    crate::mouse_inject::CURSOR_MODE.store(false, Ordering::Relaxed);
}

/// Triple-click while the launcher has foreground focus: manually minimize it
/// (same posture as yield_focus, just not triggered by an external launch).
/// Lets triple-click act as a full open/minimize/restore toggle end to end.
/// Not yet wired to a trigger — kept as the intended toggle entry point.
#[allow(dead_code)]
pub fn toggle_minimize(app: &AppHandle) {
    if YIELDED.load(Ordering::Relaxed) {
        restore_focus(app);
    } else {
        yield_focus(app);
    }
}

/// Light nav-tick pulse. Frontend calls this ONLY when an action actually
/// landed (nav moved, swipe accepted) Ã¢â‚¬â€ the absence of a pulse is how the user
/// tells a no-op from a received input, so this must never be called
/// speculatively/on every input attempt.
#[tauri::command]
pub fn haptic_confirm() {
    crate::rumble::confirm();
}

/// Stronger pulse for a committed action (tile opened, tab switched) Ã¢â‚¬â€ should
/// feel heavier than a nav tick, not just the same buzz again.
#[tauri::command]
pub fn haptic_select() {
    crate::rumble::select();
}

/// Unit B Ã¢â‚¬â€ toggle touchpad-as-mouse cursor injection. Embedded panels (YouTube)
/// enable this on mount and disable it on unmount so grid/tab panels keep
/// treating swipes as discrete nav events instead of cursor drags.
#[tauri::command]
pub fn set_cursor_mode(enabled: bool) {
    #[cfg(windows)]
    crate::mouse_inject::CURSOR_MODE.store(enabled, std::sync::atomic::Ordering::Relaxed);
    #[cfg(not(windows))]
    let _ = enabled;
}

/// Idle screen (frontend timer) calls this once inactivity crosses the
/// threshold Ã¢â‚¬â€ swaps to the Power Saver plan. Windows-only; no-op elsewhere.
#[tauri::command]
pub fn enter_idle_power_save() {
    #[cfg(windows)]
    crate::power::enter_idle();
}

/// Any input while idle calls this to restore whatever plan was active before
/// enter_idle_power_save().
#[tauri::command]
pub fn exit_idle_power_save() {
    #[cfg(windows)]
    crate::power::exit_idle();
}

/// Reveal the native window only after React has painted the dark entry frame.
/// This prevents WebView2's default white first frame from ever being shown.
#[tauri::command]
pub fn show_console_window(app: AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}
/// Hide the console without terminating it. This is intentionally exposed only
/// through the confirmed Power menu, not the PS triple-click gesture.
#[tauri::command]
pub fn minimize_console(app: AppHandle) {
    if let Ok(mut context) = OVERLAY_CONTEXT.lock() {
        *context = "desktop".into();
    }
    yield_focus(&app);
}
/// Explicit operating-system power actions. The frontend always requires a
/// second controller confirmation before calling these; this command layer is
/// intentionally small so there is no shell interpolation from UI strings.
#[tauri::command]
pub fn lock_workstation() -> Result<(), String> {
    #[cfg(windows)]
    {
        std::process::Command::new("rundll32.exe")
            .args(["user32.dll,LockWorkStation"])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn sleep_machine() -> Result<(), String> {
    #[cfg(windows)]
    {
        std::process::Command::new("rundll32.exe")
            .args(["powrprof.dll,SetSuspendState", "0,1,0"])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn shutdown_machine() -> Result<(), String> {
    #[cfg(windows)]
    {
        std::process::Command::new("shutdown.exe")
            .args(["/s", "/t", "0"])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
/// Given a list of tile ids, return which ones currently have a matching
/// process running Ã¢â‚¬â€ lets the frontend show a small "active" indicator, PS5
/// switcher-style. Frontend polls this on an interval; deliberately NOT an
/// event stream since process enumeration is relatively expensive to run at
/// controller-input rates.
#[tauri::command]
pub fn running_tile_ids(tile_ids: Vec<String>) -> Vec<String> {
    crate::active_apps::running_tile_ids(&tile_ids)
}

/// PS5-style "Close Application" Ã¢â‚¬â€ terminates the tile's running process(es).
#[tauri::command]
pub fn close_tile_app(tile_id: String) -> bool {
    crate::active_apps::kill_tile(&tile_id)
}

/// Launch a game tile's configured trainer (its `AppTile.trainer` path), if
/// any. Separate from `launch_app` since it's a second, optional target on
/// the same tile rather than the tile's primary launch id.
#[tauri::command]
pub fn launch_trainer(tile_id: String) -> Result<(), String> {
    let config = crate::config::AppConfig::load();
    let tile = config
        .apps
        .iter()
        .find(|tile| tile.id == tile_id)
        .ok_or_else(|| format!("unknown tile: {tile_id}"))?;
    let trainer = tile
        .trainer
        .as_deref()
        .ok_or_else(|| format!("{tile_id} has no trainer configured"))?;
    app_launch::launch(trainer).map_err(|e| e.to_string())
}

/// Unit D Ã¢â‚¬â€ list the monitor's actually-supported resolution/refresh modes.
#[tauri::command]
pub fn list_display_modes() -> Vec<DisplayMode> {
    display::list_supported_modes()
}

/// Unit D Ã¢â‚¬â€ apply a display mode. Original is restored on exit/crash.
#[tauri::command]
pub fn set_display_mode(mode: DisplayMode) -> Result<(), String> {
    display::apply_mode(&mode).map_err(|e| e.to_string())
}

/// Load the persisted tile list (+ any other saved config). Frontend calls this
/// once on mount instead of using a hardcoded tile array.
#[tauri::command]
pub fn get_config() -> crate::config::AppConfig {
    crate::config::AppConfig::load()
}

/// Persist the tile list (add/remove/reorder). Frontend calls this after any
/// edit to the tile array; whole-config overwrite, same pattern as settings.rs.
#[tauri::command]
pub fn save_config(config: crate::config::AppConfig) -> Result<(), String> {
    config.save().map_err(|e| e.to_string())
}

/// Walk the given folders/drives (e.g. `["E:\\"]`) for installed game
/// executables and cache the result. This does real filesystem work Ã¢â‚¬â€ call
/// it from an explicit "Rescan library" action, not on every launch. See
/// game_scan.rs for the picking heuristics.
#[tauri::command]
pub fn scan_game_library(roots: Vec<String>) -> crate::game_scan::GameIndex {
    crate::game_scan::scan_and_cache(&roots)
}

/// Scan the supplied library roots and merge newly discovered games into the
/// persisted Games tab. Existing tiles are retained exactly as configured.
#[tauri::command]
pub fn sync_game_library(roots: Vec<String>) -> Result<crate::config::AppConfig, String> {
    let index = crate::game_scan::scan_and_cache(&roots);
    let mut config = crate::config::AppConfig::load();
    // Older scans could mistake Riot Client''s Electron host for a game. Keep the
    // real launcher, but migrate that stale Games-tab entry into Launchers.
    const RIOT_CLIENT_PATH: &str = r"E:\Riot Games\Riot Client\RiotClientElectron\Riot Client.exe";
    let riot_client_id = format!("exe:{RIOT_CLIENT_PATH}");
    config.apps.retain(|tile| !(tile.label == "Riot Client" && tile.category == "games"));
    if std::path::Path::new(RIOT_CLIENT_PATH).is_file()
        && !config.apps.iter().any(|tile| tile.id == riot_client_id)
    {
        config.apps.push(crate::config::AppTile {
            id: riot_client_id,
            label: "Riot Client".to_string(),
            icon: None,
            category: "launchers".to_string(),
            needs_cursor: true,
            trainer: None,
        });
    }
    for game in index.games {
        if config.apps.iter().any(|tile| tile.id == game.id) {
            continue;
        }
        config.apps.push(crate::config::AppTile {
            id: game.id,
            label: game.label,
            icon: None,
            category: "games".to_string(),
            needs_cursor: false,
            trainer: None,
        });
    }
    config.save().map_err(|error| error.to_string())?;
    Ok(config)
}
/// Read the last scan's cached result without touching the filesystem Ã¢â‚¬â€
/// what a "games found on disk" list in Settings would call on open.
#[tauri::command]
pub fn get_game_index() -> crate::game_scan::GameIndex {
    crate::game_scan::cached_index()
}

/// Settings > Controller Ã¢â‚¬â€ trackpad-as-mouse sensitivity. Dedicated
/// get/set instead of routing through get_config/save_config so adjusting
/// this can't accidentally clobber the tile list with a partial object.
#[tauri::command]
pub fn get_cursor_sensitivity() -> f32 {
    crate::config::AppConfig::load().cursor_sensitivity
}
#[tauri::command]
pub fn set_cursor_sensitivity(value: f32) {
    let mut cfg = crate::config::AppConfig::load();
    cfg.cursor_sensitivity = value.clamp(0.2, 5.0);
    let _ = cfg.save();
}

/// Settings > Audio.
#[tauri::command]
pub fn get_master_volume() -> f32 {
    #[cfg(windows)]
    return crate::audio::get_volume();
    #[cfg(not(windows))]
    0.0
}
#[tauri::command]
pub fn set_master_volume(level: f32) {
    #[cfg(windows)]
    crate::audio::set_volume(level);
    #[cfg(not(windows))]
    let _ = level;
}
#[tauri::command]
pub fn get_master_mute() -> bool {
    #[cfg(windows)]
    return crate::audio::get_mute();
    #[cfg(not(windows))]
    false
}
#[tauri::command]
pub fn set_master_mute(muted: bool) {
    #[cfg(windows)]
    crate::audio::set_mute(muted);
    #[cfg(not(windows))]
    let _ = muted;
}

#[tauri::command]
pub fn open_audio_device_picker() {
    #[cfg(windows)]
    crate::audio::open_device_picker();
}
#[tauri::command]
pub fn get_mixer_sessions() -> Vec<crate::audio::MixerSession> {
    #[cfg(windows)]
    return crate::audio::mixer_sessions();
    #[cfg(not(windows))]
    Vec::new()
}
#[tauri::command]
pub fn set_session_volume(process_id: u32, level: f32) {
    #[cfg(windows)]
    crate::audio::set_session_volume(process_id, level);
    #[cfg(not(windows))]
    let _ = (process_id, level);
}
#[tauri::command]
pub fn set_session_mute(process_id: u32, muted: bool) {
    #[cfg(windows)]
    crate::audio::set_session_mute(process_id, muted);
    #[cfg(not(windows))]
    let _ = (process_id, muted);
}

/// Settings > Network (WiFi).
#[tauri::command]
pub fn wifi_status() -> crate::network::WifiStatus {
    #[cfg(windows)]
    return crate::network::status();
    #[cfg(not(windows))]
    Default::default()
}
#[tauri::command]
pub fn wifi_scan() -> crate::network::WifiScan {
    #[cfg(windows)]
    return crate::network::scan();
#[cfg(not(windows))]
    Default::default()
}
#[tauri::command]
pub fn wifi_connect(ssid: String, password: Option<String>, security: Option<String>) -> Result<(), String> {
    #[cfg(windows)]
    return crate::network::connect(&ssid, password, security);
    #[cfg(not(windows))]
    Err("unsupported".into())
}
#[tauri::command]
pub fn wifi_disconnect() {
    #[cfg(windows)]
    crate::network::disconnect();
}


/// Opens Windows' official Location page. Windows 11 can gate nearby Wi-Fi
/// scan results behind this privacy permission, so this is controller-reachable.
#[tauri::command]
pub fn open_location_settings() -> Result<(), String> {
    #[cfg(windows)]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", "ms-settings:privacy-location"])
            .spawn()
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}
/// Settings > Bluetooth.
#[tauri::command]
pub fn bluetooth_enabled() -> bool {
    #[cfg(windows)]
    return crate::bluetooth::enabled();
    #[cfg(not(windows))]
    false
}
#[tauri::command]
pub fn set_bluetooth_enabled(on: bool) {
    #[cfg(windows)]
    crate::bluetooth::set_enabled(on);
    #[cfg(not(windows))]
    let _ = on;
}
#[tauri::command]
pub fn bluetooth_paired_devices() -> Vec<crate::bluetooth::PairedDevice> {
    #[cfg(windows)]
    return crate::bluetooth::paired_devices();
    #[cfg(not(windows))]
    Vec::new()
}

/// Settings > System Ã¢â‚¬â€ Game Mode.
#[tauri::command]
pub fn game_mode_enabled() -> bool {
    #[cfg(windows)]
    return crate::gamemode::enabled();
    #[cfg(not(windows))]
    false
}
#[tauri::command]
pub fn set_game_mode_enabled(on: bool) {
    #[cfg(windows)]
    crate::gamemode::set_enabled(on);
    #[cfg(not(windows))]
    let _ = on;
}

/// Real icon for a game/launcher tile, extracted from its actual installed
/// .exe Ã¢â‚¬â€ returns None (frontend falls back to the stylized generic icon) if
/// the tile has no resolvable local path or extraction fails for any reason.
#[tauri::command]
pub fn extract_tile_icon(tile_id: String) -> Option<String> {
    #[cfg(windows)]
    return crate::icon_extract::extract(&tile_id);
    #[cfg(not(windows))]
    None
}

/// Clean exit: restore display, then quit so the listener re-arms.
#[tauri::command]
pub fn exit_mode(app: AppHandle) {
    request_exit(&app);
}

/// Shared exit path (also called from the PS+Options combo in hid.rs).
pub fn request_exit(app: &AppHandle) {
    #[cfg(windows)]
    display::restore_original();
    // Harmless no-op if idle power-save was never entered (exit_idle only acts
    // when it has a recorded "previous scheme" to restore).
    #[cfg(windows)]
    crate::power::exit_idle();

    // Hide immediately for snappy feel, then exit the process.
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
    app.exit(0);
}
