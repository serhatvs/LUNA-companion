//! Server half of Luna's loopback channel, so the `luna` CLI can poke the
//! running cat.
//!
//! Newline-delimited JSON over 127.0.0.1 on an ephemeral port. The port and a
//! random token are dropped in Luna's data dir; without the token the server
//! hangs up immediately, so nothing else on the machine can drive your pet.

use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::net::{Ipv4Addr, SocketAddrV4, TcpListener, TcpStream};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::{paths, state};

fn make_token() -> String {
    // RandomState is seeded from the OS per process, which is exactly the kind
    // of unguessable this needs - and it costs no extra dependency.
    use std::hash::{BuildHasher, Hasher};
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0);
    let seed = std::collections::hash_map::RandomState::new();
    let mut a = seed.build_hasher();
    a.write_u64(nanos);
    let mut b = seed.build_hasher();
    b.write_u64(nanos ^ u64::from(std::process::id()));
    format!("{:016x}{:016x}", a.finish(), b.finish())
}

pub fn serve(app: AppHandle) -> std::io::Result<()> {
    let listener = TcpListener::bind(SocketAddrV4::new(Ipv4Addr::LOCALHOST, 0))?;
    let port = listener.local_addr()?.port();
    let token = make_token();

    std::fs::write(
        paths::ipc_file(),
        serde_json::to_vec(&json!({
            "port": port,
            "token": token,
            "pid": std::process::id(),
        }))
        .unwrap_or_default(),
    )?;

    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let app = app.clone();
            let token = token.clone();
            std::thread::spawn(move || {
                let _ = handle(app, token, stream);
            });
        }
    });

    Ok(())
}

fn handle(app: AppHandle, token: String, stream: TcpStream) -> std::io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(10)))?;
    let mut writer = stream.try_clone()?;
    let mut reader = BufReader::new(stream);
    let mut line = String::new();

    while reader.read_line(&mut line)? > 0 {
        let msg: Value = match serde_json::from_str(line.trim()) {
            Ok(v) => v,
            Err(_) => break,
        };
        line.clear();

        if msg.get("token").and_then(Value::as_str) != Some(token.as_str()) {
            let _ = writeln!(writer, "{}", json!({ "ok": false, "error": "bad token" }));
            break;
        }

        let reply = match msg.get("type").and_then(Value::as_str).unwrap_or("") {
            "ping" => json!({ "ok": true, "version": env!("CARGO_PKG_VERSION") }),
            "status" => json!({ "ok": true, "state": state::load().unwrap_or(Value::Null) }),
            _ => {
                // Everything else is Luna's business - hand it to the webview.
                let _ = app.emit("luna://msg", msg.clone());
                json!({ "ok": true })
            }
        };
        writeln!(writer, "{reply}")?;
    }

    Ok(())
}
