use serde_json::{json, Map, Value};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::RwLock;

const CONFIG_DIR_NAME: &str = ".knkode";
const WORKSPACES_FILE: &str = "workspaces.json";
const APP_STATE_FILE: &str = "app-state.json";
const SNIPPETS_FILE: &str = "snippets.json";

// Theme defaults — must match src/shared/types.ts exports
const DEFAULT_UNFOCUSED_DIM: f64 = 0.3;
const DEFAULT_BACKGROUND: &str = "#1e1e1e";
const DEFAULT_FOREGROUND: &str = "#e0e0e0";
const DEFAULT_FONT_SIZE: f64 = 14.0;

// Validation ranges — must match src/shared/types.ts constants
const MAX_UNFOCUSED_DIM: f64 = 0.9;
const MIN_FONT_SIZE: f64 = 8.0;
const MAX_FONT_SIZE: f64 = 32.0;
const MIN_SCROLLBACK: f64 = 500.0;
const MAX_SCROLLBACK: f64 = 50000.0;
const MIN_PANE_OPACITY: f64 = 0.05;
const MIN_LINE_HEIGHT: f64 = 1.0;
const MAX_LINE_HEIGHT: f64 = 2.0;

/// Maximum dim value produced by opacity→unfocusedDim migration.
/// Lower than MAX_UNFOCUSED_DIM because legacy opacity 0.3 (minimum visible)
/// maps to dim 0.7, and values above that were never used in v1.
const MAX_MIGRATED_DIM: f64 = 0.7;

// Allowed enum values — must match src/shared/types.ts CURSOR_STYLES and EFFECT_LEVELS
const CURSOR_STYLES: &[&str] = &["block", "underline", "bar"];
const EFFECT_LEVELS: &[&str] = &["off", "subtle", "medium", "intense"];

// Must match AnsiColors interface in src/shared/types.ts and
// AnsiThemeColors struct in terminal.rs. Keep all three in sync.
const ANSI_KEYS: &[&str] = &[
    "black",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "white",
    "brightBlack",
    "brightRed",
    "brightGreen",
    "brightYellow",
    "brightBlue",
    "brightMagenta",
    "brightCyan",
    "brightWhite",
];

/// Maximum length for string fields to prevent injection or abuse.
const MAX_STRING_FIELD_LEN: usize = 128;

pub fn home_dir() -> Result<PathBuf, String> {
    dirs::home_dir().ok_or_else(|| "Cannot determine home directory".to_string())
}

/// Validate a hex color string: `#RGB` or `#RRGGBB` only.
/// Does not accept 8-digit `#RRGGBBAA` (CSS4) — not used in the theme system.
fn is_hex_color(s: &str) -> bool {
    let bytes = s.as_bytes();
    if bytes.first() != Some(&b'#') {
        return false;
    }
    let hex = &bytes[1..];
    (hex.len() == 3 || hex.len() == 6) && hex.iter().all(|b| b.is_ascii_hexdigit())
}

fn is_effect_level(v: &Value) -> bool {
    v.as_str().is_some_and(|s| EFFECT_LEVELS.contains(&s))
}

/// Set Unix file permissions. No-op on non-Unix platforms.
#[cfg(unix)]
fn set_unix_permissions(path: &Path, mode: u32) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let perms = fs::Permissions::from_mode(mode);
    fs::set_permissions(path, perms)
        .map_err(|e| format!("Failed to set permissions on {}: {e}", path.display()))
}

/// Migrate workspace themes from legacy `opacity` field to `unfocusedDim`.
/// Converts opacity (any finite float; historically 0.3-1.0) to unfocusedDim
/// via `(1.0 - opacity).clamp(0.0, MAX_MIGRATED_DIM)`.
/// Missing values default to DEFAULT_UNFOCUSED_DIM.
fn migrate_theme(mut ws: Value) -> Value {
    let theme = match ws.get_mut("theme").and_then(|t| t.as_object_mut()) {
        Some(t) => t,
        None => {
            // Invalid or missing theme — replace with defaults
            if let Some(obj) = ws.as_object_mut() {
                obj.insert("theme".to_string(), default_theme());
            }
            return ws;
        }
    };

    // Already migrated
    if theme.contains_key("unfocusedDim") {
        return ws;
    }

    // Convert legacy opacity to unfocusedDim
    let dim = theme
        .get("opacity")
        .and_then(|v| v.as_f64())
        .filter(|o| o.is_finite())
        .map(|o| (1.0 - o).clamp(0.0, MAX_MIGRATED_DIM))
        .unwrap_or(DEFAULT_UNFOCUSED_DIM);

    theme.remove("opacity");
    theme.insert("unfocusedDim".to_string(), json!(dim));
    ws
}

