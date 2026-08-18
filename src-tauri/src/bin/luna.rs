//! The `luna` CLI: a real console binary, so your shell waits for
//! `luna watch ...` the way it waits for any other command.
//!
//! It shares source with the app but links none of Tauri - it is a few hundred
//! kilobytes that only knows how to talk to a running cat.

#[path = "../paths.rs"]
mod paths;

#[path = "../ipc_client.rs"]
mod ipc_client;

#[path = "../cli.rs"]
mod cli;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.is_empty() {
        std::process::exit(cli::run(&["help".to_string()]));
    }
    std::process::exit(cli::run(&args));
}
