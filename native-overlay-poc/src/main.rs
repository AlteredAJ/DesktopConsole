//! Click-through native overlay proof-of-concept.
//!
//! `cargo run` opens a small, topmost, translucent HUD window. It does not
//! take focus or clicks from the foreground application. Close with Esc.
//! This is deliberately a rendering/windowing proof only; the Tauri host
//! remains the sole owner of controller input and application state.

use std::{env, ffi::c_void, time::Instant};

type Hwnd = isize;
type Hinstance = isize;
type Hbrush = isize;
type Hcursor = isize;
type Hicon = isize;
type Hdc = isize;
type Lresult = isize;
type Wparam = usize;
type Lparam = isize;

const WM_DESTROY: u32 = 0x0002;
const WM_PAINT: u32 = 0x000F;
const WM_KEYDOWN: u32 = 0x0100;
const WM_NCHITTEST: u32 = 0x0084;
const VK_ESCAPE: usize = 0x1B;
const HTTRANSPARENT: Lresult = -1;
const SW_SHOW: i32 = 5;
const SW_HIDE: i32 = 0;
const SW_SHOWNOACTIVATE: i32 = 4;
const WS_POPUP: u32 = 0x8000_0000;
const WS_EX_TOPMOST: u32 = 0x0000_0008;
const WS_EX_TRANSPARENT: u32 = 0x0000_0020;
const WS_EX_TOOLWINDOW: u32 = 0x0000_0080;
const WS_EX_LAYERED: u32 = 0x0008_0000;
const WS_EX_NOACTIVATE: u32 = 0x0800_0000;
const LWA_ALPHA: u32 = 0x0000_0002;
const COLOR_WINDOW: i32 = 5;
const GR_GDIOBJECTS: u32 = 0;
const GR_USEROBJECTS: u32 = 1;

#[repr(C)]
#[derive(Default)]
struct Point { x: i32, y: i32 }
#[repr(C)]
#[derive(Default)]
struct Msg { hwnd: Hwnd, message: u32, w_param: Wparam, l_param: Lparam, time: u32, point: Point, l_private: u32 }
#[repr(C)]
#[derive(Default)]
struct Rect { left: i32, top: i32, right: i32, bottom: i32 }
#[repr(C)]
#[derive(Default)]
struct PaintStruct { hdc: Hdc, erase: i32, paint: Rect, restore: i32, inc_update: i32, reserved: [u8; 32] }
#[repr(C)]
struct WndClassW {
    style: u32, wnd_proc: Option<extern "system" fn(Hwnd, u32, Wparam, Lparam) -> Lresult>,
    cls_extra: i32, wnd_extra: i32, instance: Hinstance, icon: Hicon, cursor: Hcursor,
    background: Hbrush, menu_name: *const u16, class_name: *const u16,
}

#[link(name = "user32")]
extern "system" {
    fn RegisterClassW(class: *const WndClassW) -> u16;
    fn CreateWindowExW(ex_style: u32, class: *const u16, title: *const u16, style: u32, x: i32, y: i32, width: i32, height: i32, parent: Hwnd, menu: isize, instance: Hinstance, param: *mut c_void) -> Hwnd;
    fn DefWindowProcW(hwnd: Hwnd, msg: u32, w: Wparam, l: Lparam) -> Lresult;
    fn ShowWindow(hwnd: Hwnd, command: i32) -> i32;
    fn UpdateWindow(hwnd: Hwnd) -> i32;
    fn DestroyWindow(hwnd: Hwnd) -> i32;
    fn GetMessageW(msg: *mut Msg, hwnd: Hwnd, min: u32, max: u32) -> i32;
    fn TranslateMessage(msg: *const Msg) -> i32;
    fn DispatchMessageW(msg: *const Msg) -> Lresult;
    fn PostQuitMessage(code: i32);
    fn BeginPaint(hwnd: Hwnd, paint: *mut PaintStruct) -> Hdc;
    fn EndPaint(hwnd: Hwnd, paint: *const PaintStruct) -> i32;
    fn GetClientRect(hwnd: Hwnd, rect: *mut Rect) -> i32;
    fn SetLayeredWindowAttributes(hwnd: Hwnd, key: u32, alpha: u8, flags: u32) -> i32;
    fn GetGuiResources(process: isize, flags: u32) -> u32;
}
#[link(name = "gdi32")]
extern "system" {
    fn CreateSolidBrush(color: u32) -> Hbrush;
    fn FillRect(hdc: Hdc, rect: *const Rect, brush: Hbrush) -> i32;
    fn DeleteObject(object: isize) -> i32;
}
#[link(name = "kernel32")]
extern "system" {
    fn GetModuleHandleW(name: *const u16) -> Hinstance;
    fn GetCurrentProcess() -> isize;
}
#[link(name = "dwmapi")]
extern "system" { fn DwmFlush() -> i32; }

