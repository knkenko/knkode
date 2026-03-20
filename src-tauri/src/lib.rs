mod commands;
mod config;
mod menu;
mod pty;
mod terminal;
mod tracker;
mod window;

use config::ConfigStore;
use pty::PtyManager;
use std::sync::Arc;
use tauri::Manager;
use terminal::TerminalState;
use tracker::CwdTracker;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    let config_store = ConfigStore::new()?;
    let terminal_state = Arc::new(TerminalState::new());
    let pty_manager = Arc::new(PtyManager::new(Arc::clone(&terminal_state)));

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(config_store)
        .manage(Arc::clone(&pty_manager))
        .manage(Arc::clone(&terminal_state))
        .manage(CwdTracker::new())
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
            commands::track_pane_git,
            commands::write_pty,
            commands::resize_pty,
            commands::kill_pty,
            commands::scroll_terminal,
            commands::set_terminal_colors,
            commands::get_selection_text,
            commands::log_scroll_debug,
        ])
        .setup(|app| {
            let menu = menu::build_menu(app.handle())?;
            app.set_menu(menu)?;
            window::setup_window(app);
            Ok(())
        })
        .build(tauri::generate_context!())?;

    // Start CWD/branch/PR polling thread
    let cwd_tracker = app.state::<CwdTracker>();
    cwd_tracker.start(app.handle().clone(), pty_manager);

    // Use build() + run() instead of Builder::run() so we can hook into
    // RunEvent::Exit to stop the CWD tracker and clean up all PTY child processes
    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            app_handle.state::<CwdTracker>().stop();
            app_handle.state::<Arc<PtyManager>>().kill_all();
        }
    });

    Ok(())
}
