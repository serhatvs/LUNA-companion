// Luna - featherweight desktop companion.
// One binary, two jobs: the overlay app, and the `luna` CLI that talks to it.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();

    // Anything with a verb is a CLI invocation against the running cat.
    if let Some(first) = args.first() {
        if !first.starts_with('-') || first == "--help" || first == "-h" {
            std::process::exit(luna_lib::cli::run(&args));
        }
    }

    luna_lib::run();
}
