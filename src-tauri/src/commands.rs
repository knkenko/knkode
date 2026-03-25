use crate::config::ConfigStore;
use crate::pty::PtyManager;
use crate::session_scanner;
use crate::terminal::{AnsiThemeColors, GridSnapshot, SelectionRange, TerminalState};
use crate::tracker::CwdTracker;
use serde_json::Value;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn get_home_dir() -> Result<String, String> {
    let path = crate::config::home_dir()?;
    path.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Home directory path contains invalid UTF-8".to_string())
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
    pty_mgr: State<'_, Arc<PtyManager>>,
    tracker: State<'_, CwdTracker>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    if cwd.contains('\0') {
        return Err("cwd must not contain null bytes".to_string());
    }
    let cwd_path = std::path::Path::new(&cwd);
    if !cwd_path.is_absolute() {
        return Err("cwd must be an absolute path".to_string());
    }
    if !cwd_path.is_dir() {
        return Err(format!("cwd does not exist or is not a directory: {cwd}"));
    }
    if let Some(ref cmd) = startup_command {
        if cmd.contains('\0') {
            return Err("startup_command must not contain null bytes".to_string());
        }
    }
    pty_mgr.create(id.clone(), cwd.clone(), startup_command, app)?;
    tracker.track_pane(id, cwd);
    Ok(())
}

#[tauri::command]
pub fn write_pty(
    id: String,
    data: String,
    pty_mgr: State<'_, Arc<PtyManager>>,
) -> Result<(), String> {
    pty_mgr.write(&id, &data)
}

#[tauri::command]
pub fn resize_pty(
    id: String,
    cols: u16,
    rows: u16,
    pixel_width: Option<u16>,
    pixel_height: Option<u16>,
    pty_mgr: State<'_, Arc<PtyManager>>,
) -> Result<(), String> {
    if cols == 0 || rows == 0 {
        return Err("cols and rows must be at least 1".to_string());
    }
    if cols > 500 || rows > 500 {
        return Err(format!(
            "cols ({cols}) and rows ({rows}) must not exceed 500"
        ));
    }
    // Cap pixel dimensions to a reasonable maximum; 0 = unknown/unset
    let pw = pixel_width.unwrap_or(0).min(16384);
    let ph = pixel_height.unwrap_or(0).min(16384);
    pty_mgr.resize(&id, cols, rows, pw, ph)
}

/// Register a pane for git branch/PR tracking without spawning a PTY.
/// Used for panes whose workspace hasn't been visited yet — the CwdTracker
/// will poll their CWD for branch info so the sidebar shows git status.
#[tauri::command]
pub fn track_pane_git(
    id: String,
    cwd: String,
    tracker: State<'_, CwdTracker>,
) -> Result<(), String> {
    if cwd.contains('\0') {
        return Err("cwd must not contain null bytes".to_string());
    }
    let cwd_path = std::path::Path::new(&cwd);
    if !cwd_path.is_absolute() {
        return Err("cwd must be an absolute path".to_string());
    }
    tracker.track_pane(id, cwd);
    Ok(())
}

#[tauri::command]
pub fn kill_pty(
    id: String,
    pty_mgr: State<'_, Arc<PtyManager>>,
    tracker: State<'_, CwdTracker>,
) -> Result<(), String> {
    tracker.untrack_pane(&id);
    pty_mgr.kill(&id)
}

// --- Terminal scroll ---

#[tauri::command]
pub fn scroll_terminal(
    id: String,
    offset: usize,
    terminal_state: State<'_, Arc<TerminalState>>,
) -> Result<GridSnapshot, String> {
    terminal_state
        .snapshot_at_offset(&id, offset)
        .ok_or_else(|| format!("Terminal session not found: {id}"))
}

// --- Terminal colors ---

#[tauri::command]
pub fn set_terminal_colors(
    id: String,
    ansi_colors: AnsiThemeColors,
    foreground: String,
    background: String,
    terminal_state: State<'_, Arc<TerminalState>>,
) -> Result<(), String> {
    terminal_state.set_colors(&id, &ansi_colors, &foreground, &background)
}

// --- Terminal selection ---

#[tauri::command]
pub fn get_selection_text(
    id: String,
    range: SelectionRange,
    terminal_state: State<'_, Arc<TerminalState>>,
) -> Result<String, String> {
    terminal_state.extract_text(&id, &range)
}

// --- Session history ---

#[tauri::command]
pub fn list_agent_sessions(
    project_cwd: String,
) -> Result<Vec<session_scanner::AgentSession>, String> {
    if project_cwd.contains('\0') {
        return Err("project_cwd must not contain null bytes".to_string());
    }
    let p = std::path::Path::new(&project_cwd);
    if !p.is_absolute() {
        return Err("project_cwd must be an absolute path".to_string());
    }
    Ok(session_scanner::list_sessions(&project_cwd))
}
