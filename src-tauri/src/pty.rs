const PTY_NOT_IMPLEMENTED: &str = "PTY not implemented yet";

/// Stub PTY manager. Real portable-pty implementation comes later.
#[derive(Default)]
pub struct PtyManager;

impl PtyManager {
    pub fn new() -> Self {
        Self
    }

    pub fn create(
        &self,
        _id: String,
        _cwd: String,
        _startup_command: Option<String>,
        _app: tauri::AppHandle,
    ) -> Result<(), String> {
        Err(PTY_NOT_IMPLEMENTED.to_string())
    }

    pub fn write(&self, _id: &str, _data: &str) -> Result<(), String> {
        Err(PTY_NOT_IMPLEMENTED.to_string())
    }

    pub fn resize(&self, _id: &str, _cols: u16, _rows: u16) -> Result<(), String> {
        Err(PTY_NOT_IMPLEMENTED.to_string())
    }

    pub fn kill(&self, _id: &str) -> Result<(), String> {
        Err(PTY_NOT_IMPLEMENTED.to_string())
    }
}
