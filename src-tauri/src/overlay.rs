//! The overlay window is one big transparent sheet stretched across every
//! monitor. It is click-through by default; a watcher thread polls the OS
//! cursor and makes it solid only while the pointer is actually over Luna.
//!
//! That is what lets a full-screen window sit above your editor without ever
//! stealing a click, and it means Luna herself only ever repaints a 128px box.

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

use crate::state::AppState;

pub const LABEL: &str = "luna";

#[derive(Clone, Copy, Serialize)]
pub struct Bounds {
    pub x: i32,
    pub y: i32,
    pub w: u32,
    pub h: u32,
    pub scale: f64,
}

/// Union of every monitor: Luna's world.
pub fn desktop_bounds(app: &AppHandle) -> Bounds {
    let monitors = app.available_monitors().unwrap_or_default();
    let scale = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| m.scale_factor())
        .unwrap_or(1.0);

    if monitors.is_empty() {
        return Bounds { x: 0, y: 0, w: 1280, h: 720, scale };
    }

    let (mut min_x, mut min_y) = (i32::MAX, i32::MAX);
    let (mut max_x, mut max_y) = (i32::MIN, i32::MIN);
    for m in &monitors {
        let p = m.position();
        let s = m.size();
        min_x = min_x.min(p.x);
        min_y = min_y.min(p.y);
        max_x = max_x.max(p.x + s.width as i32);
        max_y = max_y.max(p.y + s.height as i32);
    }

    Bounds {
        x: min_x,
        y: min_y,
        w: (max_x - min_x).max(320) as u32,
        h: (max_y - min_y).max(240) as u32,
        scale,
    }
}

#[derive(Clone, Copy, Serialize)]
pub struct MonitorRect {
    pub x: i32,
    pub y: i32,
    pub w: u32,
    pub h: u32,
}

/// Each screen on its own, so Luna knows where every floor and wall is.
pub fn monitors(app: &AppHandle) -> Vec<MonitorRect> {
    app.available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|m| {
            let p = m.position();
            let s = m.size();
            MonitorRect { x: p.x, y: p.y, w: s.width, h: s.height }
        })
        .collect()
}

pub fn fit_to_desktop(window: &WebviewWindow) -> Bounds {
    let bounds = desktop_bounds(&window.app_handle().clone());
    let _ = window.set_size(PhysicalSize::new(bounds.w, bounds.h));
    let _ = window.set_position(PhysicalPosition::new(bounds.x, bounds.y));
    bounds
}

/// On Windows, mark the overlay as a no-activate tool window so petting the cat
/// never pulls focus away from your editor.
#[cfg(windows)]
pub fn make_non_activating(window: &WebviewWindow) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
    };
    if let Ok(hwnd) = window.hwnd() {
        // SAFETY: hwnd comes from the window we just created and is alive here.
        unsafe {
            let handle = hwnd.0 as *mut core::ffi::c_void;
            let ex = GetWindowLongPtrW(handle, GWL_EXSTYLE);
            SetWindowLongPtrW(
                handle,
                GWL_EXSTYLE,
                ex | (WS_EX_NOACTIVATE as isize) | (WS_EX_TOOLWINDOW as isize),
            );
        }
    }
}

#[cfg(not(windows))]
pub fn make_non_activating(_window: &WebviewWindow) {}

#[derive(Clone, Serialize)]
struct CursorEvent {
    x: f64,
    y: f64,
}

/// Poll the pointer, toggle click-through, and feed Luna the cursor so she can
/// chase it. Adaptive: fast while the cursor is near her, lazy otherwise.
pub fn watch_cursor(app: AppHandle, running: Arc<AtomicBool>) {
    std::thread::spawn(move || {
        let mut last_emit = Instant::now();
        let (mut last_x, mut last_y) = (f64::NAN, f64::NAN);

        while running.load(Ordering::Relaxed) {
            let Some(window) = app.get_webview_window(LABEL) else {
                std::thread::sleep(Duration::from_millis(200));
                continue;
            };

            let pos = app.cursor_position().ok();
            let mut near = false;

            if let Some(pos) = pos {
                let state = app.state::<AppState>();
                let mut shared = match state.shared.lock() {
                    Ok(s) => s,
                    Err(poisoned) => poisoned.into_inner(),
                };

                let ghosting = shared.ghost || shared.auto_ghost;
                let over = shared
                    .hit_rects
                    .iter()
                    .any(|r| r.contains(pos.x, pos.y));
                near = !ghosting
                    && shared.hit_rects.iter().any(|r| {
                        pos.x >= r.x - 160.0
                            && pos.x <= r.x + r.w + 160.0
                            && pos.y >= r.y - 160.0
                            && pos.y <= r.y + r.h + 160.0
                    });

                let want_ignore = ghosting || !(over || shared.pointer_locked);
                if shared.ignoring != Some(want_ignore) {
                    let _ = window.set_ignore_cursor_events(want_ignore);
                    shared.ignoring = Some(want_ignore);
                }
                drop(shared);

                let moved = (pos.x - last_x).abs() > 0.5 || (pos.y - last_y).abs() > 0.5;
                if moved && last_emit.elapsed() >= Duration::from_millis(33) {
                    last_x = pos.x;
                    last_y = pos.y;
                    last_emit = Instant::now();
                    let _ = app.emit("luna://cursor", CursorEvent { x: pos.x, y: pos.y });
                }
            }

            std::thread::sleep(Duration::from_millis(if near { 8 } else { 30 }));
        }
    });
}
