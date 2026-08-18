//! Tray icon: the only chrome Luna has.

use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::{paths, state::AppState};

pub const GHOST_ITEM: &str = "ghost";

pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let summon = MenuItemBuilder::with_id("summon", "Come here, Luna").build(app)?;
    let ghost = CheckMenuItemBuilder::with_id(GHOST_ITEM, "Ghost mode (click-through)")
        .checked(false)
        .build(app)?;
    let nap = MenuItemBuilder::with_id("sleep", "Take a nap").build(app)?;
    let settings = MenuItemBuilder::with_id("settings", "Settings...").build(app)?;
    let folder = MenuItemBuilder::with_id("folder", "Open Luna's folder").build(app)?;
    let about = MenuItemBuilder::with_id("about", "About Luna").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[&summon, &ghost, &nap])
        .separator()
        .items(&[&settings, &folder, &about])
        .separator()
        .items(&[&quit])
        .build()?;

    let mut builder = TrayIconBuilder::with_id("luna-tray")
        .tooltip("Luna")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            match id {
                "quit" => {
                    let _ = app.emit("luna://tray", "quit");
                    // Give the webview a beat to persist her mood, then go.
                    let handle = app.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(220));
                        handle.exit(0);
                    });
                }
                "folder" => open_path(&paths::data_dir()),
                other => {
                    let _ = app.emit("luna://tray", other);
                }
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = tray.app_handle().emit("luna://tray", "summon");
            }
        })
        .build(app)?;

    Ok(())
}

/// Keep the tray checkbox honest when ghost mode is toggled from elsewhere.
pub fn sync_ghost(app: &AppHandle, on: bool) {
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut shared) = state.shared.lock() {
            shared.ghost = on;
        }
    }
    // The menu item is rebuilt rarely; a missing handle is not worth failing on.
    if let Some(tray) = app.tray_by_id("luna-tray") {
        let _ = tray.set_tooltip(Some(if on { "Luna (ghost mode)" } else { "Luna" }));
    }
}

fn open_path(path: &std::path::Path) {
    let program = if cfg!(windows) {
        "explorer"
    } else if cfg!(target_os = "macos") {
        "open"
    } else {
        "xdg-open"
    };
    let _ = std::process::Command::new(program).arg(path).spawn();
}
