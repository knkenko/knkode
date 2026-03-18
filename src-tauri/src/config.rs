use serde_json::Value;
use std::fs;
use std::io;
use std::path::PathBuf;
use std::sync::Mutex;

const CONFIG_DIR_NAME: &str = ".knkode";
const WORKSPACES_FILE: &str = "workspaces.json";
const APP_STATE_FILE: &str = "app-state.json";
const SNIPPETS_FILE: &str = "snippets.json";

pub struct ConfigStore {
    dir: PathBuf,
    /// Guards all file I/O to prevent concurrent read/write corruption.
    lock: Mutex<()>,
}

impl ConfigStore {
    pub fn new() -> Result<Self, String> {
        let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
        let dir = home.join(CONFIG_DIR_NAME);
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config dir: {e}"))?;
        Ok(Self {
            dir,
            lock: Mutex::new(()),
        })
    }

    // --- Workspaces ---

    pub fn get_workspaces(&self) -> Result<Vec<Value>, String> {
        let _guard = self.lock.lock().map_err(|e| e.to_string())?;
        self.read_json_array(&self.path(WORKSPACES_FILE))
    }

    pub fn save_workspace(&self, workspace: Value) -> Result<(), String> {
        let _guard = self.lock.lock().map_err(|e| e.to_string())?;
        let path = self.path(WORKSPACES_FILE);
        let mut workspaces = self.read_json_array_unlocked(&path)?;

        let id = workspace
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or("Workspace missing 'id' field")?
            .to_string();

        if let Some(pos) = workspaces
            .iter()
            .position(|w| w.get("id").and_then(|v| v.as_str()) == Some(&id))
        {
            workspaces[pos] = workspace;
        } else {
            workspaces.push(workspace);
        }

        self.write_json_atomic(&path, &Value::Array(workspaces))
    }

    pub fn delete_workspace(&self, id: &str) -> Result<(), String> {
        let _guard = self.lock.lock().map_err(|e| e.to_string())?;
        let path = self.path(WORKSPACES_FILE);
        let mut workspaces = self.read_json_array_unlocked(&path)?;
        workspaces.retain(|w| w.get("id").and_then(|v| v.as_str()) != Some(id));
        self.write_json_atomic(&path, &Value::Array(workspaces))
    }

    // --- App State ---

    pub fn get_app_state(&self) -> Result<Value, String> {
        let _guard = self.lock.lock().map_err(|e| e.to_string())?;
        self.read_json_object(&self.path(APP_STATE_FILE))
    }

    pub fn save_app_state(&self, state: Value) -> Result<(), String> {
        let _guard = self.lock.lock().map_err(|e| e.to_string())?;
        self.write_json_atomic(&self.path(APP_STATE_FILE), &state)
    }

    // --- Snippets ---

    pub fn get_snippets(&self) -> Result<Vec<Value>, String> {
        let _guard = self.lock.lock().map_err(|e| e.to_string())?;
        self.read_json_array(&self.path(SNIPPETS_FILE))
    }

    pub fn save_snippets(&self, snippets: Vec<Value>) -> Result<(), String> {
        let _guard = self.lock.lock().map_err(|e| e.to_string())?;
        self.write_json_atomic(&self.path(SNIPPETS_FILE), &Value::Array(snippets))
    }

    // --- Internal helpers ---

    fn path(&self, filename: &str) -> PathBuf {
        self.dir.join(filename)
    }

    /// Read a JSON array from disk. Returns empty array if file doesn't exist.
    fn read_json_array(&self, path: &PathBuf) -> Result<Vec<Value>, String> {
        self.read_json_array_unlocked(path)
    }

    /// Same as read_json_array but doesn't acquire the lock (caller must hold it).
    fn read_json_array_unlocked(&self, path: &PathBuf) -> Result<Vec<Value>, String> {
        match fs::read_to_string(path) {
            Ok(content) => {
                let parsed: Value = serde_json::from_str(&content)
                    .map_err(|e| format!("Invalid JSON in {}: {e}", path.display()))?;
                match parsed {
                    Value::Array(arr) => Ok(arr),
                    _ => Err(format!("Expected JSON array in {}", path.display())),
                }
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(vec![]),
            Err(e) => Err(format!("Failed to read {}: {e}", path.display())),
        }
    }

    /// Read a JSON object from disk. Returns empty object if file doesn't exist.
    fn read_json_object(&self, path: &PathBuf) -> Result<Value, String> {
        match fs::read_to_string(path) {
            Ok(content) => serde_json::from_str(&content)
                .map_err(|e| format!("Invalid JSON in {}: {e}", path.display())),
            Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(Value::Object(Default::default())),
            Err(e) => Err(format!("Failed to read {}: {e}", path.display())),
        }
    }

    /// Write JSON to a .tmp file then rename for atomicity.
    fn write_json_atomic(&self, path: &PathBuf, value: &Value) -> Result<(), String> {
        let tmp_path = path.with_extension("tmp");
        let content = serde_json::to_string_pretty(value)
            .map_err(|e| format!("Failed to serialize JSON: {e}"))?;
        fs::write(&tmp_path, content)
            .map_err(|e| format!("Failed to write {}: {e}", tmp_path.display()))?;
        fs::rename(&tmp_path, path).map_err(|e| {
            format!(
                "Failed to rename {} -> {}: {e}",
                tmp_path.display(),
                path.display()
            )
        })
    }
}
