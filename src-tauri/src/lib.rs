//! Luna - a featherweight desktop companion.
//!
//! Rust owns the boring, heavy things: one transparent overlay window across
//! every monitor, click-through hit testing, the tray, persistence and the CLI
//! channel. Everything about *who Luna is* lives in the frontend.

pub mod cli;
pub mod ipc;
pub mod ipc_client;
pub mod overlay;
pub mod paths;
pub mod presence;
pub mod state;
pub mod tray;

use serde_json::{json, Value};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

use state::{AppState, Rect};

#[tauri::command]
fn bootstrap(app: tauri::AppHandle) -> Value {
    let bounds = overlay::desktop_bounds(&app);
    json!({
        "state": state::load(),
        "screen": {
            "x": bounds.x,
            "y": bounds.y,
            "w": bounds.w,
            "h": bounds.h,
            "scale": bounds.scale,
        },
        "monitors": overlay::monitors(&app),
        "version": env!("CARGO_PKG_VERSION"),
        "platform": std::env::consts::OS,
        "dataDir": paths::data_dir().to_string_lossy(),
        "cliPath": cli_path().map(|p| p.to_string_lossy().to_string()),
    })
}

#[tauri::command]
fn persist(value: Value) -> Result<(), String> {
    state::save(&value)
}

#[tauri::command]
fn diary(entry: Value) {
    state::diary_append(&entry);
}

/// Screen-space (physical px) boxes that should catch the mouse.
#[tauri::command]
fn set_hit_rects(state: tauri::State<'_, AppState>, rects: Vec<Rect>) {
    if let Ok(mut shared) = state.shared.lock() {
        shared.hit_rects = rects;
    }
}

/// Held while Luna is being dragged: the window stays solid even if the cursor
/// outruns her.
#[tauri::command]
fn set_pointer_lock(state: tauri::State<'_, AppState>, locked: bool) {
    if let Ok(mut shared) = state.shared.lock() {
        shared.pointer_locked = locked;
    }
}

#[tauri::command]
fn set_ghost(app: tauri::AppHandle, on: bool) {
    tray::sync_ghost(&app, on);
}

#[tauri::command]
fn set_autostart(app: tauri::AppHandle, on: bool) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    let manager = app.autolaunch();
    let result = if on { manager.enable() } else { manager.disable() };
    result.map_err(|e| e.to_string())?;
    manager.is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
fn refit(app: tauri::AppHandle) -> Value {
    let Some(window) = app.get_webview_window(overlay::LABEL) else {
        return Value::Null;
    };
    let b = overlay::fit_to_desktop(&window);
    json!({
        "screen": { "x": b.x, "y": b.y, "w": b.w, "h": b.h, "scale": b.scale },
        "monitors": overlay::monitors(&app),
    })
}

#[tauri::command]
fn quit(app: tauri::AppHandle) {
    app.exit(0);
}

fn cli_path() -> Option<std::path::PathBuf> {
    let dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    let exe = if cfg!(windows) { "luna.exe" } else { "luna" };
    let path = dir.join(exe);
    path.exists().then_some(path)
}

pub fn run() {
    let running = Arc::new(AtomicBool::new(true));

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // Someone launched Luna twice - just wave at them.
            let _ = app.emit("luna://tray", "summon");
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            bootstrap,
            persist,
            diary,
            set_hit_rects,
            set_pointer_lock,
            set_ghost,
            set_autostart,
            refit,
            quit,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();

            // A screen pet has no business in the dock.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let window = WebviewWindowBuilder::new(
                &handle,
                overlay::LABEL,
                WebviewUrl::App("index.html".into()),
            )
            .title("Luna")
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .maximizable(false)
            .minimizable(false)
            .shadow(false)
            .focused(false)
            .visible(false)
            .build()?;

            overlay::fit_to_desktop(&window);
            overlay::make_non_activating(&window);
            let _ = window.set_ignore_cursor_events(true);
            let _ = window.show();

            tray::build(&handle)?;
            ipc::serve(handle.clone())?;
            overlay::watch_cursor(handle.clone(), running.clone());
            presence::watch(handle.clone(), running.clone());

            Ok(())
        })
        .on_window_event(|window, event| {
            // Luna has no close button, but the OS might still ask.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("Luna could not start");
}
