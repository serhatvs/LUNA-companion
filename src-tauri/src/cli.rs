//! `luna <verb>` - the tiny CLI that makes her build-aware.
//!
//! The headline is `luna watch "bun run build"`: it runs your command exactly
//! as your shell would, passes the output straight through, and tells Luna when
//! it starts, passes or fails.

use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use crate::ipc_client as ipc;

const HELP: &str = r#"Luna - a featherweight desktop cat for your builds

USAGE
  luna watch <command...>   run a command; Luna waits, then cheers or sulks
  luna say <text>           make her say something
  luna ghost [on|off]       click-through mode
  luna summon               bring her to the middle of the screen
  luna sleep                tell her to take a nap
  luna status               print how she's doing
  luna help                 this

EXAMPLES
  luna watch bun run build
  luna watch "cargo test --all"
  luna say "back in 10"

Luna must already be running; start her from the Start menu or tray.
"#;

pub fn run(args: &[String]) -> i32 {
    attach_console();

    let verb = args[0].as_str();
    let rest = &args[1..];

    match verb {
        "watch" => watch(rest),
        "say" => {
            let text = rest.join(" ");
            if text.is_empty() {
                eprintln!("luna say: needs something to say");
                return 2;
            }
            report(ipc::tell(json!({ "type": "say", "text": text })))
        }
        "ghost" => {
            let on = match rest.first().map(String::as_str) {
                Some("off") | Some("false") | Some("0") => Some(false),
                Some("on") | Some("true") | Some("1") | None => Some(true),
                Some("toggle") => None,
                Some(other) => {
                    eprintln!("luna ghost: expected on|off|toggle, got {other:?}");
                    return 2;
                }
            };
            report(ipc::tell(json!({ "type": "ghost", "on": on })))
        }
        "summon" => report(ipc::tell(json!({ "type": "summon" }))),
        "sleep" => report(ipc::tell(json!({ "type": "sleep" }))),
        "status" => status(),
        "help" | "--help" | "-h" => {
            println!("{HELP}");
            0
        }
        "--version" | "-v" | "version" => {
            println!("luna {}", env!("CARGO_PKG_VERSION"));
            0
        }
        other => {
            eprintln!("luna: unknown command {other:?}\n\n{HELP}");
            2
        }
    }
}

fn report(result: Result<Value, String>) -> i32 {
    match result {
        Ok(_) => 0,
        Err(e) => {
            eprintln!("luna: {e}");
            1
        }
    }
}

fn status() -> i32 {
    match ipc::tell(json!({ "type": "status" })) {
        Ok(v) => {
            let stats = v.pointer("/state/stats").cloned().unwrap_or(Value::Null);
            if stats.is_null() {
                println!("Luna is running, but hasn't saved a mood yet.");
                return 0;
            }
            let pct = |k: &str| (stats.get(k).and_then(Value::as_f64).unwrap_or(0.0) * 100.0).round();
            let n = |k: &str| stats.get(k).and_then(Value::as_i64).unwrap_or(0);
            println!("Luna - level {}", n("level"));
            println!("  mood     {:>3}%", pct("mood"));
            println!("  energy   {:>3}%", pct("energy"));
            println!("  fullness {:>3}%", pct("fullness"));
            println!("  bond     {:>3}%", pct("bond"));
            println!(
                "  builds   {} watched, {} green, {} red",
                n("builds"),
                n("buildsPassed"),
                n("buildsFailed")
            );
            println!("  pets     {}", n("pets"));
            0
        }
        Err(e) => {
            eprintln!("luna: {e}");
            1
        }
    }
}

// ------------------------------------------------------------------ luna watch

fn watch(cmd: &[String]) -> i32 {
    if cmd.is_empty() {
        eprintln!("luna watch: needs a command to run\n\n{HELP}");
        return 2;
    }

    let label = cmd.join(" ");
    // A single quoted argument is a shell line; several args are a shell line
    // too. Either way we let the platform shell do the parsing, so `luna watch
    // bun run build` and `luna watch "bun run build"` behave identically.
    let mut child = match spawn_shell(&label) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("luna watch: could not start command: {e}");
            return 127;
        }
    };

    let started = Instant::now();
    let _ = ipc::tell(json!({ "type": "build", "phase": "start", "label": label }));

    let tail: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
    let mut pumps = Vec::new();
    if let Some(out) = child.stdout.take() {
        pumps.push(pump(out, tail.clone(), false));
    }
    if let Some(err) = child.stderr.take() {
        pumps.push(pump(err, tail.clone(), true));
    }

    let status = child.wait();
    for p in pumps {
        let _ = p.join();
    }

    let ms = started.elapsed().as_millis() as u64;
    let code = status.map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);
    let ok = code == 0;

    let tail_text = {
        let lines = tail.lock().unwrap_or_else(|p| p.into_inner());
        let start = lines.len().saturating_sub(12);
        lines[start..].join("\n")
    };

    let _ = ipc::tell(json!({
        "type": "build",
        "phase": if ok { "ok" } else { "fail" },
        "label": label,
        "ms": ms,
        "code": code,
        "tail": if ok { String::new() } else { tail_text },
    }));

    code
}

fn spawn_shell(line: &str) -> std::io::Result<std::process::Child> {
    let mut cmd = if cfg!(windows) {
        let mut c = Command::new("cmd");
        c.arg("/C").arg(line);
        c
    } else {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".into());
        let mut c = Command::new(shell);
        c.arg("-c").arg(line);
        c
    };
    cmd.stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::inherit())
        .spawn()
}

fn pump<R: std::io::Read + Send + 'static>(
    reader: R,
    tail: Arc<Mutex<Vec<String>>>,
    is_err: bool,
) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        for line in BufReader::new(reader).lines().map_while(Result::ok) {
            if is_err {
                let mut e = std::io::stderr();
                let _ = writeln!(e, "{line}");
            } else {
                let mut o = std::io::stdout();
                let _ = writeln!(o, "{line}");
            }
            if let Ok(mut t) = tail.lock() {
                t.push(line);
                if t.len() > 200 {
                    t.drain(..100);
                }
            }
        }
    })
}

// The GUI binary is built for the windows subsystem, so in CLI mode we borrow
// the console we were launched from - otherwise output would vanish.
#[cfg(windows)]
fn attach_console() {
    // SAFETY: AttachConsole is safe to call with the parent-process constant;
    // it simply fails if there is no console to attach to.
    unsafe {
        windows_sys::Win32::System::Console::AttachConsole(0xFFFF_FFFF);
    }
}

#[cfg(not(windows))]
fn attach_console() {}
