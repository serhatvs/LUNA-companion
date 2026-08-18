//! Persistence + the little bit of runtime state Rust needs to share between
//! threads. The *schema* of the saved blob lives in the frontend; Rust only
//! stores and returns it, so there is one definition of Luna's mind.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::Write;
use std::sync::Mutex;

use crate::paths;

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

impl Rect {
    pub fn contains(&self, x: f64, y: f64) -> bool {
        x >= self.x && x <= self.x + self.w && y >= self.y && y <= self.y + self.h
    }
}

/// Runtime flags shared between the UI thread, the cursor watcher and the IPC
/// server.
#[derive(Default)]
pub struct Shared {
    /// Screen-space boxes that should catch the mouse (Luna, her toys).
    pub hit_rects: Vec<Rect>,
    /// While she is being dragged we keep the window interactive no matter what.
    pub pointer_locked: bool,
    /// Ghost mode: never catch the mouse.
    pub ghost: bool,
    /// Auto-ghost because a fullscreen app is in front.
    pub auto_ghost: bool,
    /// Last value pushed to the window, so we only call the OS on change.
    pub ignoring: Option<bool>,
}

pub struct AppState {
    pub shared: Mutex<Shared>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            shared: Mutex::new(Shared {
                ignoring: None,
                ..Default::default()
            }),
        }
    }
}

pub fn load() -> Option<Value> {
    let raw = std::fs::read_to_string(paths::state_file()).ok()?;
    serde_json::from_str(&raw).ok()
}

/// Write via a temp file so a crash mid-save can never leave Luna amnesiac.
pub fn save(value: &Value) -> Result<(), String> {
    let path = paths::state_file();
    let tmp = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec(value).map_err(|e| e.to_string())?;
    {
        let mut f = std::fs::File::create(&tmp).map_err(|e| e.to_string())?;
        f.write_all(&bytes).map_err(|e| e.to_string())?;
        f.sync_all().ok();
    }
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

/// Append one line to Luna's diary. Cheap, append-only, human readable.
pub fn diary_append(entry: &Value) {
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(paths::diary_file())
    {
        let _ = writeln!(f, "{}", entry);
    }
}
