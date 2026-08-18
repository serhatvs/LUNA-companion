//! Where Luna keeps her things.
//!
//! Both the GUI and the CLI resolve this the same way, without a Tauri app
//! handle, so the CLI can always find a running cat.

use std::path::PathBuf;

pub const IDENTIFIER: &str = "com.luna.companion";

pub fn data_dir() -> PathBuf {
    let base = if cfg!(windows) {
        std::env::var_os("APPDATA").map(PathBuf::from)
    } else if cfg!(target_os = "macos") {
        std::env::var_os("HOME").map(|h| PathBuf::from(h).join("Library/Application Support"))
    } else {
        std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local/share")))
    };

    let dir = base
        .unwrap_or_else(std::env::temp_dir)
        .join(IDENTIFIER);
    let _ = std::fs::create_dir_all(&dir);
    dir
}

pub fn state_file() -> PathBuf {
    data_dir().join("luna.json")
}

pub fn ipc_file() -> PathBuf {
    data_dir().join("ipc.json")
}

pub fn diary_file() -> PathBuf {
    data_dir().join("diary.jsonl")
}
