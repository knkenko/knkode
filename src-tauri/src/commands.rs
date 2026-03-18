use crate::config::ConfigStore;
use crate::pty::PtyManager;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Cannot determine home directory".to_string())
}

// --- Config commands ---

#[tauri::command]
pub fn get_workspaces(config: State<'_, ConfigStore>) -> Result<Vec<Value>, String> {
    config.get_workspaces()
}

#[tauri::command]
pub fn save_workspace(workspace: Value, config: State<'_, ConfigStore>) -> Result<(), String> {
    config.save_workspace(workspace)
}

#[tauri::command]
pub fn delete_workspace(id: String, config: State<'_, ConfigStore>) -> Result<(), String> {
    config.delete_workspace(&id)
}

#[tauri::command]
pub fn get_app_state(config: State<'_, ConfigStore>) -> Result<Value, String> {
    config.get_app_state()
}

#[tauri::command]
pub fn save_app_state(state: Value, config: State<'_, ConfigStore>) -> Result<(), String> {
    config.save_app_state(state)
}

#[tauri::command]
pub fn get_snippets(config: State<'_, ConfigStore>) -> Result<Vec<Value>, String> {
    config.get_snippets()
}

#[tauri::command]
pub fn save_snippets(snippets: Vec<Value>, config: State<'_, ConfigStore>) -> Result<(), String> {
    config.save_snippets(snippets)
}

// --- PTY commands ---

#[tauri::command]
pub fn create_pty(
    id: String,
    cwd: String,
    startup_command: Option<String>,
    pty_mgr: State<'_, PtyManager>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    pty_mgr.create(id, cwd, startup_command, app)
}

#[tauri::command]
pub fn write_pty(id: String, data: String, pty_mgr: State<'_, PtyManager>) -> Result<(), String> {
    pty_mgr.write(&id, &data)
}

#[tauri::command]
pub fn resize_pty(
    id: String,
    cols: u16,
    rows: u16,
    pty_mgr: State<'_, PtyManager>,
) -> Result<(), String> {
    pty_mgr.resize(&id, cols, rows)
}

#[tauri::command]
pub fn kill_pty(id: String, pty_mgr: State<'_, PtyManager>) -> Result<(), String> {
    pty_mgr.kill(&id)
}

// --- Debug ---

#[tauri::command]
pub fn log_scroll_debug(event: Value) -> Result<(), String> {
    // Phase 6 will add optional file logging. For now, just acknowledge.
    let _ = event;
    Ok(())
}
