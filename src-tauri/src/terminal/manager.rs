use std::collections::HashMap;
use std::sync::Mutex;
use tauri::AppHandle;

use crate::terminal::instance::TerminalInstance;
use crate::terminal::types::CellGrid;

/// Manages all active terminal instances.
pub struct TerminalManager {
    terminals: Mutex<HashMap<String, TerminalInstance>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            terminals: Mutex::new(HashMap::new()),
        }
    }

    pub fn create(&self, app_handle: AppHandle) -> Result<String, String> {
        let id = uuid::Uuid::new_v4().to_string();
        let instance =
            TerminalInstance::spawn(id.clone(), app_handle).map_err(|e| e.to_string())?;

        let mut terminals = self.terminals.lock().map_err(|e| e.to_string())?;
        terminals.insert(id.clone(), instance);
        Ok(id)
    }

    pub fn write(&self, id: &str, data: &[u8]) -> Result<(), String> {
        let terminals = self.terminals.lock().map_err(|e| e.to_string())?;
        let instance = terminals.get(id).ok_or("Terminal not found")?;
        instance.write(data);
        Ok(())
    }

    pub fn resize(&self, id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let mut terminals = self.terminals.lock().map_err(|e| e.to_string())?;
        let instance = terminals.get_mut(id).ok_or("Terminal not found")?;
        instance.resize(cols, rows);
        Ok(())
    }

    pub fn get_state(&self, id: &str) -> Result<CellGrid, String> {
        let terminals = self.terminals.lock().map_err(|e| e.to_string())?;
        let instance = terminals.get(id).ok_or("Terminal not found")?;
        Ok(instance.get_state())
    }

    pub fn remove(&self, id: &str) -> Result<(), String> {
        let mut terminals = self.terminals.lock().map_err(|e| e.to_string())?;
        terminals.remove(id);
        Ok(())
    }
}
