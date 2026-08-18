//! Client half of Luna's loopback channel. Deliberately free of any Tauri
//! dependency so the `luna` CLI binary stays tiny.

use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::net::{Ipv4Addr, SocketAddrV4, TcpStream};
use std::time::Duration;

use crate::paths;

pub struct Client {
    stream: TcpStream,
    token: String,
}

impl Client {
    pub fn connect() -> Result<Self, String> {
        let raw = std::fs::read_to_string(paths::ipc_file())
            .map_err(|_| "Luna isn't running.".to_string())?;
        let info: Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
        let port = info
            .get("port")
            .and_then(Value::as_u64)
            .ok_or("handshake file has no port")? as u16;
        let token = info
            .get("token")
            .and_then(Value::as_str)
            .ok_or("handshake file has no token")?
            .to_string();

        let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, port);
        let stream = TcpStream::connect_timeout(&addr.into(), Duration::from_millis(800))
            .map_err(|_| "Luna isn't running.".to_string())?;
        stream.set_read_timeout(Some(Duration::from_secs(3))).ok();

        Ok(Self { stream, token })
    }

    pub fn send(&mut self, mut msg: Value) -> Result<Value, String> {
        if let Some(obj) = msg.as_object_mut() {
            obj.insert("token".into(), json!(self.token));
        }
        writeln!(self.stream, "{msg}").map_err(|e| e.to_string())?;
        self.stream.flush().ok();

        let mut reader = BufReader::new(self.stream.try_clone().map_err(|e| e.to_string())?);
        let mut line = String::new();
        reader.read_line(&mut line).map_err(|e| e.to_string())?;
        serde_json::from_str(line.trim()).map_err(|e| e.to_string())
    }
}

/// One-shot: connect, say a thing, read the reply.
pub fn tell(msg: Value) -> Result<Value, String> {
    Client::connect()?.send(msg)
}
