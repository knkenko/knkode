mod commands;
mod config;
mod pty;

use config::ConfigStore;
use pty::PtyManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    let config_store = ConfigStore::new()?;

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(config_store)
        .manage(PtyManager::new())
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
        .run(tauri::generate_context!())?;
    Ok(())
}