/// Migrate legacy boolean effect fields to EffectLevel strings.
/// Converts `animatedGlow: true` → `glowLevel: "medium"`,
/// `scanline: true` → `scanlineLevel: "medium"`. Boolean `false` values
/// are removed without adding a level field. Also adds
/// `gradientLevel: "medium"` when gradient string exists without level.
fn migrate_effect_levels(mut ws: Value) -> Value {
    let theme = match ws.get_mut("theme").and_then(|t| t.as_object_mut()) {
        Some(t) => t,
        None => return ws,
    };

    // Migrate boolean fields to EffectLevel strings
    for (old_key, new_key) in [("animatedGlow", "glowLevel"), ("scanline", "scanlineLevel")] {
        if theme.contains_key(old_key) {
            if theme.get(old_key).and_then(|v| v.as_bool()) == Some(true)
                && !is_effect_level(theme.get(new_key).unwrap_or(&Value::Null))
            {
                theme.insert(new_key.to_string(), json!("medium"));
            }
            theme.remove(old_key);
        }
    }

    // Add gradientLevel when gradient exists without a level
    if theme.get("gradient").is_some_and(|v| v.is_string()) && !theme.contains_key("gradientLevel")
    {
        theme.insert("gradientLevel".to_string(), json!("medium"));
    }

    ws
}

/// Validate and sanitize workspace theme fields loaded from disk (TypeScript PaneTheme interface).
/// Required fields (background, foreground, fontSize, unfocusedDim) fall back to compile-time
/// defaults if missing or invalid. Optional fields are silently dropped if invalid.
/// Config files may be hand-edited, so we strip invalid values rather than rejecting.
fn sanitize_theme(raw: &Value) -> Value {
    let obj = match raw.as_object() {
        Some(o) => o,
        None => return default_theme(),
    };

    let mut result = Map::new();

    // Required fields with defaults
    let bg = obj
        .get("background")
        .and_then(|v| v.as_str())
        .filter(|s| is_hex_color(s))
        .unwrap_or(DEFAULT_BACKGROUND);
    result.insert("background".to_string(), Value::String(bg.to_string()));

    let fg = obj
        .get("foreground")
        .and_then(|v| v.as_str())
        .filter(|s| is_hex_color(s))
        .unwrap_or(DEFAULT_FOREGROUND);
    result.insert("foreground".to_string(), Value::String(fg.to_string()));

    let font_size = obj
        .get("fontSize")
        .and_then(|v| v.as_f64())
        .filter(|n| n.is_finite() && *n >= MIN_FONT_SIZE && *n <= MAX_FONT_SIZE)
        .unwrap_or(DEFAULT_FONT_SIZE);
    result.insert("fontSize".to_string(), json!(font_size));

    let dim = obj
        .get("unfocusedDim")
        .and_then(|v| v.as_f64())
        .filter(|n| n.is_finite())
        .map(|n| n.clamp(0.0, MAX_UNFOCUSED_DIM))
        .unwrap_or(DEFAULT_UNFOCUSED_DIM);
    result.insert("unfocusedDim".to_string(), json!(dim));

    // Optional hex color fields
    for field in ["accent", "glow", "cursorColor", "selectionColor"] {
        if let Some(s) = obj.get(field).and_then(|v| v.as_str()) {
            if is_hex_color(s) {
                result.insert(field.to_string(), Value::String(s.to_string()));
            }
        }
    }

    // fontFamily: reject empty, overly long, or strings containing CSS-injection chars (; { })
    if let Some(s) = obj.get("fontFamily").and_then(|v| v.as_str()) {
        if !s.is_empty() && s.len() < MAX_STRING_FIELD_LEN && !s.contains([';', '{', '}']) {
            result.insert("fontFamily".to_string(), Value::String(s.to_string()));
        }
    }

    // Optional non-empty strings with length limit
    for field in ["gradient", "preset"] {
        if let Some(s) = obj.get(field).and_then(|v| v.as_str()) {
            if !s.is_empty() && s.len() < MAX_STRING_FIELD_LEN {
                result.insert(field.to_string(), Value::String(s.to_string()));
            }
        }
    }

    // statusBarPosition
    if let Some(s) = obj.get("statusBarPosition").and_then(|v| v.as_str()) {
        if s == "top" || s == "bottom" {
            result.insert(
                "statusBarPosition".to_string(),
                Value::String(s.to_string()),
            );
        }
    }

    // Numeric fields with per-field range validation (ranges match src/shared/types.ts)
    if let Some(n) = obj.get("scrollback").and_then(|v| v.as_f64()) {
        if n.is_finite() {
            result.insert(
                "scrollback".to_string(),
                json!(n.clamp(MIN_SCROLLBACK, MAX_SCROLLBACK)),
            );
        }
    }
    if let Some(n) = obj.get("paneOpacity").and_then(|v| v.as_f64()) {
        if n.is_finite() {
            result.insert(
                "paneOpacity".to_string(),
                json!(n.clamp(MIN_PANE_OPACITY, 1.0)),
            );
        }
    }
    if let Some(n) = obj.get("lineHeight").and_then(|v| v.as_f64()) {
        if n.is_finite() {
            result.insert(
                "lineHeight".to_string(),
                json!(n.clamp(MIN_LINE_HEIGHT, MAX_LINE_HEIGHT)),
            );
        }
    }

    // CursorStyle
    if let Some(s) = obj.get("cursorStyle").and_then(|v| v.as_str()) {
        if CURSOR_STYLES.contains(&s) {
            result.insert("cursorStyle".to_string(), Value::String(s.to_string()));
        }
    }

    // EffectLevel fields (scrollbarAccent also uses EffectLevel type per TS types)
    for field in [
        "gradientLevel",
        "glowLevel",
        "scanlineLevel",
        "noiseLevel",
        "scrollbarAccent",
    ] {
        if let Some(v) = obj.get(field) {
            if is_effect_level(v) {
                result.insert(field.to_string(), v.clone());
            }
        }
    }

    // AnsiColors — all 16 fields must be valid hex or the entire block is dropped
    if let Some(ac) = obj.get("ansiColors").and_then(|v| v.as_object()) {
        let all_valid = ANSI_KEYS.iter().all(|k| {
            ac.get(*k)
                .and_then(|v| v.as_str())
                .is_some_and(is_hex_color)
        });
        if all_valid {
            result.insert("ansiColors".to_string(), Value::Object(ac.clone()));
        }
    }

    Value::Object(result)
}

