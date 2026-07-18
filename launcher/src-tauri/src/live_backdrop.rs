//! Best-effort native app snapshot bridge for the Home backdrop.
//!
//! This intentionally does not capture the desktop, inject into another
//! process, or guess among several app windows. It finds one eligible
//! top-level window for the requested tile, renders it offscreen with
//! PrintWindow, and returns a prepared PNG only when that frame looks valid.

use std::collections::HashSet;
use std::ffi::c_void;
use std::io::Cursor;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{DynamicImage, ImageBuffer, ImageFormat, Rgba};
use serde::Serialize;
use sysinfo::{ProcessesToUpdate, System};

#[derive(Serialize)]
pub struct LiveBackdropFrame {
    pub tile_id: String,
    pub title: String,
    pub data_url: String,
    pub width: i32,
    pub height: i32,
}

type Hwnd = isize;
type Hdc = isize;
type Hbitmap = isize;
type Hgdiobj = isize;

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct Rect { left: i32, top: i32, right: i32, bottom: i32 }

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct BitmapInfoHeader {
    bi_size: u32,
    bi_width: i32,
    bi_height: i32,
    bi_planes: u16,
    bi_bit_count: u16,
    bi_compression: u32,
    bi_size_image: u32,
    bi_x_pels_per_meter: i32,
    bi_y_pels_per_meter: i32,
    bi_clr_used: u32,
    bi_clr_important: u32,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct BitmapInfo { header: BitmapInfoHeader, colors: [u32; 1] }

#[link(name = "user32")]
extern "system" {
    fn EnumWindows(callback: extern "system" fn(Hwnd, isize) -> i32, param: isize) -> i32;
    fn IsWindowVisible(hwnd: Hwnd) -> i32;
    fn IsIconic(hwnd: Hwnd) -> i32;
    fn GetWindowRect(hwnd: Hwnd, rect: *mut Rect) -> i32;
    fn GetWindowThreadProcessId(hwnd: Hwnd, pid: *mut u32) -> u32;
    fn GetWindowTextLengthW(hwnd: Hwnd) -> i32;
    fn GetWindowTextW(hwnd: Hwnd, text: *mut u16, max: i32) -> i32;
    fn GetForegroundWindow() -> Hwnd;
    fn GetWindowDC(hwnd: Hwnd) -> Hdc;
    fn ReleaseDC(hwnd: Hwnd, hdc: Hdc) -> i32;
    fn PrintWindow(hwnd: Hwnd, hdc: Hdc, flags: u32) -> i32;
}

#[link(name = "gdi32")]
extern "system" {
    fn CreateCompatibleDC(hdc: Hdc) -> Hdc;
    fn CreateCompatibleBitmap(hdc: Hdc, width: i32, height: i32) -> Hbitmap;
    fn SelectObject(hdc: Hdc, object: Hgdiobj) -> Hgdiobj;
    fn DeleteObject(object: Hgdiobj) -> i32;
    fn DeleteDC(hdc: Hdc) -> i32;
    fn GetDIBits(hdc: Hdc, bitmap: Hbitmap, start: u32, lines: u32, bits: *mut c_void, info: *mut BitmapInfo, usage: u32) -> i32;
}

fn process_names(tile_id: &str) -> Vec<String> {
    if let Some(path) = tile_id.strip_prefix("exe:") {
        return std::path::Path::new(path).file_stem().and_then(|stem| stem.to_str()).map(|stem| vec![stem.to_lowercase()]).unwrap_or_default();
    }
    match tile_id {
        "discord" => vec!["discord"],
        "spotify" => vec!["spotify"],
        "steam" => vec!["steam"],
        "epic" => vec!["epicgameslauncher"],
        "battlenet" => vec!["battle.net"],
        _ => vec![],
    }.into_iter().map(str::to_string).collect()
}

struct Candidate { hwnd: Hwnd, title: String, rect: Rect }
struct EnumerateState { target_pids: HashSet<u32>, candidates: Vec<Candidate> }

extern "system" fn collect_window(hwnd: Hwnd, param: isize) -> i32 {
    let state = unsafe { &mut *(param as *mut EnumerateState) };
    unsafe {
        if IsWindowVisible(hwnd) == 0 || IsIconic(hwnd) != 0 { return 1; }
        let mut pid = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if !state.target_pids.contains(&pid) { return 1; }
        let mut rect = Rect::default();
        if GetWindowRect(hwnd, &mut rect) == 0 || rect.right - rect.left < 320 || rect.bottom - rect.top < 180 { return 1; }
        let length = GetWindowTextLengthW(hwnd);
        if length <= 0 { return 1; }
        let mut title = vec![0u16; length as usize + 1];
        let written = GetWindowTextW(hwnd, title.as_mut_ptr(), title.len() as i32);
        if written <= 0 { return 1; }
        state.candidates.push(Candidate { hwnd, title: String::from_utf16_lossy(&title[..written as usize]), rect });
    }
    1
}

fn capture(hwnd: Hwnd, rect: Rect) -> Option<(Vec<u8>, i32, i32)> {
    let source_width = rect.right - rect.left;
    let source_height = rect.bottom - rect.top;
    // PrintWindow renders at the source window's native size. Capturing into a
    // smaller target can clip the result, so preserve that size for correctness.
    let width = source_width;
    let height = source_height;
    unsafe {
        let window_dc = GetWindowDC(hwnd);
        if window_dc == 0 { return None; }
        let memory_dc = CreateCompatibleDC(window_dc);
        let bitmap = CreateCompatibleBitmap(window_dc, width, height);
        if memory_dc == 0 || bitmap == 0 {
            if memory_dc != 0 { DeleteDC(memory_dc); }
            ReleaseDC(hwnd, window_dc);
            return None;
        }
        let old = SelectObject(memory_dc, bitmap);
        // PW_RENDERFULLCONTENT asks supported modern windows for their full frame.
        let rendered = PrintWindow(hwnd, memory_dc, 0x0000_0002) != 0;
        let mut info = BitmapInfo { header: BitmapInfoHeader { bi_size: std::mem::size_of::<BitmapInfoHeader>() as u32, bi_width: width, bi_height: -height, bi_planes: 1, bi_bit_count: 32, bi_compression: 0, ..Default::default() }, ..Default::default() };
        let mut bgra = vec![0u8; (width * height * 4) as usize];
        let copied = rendered && GetDIBits(memory_dc, bitmap, 0, height as u32, bgra.as_mut_ptr().cast(), &mut info, 0) != 0;
        SelectObject(memory_dc, old);
        DeleteObject(bitmap);
        DeleteDC(memory_dc);
        ReleaseDC(hwnd, window_dc);
        if !copied { return None; }
        let brightness: u64 = bgra.chunks_exact(4).step_by(97).map(|pixel| pixel[0] as u64 + pixel[1] as u64 + pixel[2] as u64).sum();
        if brightness < (bgra.len() as u64 / 4 / 97).max(1) * 7 { return None; }
        let mut rgba = bgra;
        for pixel in rgba.chunks_exact_mut(4) { pixel.swap(0, 2); pixel[3] = 255; }
        Some((rgba, width, height))
    }
}

pub fn prepare(tile_id: String) -> Option<LiveBackdropFrame> {
    let names = process_names(&tile_id);
    if names.is_empty() { return None; }
    let mut system = System::new();
    system.refresh_processes(ProcessesToUpdate::All);
    let target_pids: HashSet<u32> = system.processes().iter().filter_map(|(pid, process)| {
        let name = process.name().to_string_lossy().trim_end_matches(".exe").to_lowercase();
        names.iter().any(|target| target == &name).then_some(pid.as_u32())
    }).collect();
    if target_pids.is_empty() { return None; }
    let mut state = EnumerateState { target_pids, candidates: Vec::new() };
    unsafe { EnumWindows(collect_window, (&mut state as *mut EnumerateState) as isize); }
    let foreground = unsafe { GetForegroundWindow() };
    let candidate = if let Some(index) = state.candidates.iter().position(|candidate| candidate.hwnd == foreground) {
        state.candidates.swap_remove(index)
    } else if state.candidates.len() == 1 {
        state.candidates.pop()?
    } else {
        return None;
    };
    let (rgba, width, height) = capture(candidate.hwnd, candidate.rect)?;
    let image = ImageBuffer::<Rgba<u8>, _>::from_raw(width as u32, height as u32, rgba)?;
    let mut png = Vec::new();
    DynamicImage::ImageRgba8(image).write_to(&mut Cursor::new(&mut png), ImageFormat::Png).ok()?;
    Some(LiveBackdropFrame { tile_id, title: candidate.title, data_url: format!("data:image/png;base64,{}", STANDARD.encode(png)), width, height })
}
