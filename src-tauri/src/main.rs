// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Err(e) = knkode_v2_lib::run() {
        eprintln!("knkode: fatal error — {e}");
        std::process::exit(1);
    }
}
