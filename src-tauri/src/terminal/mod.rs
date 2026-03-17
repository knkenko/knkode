//! Terminal emulation backend using alacritty_terminal.
//!
//! Provides PTY-backed terminal instances exposed as Tauri IPC commands.

pub mod commands;
pub mod event_proxy;
pub mod instance;
pub mod manager;
pub mod types;
