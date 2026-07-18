// Real .exe icon extraction for game/launcher tiles — pulls the actual Win32
// icon baked into the installed executable (the same icon Explorer/the
// taskbar shows) instead of a hand-drawn approximation. Guaranteed accurate
// since it's the exact file already on this machine, and stays local/personal
// (never redistributed) — the user explicitly OK'd this over generic
// fallback icons for the exe: game tiles.

#![cfg(windows)]

use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::OnceLock;

use windows::core::PCWSTR;
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, SelectObject, BITMAP,
    BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HGDIOBJ,
};
use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, PrivateExtractIconsW, ICONINFO};

fn cache() -> &'static Mutex<HashMap<String, Option<String>>> {
    static CACHE: OnceLock<Mutex<HashMap<String, Option<String>>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Best-known install path for tiles that don't carry an "exe:" path
/// themselves (they launch via URI scheme — see app_launch.rs). Returns the
/// first path that actually exists; None if the app isn't installed there,
/// which just means "no override icon" — the existing hand-drawn brand icon
/// stays as the fallback for those.
fn known_launcher_path(tile_id: &str) -> Option<String> {
    let candidates: &[&str] = match tile_id {
        "epic" => &[
            r"C:\Program Files (x86)\Epic Games\Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe",
            r"C:\Program Files (x86)\Epic Games\Launcher\Portal\Binaries\Win32\EpicGamesLauncher.exe",
        ],
        "battlenet" => &[r"C:\Program Files (x86)\Battle.net\Battle.net.exe"],
        "steam" => &[r"C:\Program Files (x86)\Steam\steam.exe"],
        _ => &[],
    };
    candidates.iter().map(|s| s.to_string()).find(|p| std::path::Path::new(p).exists())
}

fn resolve_path(tile_id: &str) -> Option<String> {
    if let Some(p) = tile_id.strip_prefix("exe:") {
        return Some(p.to_string());
    }
    known_launcher_path(tile_id)
}

/// Extract + PNG-encode + base64 data-URI the icon for a tile, memoized for
/// the process lifetime (extraction does real GDI work, no need to repeat it
/// on every grid re-render/focus change).
pub fn extract(tile_id: &str) -> Option<String> {
    if let Some(hit) = cache().lock().unwrap().get(tile_id) {
        return hit.clone();
    }
    let result = resolve_path(tile_id).and_then(|path| extract_icon_data_uri(&path));
    cache().lock().unwrap().insert(tile_id.to_string(), result.clone());
    result
}

fn extract_icon_data_uri(path: &str) -> Option<String> {
    let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
    let mut shfi = SHFILEINFOW::default();
    unsafe {
        let ok = SHGetFileInfoW(
            PCWSTR(wide.as_ptr()),
            windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES(0),
            Some(&mut shfi),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        );
if ok == 0 || shfi.hIcon.is_invalid() {
            return None;
        }

        // SHGFI_LARGEICON is usually only a 32px shell image. Ask the executable
        // itself for a 512px resource first; Windows selects its largest native
        // icon and scales only when the file truly has no larger rendition.
        let mut icon = shfi.hIcon;
        if wide.len() <= 260 {
            let mut filename = [0u16; 260];
            filename[..wide.len()].copy_from_slice(&wide);
            let mut extracted = [Default::default()];
            if PrivateExtractIconsW(&filename, 0, 512, 512, Some(&mut extracted), None, 0) > 0
                && !extracted[0].is_invalid()
            {
                let _ = DestroyIcon(icon);
                icon = extracted[0];
            }
        }

        let mut icon_info = ICONINFO::default();
        if GetIconInfo(icon, &mut icon_info).is_err() {
            let _ = DestroyIcon(icon);
            return None;
        }

        let mut bmp = BITMAP::default();
        GetObjectW(
            HGDIOBJ(icon_info.hbmColor.0),
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut bmp as *mut _ as *mut _),
        );
        let (w, h) = (bmp.bmWidth, bmp.bmHeight);
        if w <= 0 || h <= 0 {
            let _ = DestroyIcon(shfi.hIcon);
            let _ = DeleteObject(icon_info.hbmColor);
            let _ = DeleteObject(icon_info.hbmMask);
            return None;
        }

        let mut buffer = vec![0u8; (w * h * 4) as usize];
        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: w,
                biHeight: -h, // negative = top-down DIB, matches our row order below
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };

        let hdc = CreateCompatibleDC(None);
        let prev = SelectObject(hdc, HGDIOBJ(icon_info.hbmColor.0));
        let scanlines = GetDIBits(
            hdc,
            icon_info.hbmColor,
            0,
            h as u32,
            Some(buffer.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );
        SelectObject(hdc, prev);
        let _ = DeleteDC(hdc);
        let _ = DestroyIcon(icon);
        let _ = DeleteObject(icon_info.hbmColor);
        let _ = DeleteObject(icon_info.hbmMask);

        if scanlines == 0 {
            return None;
        }

        // BGRA (GDI) -> RGBA (PNG/web).
        for px in buffer.chunks_exact_mut(4) {
            px.swap(0, 2);
        }

        let img = image::RgbaImage::from_raw(w as u32, h as u32, buffer)?;
        let mut png_bytes = Vec::new();
        img.write_to(&mut std::io::Cursor::new(&mut png_bytes), image::ImageFormat::Png).ok()?;
        Some(format!(
            "data:image/png;base64,{}",
            base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &png_bytes)
        ))
    }
}
