use std::sync::Mutex;

use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Tracks ghost mode (click-through) so the keyboard shortcut and the UI
/// button always agree on the current state.
struct AppState {
    ghost: Mutex<bool>,
}

/// Park the pet window at the bottom-center of the screen's work area
/// (above the taskbar), so Luna reads as a desktop pet, not a window.
fn dock_bottom_center(window: &tauri::WebviewWindow) {
    let Ok(Some(monitor)) = window.current_monitor() else {
        return;
    };
    let area = monitor.work_area();
    let (ax, ay, aw, ah) = if area.size.width > 0 && area.size.height > 0 {
        (
            area.position.x as i64,
            area.position.y as i64,
            area.size.width as i64,
            area.size.height as i64,
        )
    } else {
        let pos = monitor.position();
        let size = monitor.size();
        (
            pos.x as i64,
            pos.y as i64,
            size.width as i64,
            size.height as i64,
        )
    };
    let scale = monitor.scale_factor();
    let win = window.outer_size().unwrap_or_default();
    let x = ((aw - win.width as i64) / 2).max(0) + ax;
    let y = (ah - win.height as i64 - (12.0 * scale).round() as i64).max(0) + ay;
    let _ = window.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
}

/// Ghost mode: the window ignores cursor events entirely, so Luna floats
/// over your editor without eating clicks. Press Ctrl+Alt+L to release her.
#[tauri::command]
fn set_ghost(
    state: tauri::State<'_, AppState>,
    window: tauri::WebviewWindow,
    ghost: bool,
) -> Result<(), String> {
    *state.ghost.lock().map_err(|e| e.to_string())? = ghost;
    window
        .set_ignore_cursor_events(ghost)
        .map_err(|e| e.to_string())?;
    let _ = window.emit("luna-ghost-toggle", ghost);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            ghost: Mutex::new(false),
        })
        .invoke_handler(tauri::generate_handler![set_ghost])
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            let state = app.state::<AppState>();
                            let mut ghost = state.ghost.lock().unwrap_or_else(|e| e.into_inner());
                            *ghost = !*ghost;
                            let _ = window.set_ignore_cursor_events(*ghost);
                            let _ = window.emit("luna-ghost-toggle", *ghost);
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                dock_bottom_center(&window);
            }
            // Ctrl+Alt+L toggles ghost mode from anywhere, even when the
            // pet window is ignoring clicks.
            let shortcut =
                Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyL);
            let _ = app.handle().global_shortcut().register(shortcut);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Code Companion-luna");
}
