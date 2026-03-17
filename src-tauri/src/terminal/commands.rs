use tauri::{AppHandle, State};

use crate::terminal::manager::TerminalManager;
use crate::terminal::types::CellGrid;

/// Create a new terminal instance and return its UUID.
#[tauri::command]
pub fn create_terminal(
    app_handle: AppHandle,
    manager: State<'_, TerminalManager>,
) -> Result<String, String> {
    manager.create(app_handle)
}

/// Write UTF-8 text input to the terminal's PTY.
#[tauri::command]
pub fn write_to_terminal(
    id: String,
    data: String,
    manager: State<'_, TerminalManager>,
) -> Result<(), String> {
    manager.write(&id, data.as_bytes())
}

/// Resize the terminal grid and PTY to the given dimensions.
#[tauri::command]
pub fn resize_terminal(
    id: String,
    cols: u16,
    rows: u16,
    manager: State<'_, TerminalManager>,
) -> Result<(), String> {
    manager.resize(&id, cols, rows)
}

/// Snapshot the terminal's visible grid for frontend rendering.
#[tauri::command]
pub fn get_terminal_state(
    id: String,
    manager: State<'_, TerminalManager>,
) -> Result<CellGrid, String> {
    manager.get_state(&id)
}

/// Destroy a terminal instance, cleaning up the PTY and threads.
#[tauri::command]
pub fn destroy_terminal(id: String, manager: State<'_, TerminalManager>) -> Result<(), String> {
    manager.remove(&id)
}
