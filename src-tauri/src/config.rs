use serde_json::Value;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::RwLock;

const CONFIG_DIR_NAME: &str = ".knkode";
const WORKSPACES_FILE: &str = "workspaces.json";
const APP_STATE_FILE: &str = "app-state.json";
const SNIPPETS_FILE: &str = "snippets.json";

/// Resolve the user's home directory.
pub fn home_dir() -> Result<PathBuf, String> {
    dirs::home_dir().ok_or_else(|| "Cannot determine home directory".to_string())
}

pub struct ConfigStore {
    dir: PathBuf,
    /// Guards all file I/O to prevent concurrent read/write corruption.
    lock: RwLock<()>,
}

impl ConfigStore {
    pub fn new() -> Result<Self, String> {
        let dir = home_dir()?.join(CONFIG_DIR_NAME);
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config dir: {e}"))?;
        Ok(Self {
            dir,
            lock: RwLock::new(()),
        })
    }

    // --- Workspaces ---

    pub fn get_workspaces(&self) -> Result<Vec<Value>, String> {
        let _guard = self.acquire_read()?;
        self.read_json_array(&self.path(WORKSPACES_FILE))
    }

    pub fn save_workspace(&self, workspace: Value) -> Result<(), String> {
        let _guard = self.acquire_write()?;
        let path = self.path(WORKSPACES_FILE);
        let mut workspaces = self.read_json_array(&path)?;

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
        let _guard = self.acquire_write()?;
        let path = self.path(WORKSPACES_FILE);
        let mut workspaces = self.read_json_array(&path)?;
        let original_len = workspaces.len();
        workspaces.retain(|w| w.get("id").and_then(|v| v.as_str()) != Some(id));
        if workspaces.len() == original_len {
            return Err(format!("Workspace '{id}' not found"));
        }
        self.write_json_atomic(&path, &Value::Array(workspaces))
    }

    // --- App State ---

    pub fn get_app_state(&self) -> Result<Value, String> {
        let _guard = self.acquire_read()?;
        self.read_json_object(&self.path(APP_STATE_FILE))
    }

    pub fn save_app_state(&self, state: Value) -> Result<(), String> {
        if !state.is_object() {
            return Err("Expected JSON object for app state".to_string());
        }
        let _guard = self.acquire_write()?;
        self.write_json_atomic(&self.path(APP_STATE_FILE), &state)
    }

    // --- Snippets ---

    pub fn get_snippets(&self) -> Result<Vec<Value>, String> {
        let _guard = self.acquire_read()?;
        self.read_json_array(&self.path(SNIPPETS_FILE))
    }

    pub fn save_snippets(&self, snippets: Vec<Value>) -> Result<(), String> {
        let _guard = self.acquire_write()?;
        self.write_json_atomic(&self.path(SNIPPETS_FILE), &Value::Array(snippets))
    }

    // --- Internal helpers ---

    fn path(&self, filename: &str) -> PathBuf {
        self.dir.join(filename)
    }

    fn acquire_read(&self) -> Result<std::sync::RwLockReadGuard<'_, ()>, String> {
        self.lock
            .read()
            .map_err(|e| format!("Config lock poisoned: {e}"))
    }

    fn acquire_write(&self) -> Result<std::sync::RwLockWriteGuard<'_, ()>, String> {
        self.lock
            .write()
            .map_err(|e| format!("Config lock poisoned: {e}"))
    }

    /// Read and parse a JSON file, returning `None` on NotFound.
    /// On corrupt JSON, backs up the file to `{path}.corrupt` and returns `None`.
    fn read_file(&self, path: &Path) -> Result<Option<Value>, String> {
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(format!("Failed to read {}: {e}", path.display())),
        };

        match serde_json::from_str(&content) {
            Ok(parsed) => Ok(Some(parsed)),
            Err(e) => {
                eprintln!(
                    "[config-store] Corrupt JSON in {}, backing up: {e}",
                    path.display()
                );
                let mut backup = path.as_os_str().to_owned();
                backup.push(".corrupt");
                if let Err(copy_err) = fs::copy(path, &backup) {
                    eprintln!("[config-store] Failed to backup corrupt file: {copy_err}");
                }
                Ok(None)
            }
        }
    }

    /// Read a JSON array from disk. Returns empty array if file doesn't exist.
    fn read_json_array(&self, path: &Path) -> Result<Vec<Value>, String> {
        match self.read_file(path)? {
            Some(Value::Array(arr)) => Ok(arr),
            Some(_) => Err(format!("Expected JSON array in {}", path.display())),
            None => Ok(vec![]),
        }
    }

    /// Read a JSON object from disk. Returns empty object if file doesn't exist.
    fn read_json_object(&self, path: &Path) -> Result<Value, String> {
        match self.read_file(path)? {
            Some(val @ Value::Object(_)) => Ok(val),
            Some(_) => Err(format!("Expected JSON object in {}", path.display())),
            None => Ok(Value::Object(Default::default())),
        }
    }

    /// Write JSON to a temp file then rename for atomicity.
    fn write_json_atomic(&self, path: &Path, value: &Value) -> Result<(), String> {
        let mut tmp_os = path.as_os_str().to_owned();
        tmp_os.push(".tmp");
        let tmp_path = PathBuf::from(tmp_os);

        let content = serde_json::to_string_pretty(value)
            .map_err(|e| format!("Failed to serialize JSON: {e}"))?;
        fs::write(&tmp_path, content)
            .map_err(|e| format!("Failed to write {}: {e}", tmp_path.display()))?;
        fs::rename(&tmp_path, path).map_err(|e| {
            let _ = fs::remove_file(&tmp_path);
            format!(
                "Failed to rename {} -> {}: {e}",
                tmp_path.display(),
                path.display()
            )
        })
    }
}