fn default_theme() -> Value {
    json!({
        "background": DEFAULT_BACKGROUND,
        "foreground": DEFAULT_FOREGROUND,
        "fontSize": DEFAULT_FONT_SIZE,
        "unfocusedDim": DEFAULT_UNFOCUSED_DIM,
    })
}

/// Ensure workspace has a valid `snippets` array. Backfills missing field,
/// validates existing entries (dropping invalid ones with a warning), and
/// resets non-array values to `[]`.
fn backfill_snippets(mut ws: Value) -> Value {
    if let Some(obj) = ws.as_object_mut() {
        if !obj.contains_key("snippets") {
            obj.insert("snippets".to_string(), json!([]));
        } else if let Some(arr) = obj.get("snippets").and_then(|v| v.as_array()) {
            // Validate existing snippets — drop invalid entries
            let valid: Vec<Value> = arr
                .iter()
                .filter(|s| is_valid_snippet(s))
                .cloned()
                .collect();
            let dropped = arr.len() - valid.len();
            if dropped > 0 {
                eprintln!(
                    "[config-store] Filtered {dropped} invalid workspace snippet(s) during migration"
                );
                obj.insert("snippets".to_string(), Value::Array(valid));
            }
        } else {
            // snippets field exists but isn't an array — reset to empty
            eprintln!(
                "[config-store] Workspace snippets field is not an array — resetting to empty"
            );
            obj.insert("snippets".to_string(), json!([]));
        }
    }
    ws
}

/// Apply migrations and sanitization to a workspace loaded from disk.
fn migrate_workspace(ws: Value) -> Value {
    let ws = migrate_theme(ws);
    let mut ws = migrate_effect_levels(ws);

    // Replace the theme with a sanitized copy
    if let Some(obj) = ws.as_object_mut() {
        if let Some(theme) = obj.get("theme") {
            let sanitized = sanitize_theme(theme);
            obj.insert("theme".to_string(), sanitized);
        }
    }

    backfill_snippets(ws)
}

/// Validate a snippet: must have non-empty string id, name, command.
fn is_valid_snippet(v: &Value) -> bool {
    let obj = match v.as_object() {
        Some(o) => o,
        None => return false,
    };
    let has_field = |key: &str| -> bool {
        obj.get(key)
            .and_then(|v| v.as_str())
            .is_some_and(|s| !s.is_empty())
    };
    has_field("id") && has_field("name") && has_field("command")
}

pub struct ConfigStore {
    dir: PathBuf,
    /// Guards all file I/O to prevent concurrent read/write corruption.
    /// Note: protects against in-process concurrency only, not external processes.
    lock: RwLock<()>,
}

impl ConfigStore {
    pub fn new() -> Result<Self, String> {
        let dir = home_dir()?.join(CONFIG_DIR_NAME);
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config dir: {e}"))?;
        #[cfg(unix)]
        set_unix_permissions(&dir, 0o700)?;
        Ok(Self {
            dir,
            lock: RwLock::new(()),
        })
    }

