mod commands;
mod config;
mod pty;
mod terminal;

use config::ConfigStore;
use pty::PtyManager;
use std::sync::Arc;
use tauri::Manager;
use terminal::TerminalState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    let config_store = ConfigStore::new()?;
    let terminal_state = Arc::new(TerminalState::new());

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(config_store)
        .manage(PtyManager::new(Arc::clone(&terminal_state)))
        .invoke_handler(tauri::generate_handler![
            commands::get_home_dir,
            commands::get_workspaces,
            commands::save_workspace,
            commands::delete_workspace,
            commands::get_app_state,
            commands::save_app_state,
            commands::get_snippets,
            commands::save_snippets,
            commands::create_pty,
            commands::write_pty,
            commands::resize_pty,
            commands::kill_pty,
            commands::log_scroll_debug,
        ])
        .build(tauri::generate_context!())?;

    // Use build() + run() instead of Builder::run() so we can hook into
    // RunEvent::Exit to clean up all PTY child processes and prevent orphans
    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            app_handle.state::<PtyManager>().kill_all();
        }
    });

    Ok(())
}
