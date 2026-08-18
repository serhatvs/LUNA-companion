//! Reading the room: is something running fullscreen in front of us, and has
//! the human touched anything lately?
//!
//! Both answers are polled once a second and only pushed when they change.

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

use crate::state::AppState;

#[derive(Clone, Serialize, PartialEq)]
pub struct Presence {
    pub fullscreen: bool,
    pub idle_ms: u64,
}

pub fn watch(app: AppHandle, running: Arc<AtomicBool>) {
    std::thread::spawn(move || {
        let mut last: Option<Presence> = None;

        while running.load(Ordering::Relaxed) {
            let now = Presence {
                fullscreen: fullscreen_app_in_front(),
                // Rounded so a drifting idle counter doesn't spam the webview.
                idle_ms: idle_ms() / 1000 * 1000,
            };

            let changed = match &last {
                Some(prev) => {
                    prev.fullscreen != now.fullscreen
                        || prev.idle_ms.abs_diff(now.idle_ms) >= 5_000
                        || (now.idle_ms < 2_000 && prev.idle_ms >= 2_000)
                }
                None => true,
            };

            if changed {
                // Auto-ghost is enforced in Rust too, so a game never eats a
                // click even if the webview is busy.
                if let Some(state) = app.try_state::<AppState>() {
                    if let Ok(mut shared) = state.shared.lock() {
                        shared.auto_ghost = now.fullscreen;
                    }
                }
                let _ = app.emit("luna://presence", now.clone());
                last = Some(now);
            }

            std::thread::sleep(Duration::from_millis(1000));
        }
    });
}

// ------------------------------------------------------------------- windows

#[cfg(windows)]
pub fn fullscreen_app_in_front() -> bool {
    use windows_sys::Win32::Foundation::{HWND, RECT};
    use windows_sys::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetClassNameW, GetDesktopWindow, GetForegroundWindow, GetShellWindow, GetWindowRect,
    };

    // SAFETY: plain read-only window queries; every pointer we pass is a live
    // local, and we bail out on the null/failure cases the API documents.
    unsafe {
        let hwnd: HWND = GetForegroundWindow();
        if hwnd.is_null() || hwnd == GetShellWindow() || hwnd == GetDesktopWindow() {
            return false;
        }

        // The desktop/wallpaper hosts are technically fullscreen - ignore them.
        let mut class = [0u16; 64];
        let len = GetClassNameW(hwnd, class.as_mut_ptr(), class.len() as i32);
        if len > 0 {
            let name = String::from_utf16_lossy(&class[..len as usize]);
            if matches!(name.as_str(), "WorkerW" | "Progman" | "Shell_TrayWnd") {
                return false;
            }
        }

        let mut rect = RECT { left: 0, top: 0, right: 0, bottom: 0 };
        if GetWindowRect(hwnd, &mut rect) == 0 {
            return false;
        }

        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        let mut info: MONITORINFO = std::mem::zeroed();
        info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(monitor, &mut info) == 0 {
            return false;
        }

        let m = info.rcMonitor;
        rect.left <= m.left && rect.top <= m.top && rect.right >= m.right && rect.bottom >= m.bottom
    }
}

#[cfg(windows)]
pub fn idle_ms() -> u64 {
    use windows_sys::Win32::System::SystemInformation::GetTickCount;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

    // SAFETY: GetLastInputInfo fills a struct we own and size correctly.
    unsafe {
        let mut info = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };
        if GetLastInputInfo(&mut info) == 0 {
            return 0;
        }
        GetTickCount().saturating_sub(info.dwTime) as u64
    }
}

// --------------------------------------------------------------- other places

// macOS and Linux don't hand this over without extra permissions or a pile of
// per-desktop code, so Luna simply assumes she's welcome. The frontend still
// tracks its own "you haven't touched me in a while" timer.
#[cfg(not(windows))]
pub fn fullscreen_app_in_front() -> bool {
    false
}

#[cfg(not(windows))]
pub fn idle_ms() -> u64 {
    0
}