    // --- Workspaces ---

    pub fn get_workspaces(&self) -> Result<Vec<Value>, String> {
        let _guard = self.acquire_read()?;
        let workspaces = self.read_json_array(&self.path(WORKSPACES_FILE))?;
        Ok(workspaces.into_iter().map(migrate_workspace).collect())
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

    /// Merge the provided object into app-state.json (read-modify-write under write lock).
    /// Frontend-originated saves go through this path to avoid clobbering backend-written fields.
    pub fn save_app_state(&self, state: Value) -> Result<(), String> {
        let incoming = match state {
            Value::Object(obj) => obj,
            _ => return Err("Expected JSON object for app state".to_string()),
        };
        let _guard = self.acquire_write()?;
        let path = self.path(APP_STATE_FILE);
        let mut current = match self.read_file(&path)? {
            Some(Value::Object(obj)) => obj,
            Some(_) => return Err(format!("Expected JSON object in {}", path.display())),
            None => serde_json::Map::new(),
        };
        // Merge incoming fields into existing state
        for (k, v) in incoming {
            current.insert(k, v);
        }
        self.write_json_atomic(&path, &Value::Object(current))
    }

    /// Update a single top-level field in app-state.json (read-modify-write under write lock).
    pub fn update_app_state_field(&self, key: &str, value: Value) -> Result<(), String> {
        let _guard = self.acquire_write()?;
        let path = self.path(APP_STATE_FILE);
        let mut state = match self.read_file(&path)? {
            Some(Value::Object(obj)) => obj,
            Some(_) => return Err(format!("Expected JSON object in {}", path.display())),
            None => serde_json::Map::new(),
        };
        state.insert(key.to_string(), value);
        self.write_json_atomic(&path, &Value::Object(state))
    }

    // --- Snippets ---

    pub fn get_snippets(&self) -> Result<Vec<Value>, String> {
        let _guard = self.acquire_read()?;
        let snippets = self.read_json_array(&self.path(SNIPPETS_FILE))?;
        let total = snippets.len();
        let valid: Vec<Value> = snippets.into_iter().filter(is_valid_snippet).collect();
        let dropped = total - valid.len();
        if dropped > 0 {
            eprintln!("[config-store] Filtered {dropped} invalid snippet(s) from {SNIPPETS_FILE}");
        }
        Ok(valid)
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
                let backup_path = PathBuf::from(&backup);
                if let Err(copy_err) = fs::copy(path, &backup_path) {
                    eprintln!("[config-store] Failed to backup corrupt file: {copy_err}");
                } else {
                    // Set 0o600 on backup file to match config file permissions
                    #[cfg(unix)]
                    if let Err(e) = set_unix_permissions(&backup_path, 0o600) {
                        eprintln!("[config-store] {e}");
                    }
                }
                Ok(None)
            }
        }
    }

    /// Read a JSON array from disk. Returns empty array if file doesn't exist or contains corrupt JSON.
    fn read_json_array(&self, path: &Path) -> Result<Vec<Value>, String> {
        match self.read_file(path)? {
            Some(Value::Array(arr)) => Ok(arr),
            Some(_) => Err(format!("Expected JSON array in {}", path.display())),
            None => Ok(vec![]),
        }
    }

    /// Read a JSON object from disk. Returns empty object if file doesn't exist or contains corrupt JSON.
    fn read_json_object(&self, path: &Path) -> Result<Value, String> {
        match self.read_file(path)? {
            Some(val @ Value::Object(_)) => Ok(val),
            Some(_) => Err(format!("Expected JSON object in {}", path.display())),
            None => Ok(Value::Object(Default::default())),
        }
    }

    /// Write JSON to a sibling temp file (`{path}.tmp`) then rename for atomicity.
    fn write_json_atomic(&self, path: &Path, value: &Value) -> Result<(), String> {
        let mut tmp_os = path.as_os_str().to_owned();
        tmp_os.push(".tmp");
        let tmp_path = PathBuf::from(tmp_os);

        let content = serde_json::to_string_pretty(value)
            .map_err(|e| format!("Failed to serialize JSON: {e}"))?;
        fs::write(&tmp_path, content)
            .map_err(|e| format!("Failed to write {}: {e}", tmp_path.display()))?;

        // Set permissions on temp file before rename to avoid a world-readable window
        #[cfg(unix)]
        if let Err(e) = set_unix_permissions(&tmp_path, 0o600) {
            eprintln!("[config-store] {e}");
        }

        fs::rename(&tmp_path, path).map_err(|e| {
            let _ = fs::remove_file(&tmp_path);
            format!(
                "Failed to rename {} -> {}: {e}",
                tmp_path.display(),
                path.display()
            )
        })?;
        Ok(())
    }
}