extern "system" fn window_proc(hwnd: Hwnd, msg: u32, w: Wparam, l: Lparam) -> Lresult {
    unsafe { match msg {
        WM_NCHITTEST => return HTTRANSPARENT,
        WM_KEYDOWN if w == VK_ESCAPE => { PostQuitMessage(0); return 0; }
        WM_DESTROY => { PostQuitMessage(0); return 0; }
        WM_PAINT => {
            let mut paint = PaintStruct::default();
            let hdc = BeginPaint(hwnd, &mut paint);
            let mut rect = Rect::default(); GetClientRect(hwnd, &mut rect);
            let brush = CreateSolidBrush(0x00302920); // BGR: deep blue-gray
            FillRect(hdc, &rect, brush); DeleteObject(brush);
            EndPaint(hwnd, &paint); return 0;
        }
        _ => DefWindowProcW(hwnd, msg, w, l),
    }}
}

fn wide(value: &str) -> Vec<u16> { value.encode_utf16().chain(Some(0)).collect() }

fn create_overlay() -> Hwnd {
    let class_name = wide("PS5ModeNativeOverlayPoc");
    let title = wide("PS5 Mode native overlay proof");
    unsafe {
        let instance = GetModuleHandleW(std::ptr::null());
        let class = WndClassW { style: 0, wnd_proc: Some(window_proc), cls_extra: 0, wnd_extra: 0, instance, icon: 0, cursor: 0, background: (COLOR_WINDOW + 1) as Hbrush, menu_name: std::ptr::null(), class_name: class_name.as_ptr() };
        // A second registration in the same process is harmless for this POC.
        RegisterClassW(&class);
        let hwnd = CreateWindowExW(WS_EX_TOPMOST | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_LAYERED | WS_EX_NOACTIVATE, class_name.as_ptr(), title.as_ptr(), WS_POPUP, 260, 80, 820, 250, 0, 0, instance, std::ptr::null_mut());
        if hwnd == 0 { panic!("Could not create overlay window"); }
        SetLayeredWindowAttributes(hwnd, 0, 230, LWA_ALPHA);
        hwnd
    }
}

fn percentile(samples: &mut [f64], fraction: f64) -> f64 {
    samples.sort_by(|a, b| a.total_cmp(b));
    samples[((samples.len() - 1) as f64 * fraction).round() as usize]
}

fn run_benchmark(cycles: usize) {
    let hwnd = create_overlay();
    let (gdi_before, user_before) = unsafe { (GetGuiResources(GetCurrentProcess(), GR_GDIOBJECTS), GetGuiResources(GetCurrentProcess(), GR_USEROBJECTS)) };
    let mut show_ms = Vec::with_capacity(cycles);
    let mut hide_ms = Vec::with_capacity(cycles);
    for _ in 0..cycles {
        let started = Instant::now();
        unsafe { ShowWindow(hwnd, SW_SHOWNOACTIVATE); UpdateWindow(hwnd); DwmFlush(); }
        show_ms.push(started.elapsed().as_secs_f64() * 1000.0);
        let started = Instant::now();
        unsafe { ShowWindow(hwnd, SW_HIDE); DwmFlush(); }
        hide_ms.push(started.elapsed().as_secs_f64() * 1000.0);
    }
    unsafe { DestroyWindow(hwnd); }
    let (gdi_after, user_after) = unsafe { (GetGuiResources(GetCurrentProcess(), GR_GDIOBJECTS), GetGuiResources(GetCurrentProcess(), GR_USEROBJECTS)) };
    let show_average = show_ms.iter().sum::<f64>() / cycles as f64;
    let hide_average = hide_ms.iter().sum::<f64>() / cycles as f64;
    println!("PS5 Mode native overlay benchmark ({} compositor-flushed cycles)", cycles);
    let show_p95 = percentile(&mut show_ms, 0.95);
    let hide_p95 = percentile(&mut hide_ms, 0.95);
    let show_max = show_ms.iter().copied().fold(0.0, f64::max);
    let hide_max = hide_ms.iter().copied().fold(0.0, f64::max);
    println!("show  avg: {:.2} ms | p95: {:.2} ms | max: {:.2} ms", show_average, show_p95, show_max);
    println!("hide  avg: {:.2} ms | p95: {:.2} ms | max: {:.2} ms", hide_average, hide_p95, hide_max);
    println!("handles GDI {} -> {} | USER {} -> {}", gdi_before, gdi_after, user_before, user_after);
    println!("scope: native click-through window mechanics on the current desktop compositor; exclusive fullscreen coverage is intentionally not claimed.");
}

fn main() {
    let arguments: Vec<String> = env::args().collect();
    if let Some(index) = arguments.iter().position(|argument| argument == "--benchmark") {
        let cycles = arguments.get(index + 1).and_then(|value| value.parse::<usize>().ok()).filter(|value| *value > 0).unwrap_or(20);
        run_benchmark(cycles);
        return;
    }
    let hwnd = create_overlay();
    unsafe {
        ShowWindow(hwnd, SW_SHOW); UpdateWindow(hwnd);
        let mut message = Msg::default();
        while GetMessageW(&mut message, 0, 0, 0) > 0 { TranslateMessage(&message); DispatchMessageW(&message); }
    }
}
