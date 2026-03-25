//! Scan local session history files for CLI coding agents (Claude Code, Gemini CLI, Codex CLI).
//!
//! Each agent stores sessions in a different format and directory structure.
//! This module detects which agents are installed, reads session metadata
//! (without loading full conversation content), and returns a unified list
//! sorted by timestamp descending.

use serde::Serialize;
use std::path::Path;

/// Maximum number of sessions returned by [`list_sessions`].
const MAX_SESSIONS: usize = 50;

/// Maximum bytes in a session summary before truncation.
const MAX_SUMMARY_LEN: usize = 120;

/// Maximum JSONL lines to read when extracting metadata from a session file.
const MAX_LINES_TO_READ: usize = 15;

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AgentKind {
    Claude,
    Gemini,
    Codex,
}

impl std::fmt::Display for AgentKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Claude => write!(f, "Claude"),
            Self::Gemini => write!(f, "Gemini"),
            Self::Codex => write!(f, "Codex"),
        }
    }
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AgentSession {
    pub id: String,
    pub agent: AgentKind,
    /// ISO 8601 timestamp of the session start.
    pub timestamp: String,
    /// ISO 8601 timestamp of the last activity in the session.
    pub last_updated: Option<String>,
    /// Custom session title (Claude `/rename`, Gemini AI summary, Codex thread name).
    pub title: Option<String>,
    /// First user prompt (truncated).
    pub summary: Option<String>,
    /// Git branch active when the session started.
    pub branch: Option<String>,
    /// Working directory of the session.
    pub cwd: Option<String>,
}

/// List agent sessions matching `project_cwd`, sorted by last activity descending.
pub fn list_sessions(project_cwd: &str) -> Vec<AgentSession> {
    let agents = detect_installed_agents();
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => {
            eprintln!("[session_scanner] home_dir() returned None — cannot scan sessions");
            return Vec::new();
        }
    };

    let mut sessions = Vec::new();

    for agent in agents {
        match agent {
            AgentKind::Claude => scan_claude(&home, project_cwd, &mut sessions),
            AgentKind::Gemini => scan_gemini(&home, project_cwd, &mut sessions),
            AgentKind::Codex => scan_codex(&home, project_cwd, &mut sessions),
        }
    }

    // Sort by last activity (fall back to session start if no last_updated).
    // Lexicographic compare works because all values are ISO 8601.
    sessions.sort_by(|a, b| {
        let a_time = a.last_updated.as_deref().unwrap_or(&a.timestamp);
        let b_time = b.last_updated.as_deref().unwrap_or(&b.timestamp);
        b_time.cmp(a_time)
    });
    sessions.truncate(MAX_SESSIONS);
    sessions
}

// ---------------------------------------------------------------------------
// Agent detection
// ---------------------------------------------------------------------------

fn detect_installed_agents() -> Vec<AgentKind> {
    let mut agents = Vec::new();
    for (name, kind) in [
        ("claude", AgentKind::Claude),
        ("gemini", AgentKind::Gemini),
        ("codex", AgentKind::Codex),
    ] {
        if is_command_available(name) {
            agents.push(kind);
        }
    }
    agents
}

fn is_command_available(name: &str) -> bool {
    let augmented_path = crate::tracker::build_augmented_path();

    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("where")
        .arg(name)
        .env("PATH", &augmented_path)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();
    #[cfg(not(target_os = "windows"))]
    let result = std::process::Command::new("which")
        .arg(name)
        .env("PATH", &augmented_path)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();

    result.map(|s| s.success()).unwrap_or(false)
}

// ---------------------------------------------------------------------------
// Claude Code — ~/.claude/projects/<cwd-slug>/<uuid>.jsonl
// ---------------------------------------------------------------------------

fn scan_claude(home: &Path, project_cwd: &str, out: &mut Vec<AgentSession>) {
    let dir_name = cwd_to_claude_dir_name(project_cwd);
    let sessions_dir = home.join(".claude").join("projects").join(&dir_name);

    if !sessions_dir.is_dir() {
        return;
    }

    let entries = match std::fs::read_dir(&sessions_dir) {
        Ok(e) => e,
        Err(e) => {
            eprintln!(
                "[session_scanner] Failed to read Claude sessions dir {}: {e}",
                sessions_dir.display()
            );
            return;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().is_none_or(|e| e != "jsonl") || !path.is_file() {
            continue;
        }
        if let Some(session) = parse_claude_session(&path) {
            out.push(session);
        }
    }
}

/// Convert an absolute CWD path to Claude's project directory name format.
/// `/Users/sfory/dev/knkode` → `-Users-sfory-dev-knkode`
fn cwd_to_claude_dir_name(cwd: &str) -> String {
    cwd.replace(std::path::MAIN_SEPARATOR, "-")
        .replace('/', "-") // Normalize forward slashes on all platforms
}

fn parse_claude_session(path: &Path) -> Option<AgentSession> {
    use std::io::{BufRead, BufReader};

    let file = std::fs::File::open(path).ok()?;
    let reader = BufReader::new(file);

    let mut session_id: Option<String> = None;
    let mut timestamp: Option<String> = None;
    let mut branch: Option<String> = None;
    let mut cwd: Option<String> = None;
    let mut summary: Option<String> = None;

    // Pass 1: read first N lines for session metadata + first prompt
    for line in reader.lines().take(MAX_LINES_TO_READ) {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };
        let val: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let msg_type = val.get("type").and_then(|t| t.as_str());

        // First enqueue operation contains the user's prompt
        if msg_type == Some("queue-operation")
            && val.get("operation").and_then(|o| o.as_str()) == Some("enqueue")
            && summary.is_none()
        {
            summary = val
                .get("content")
                .and_then(|c| c.as_str())
                .and_then(extract_claude_prompt);
            session_id = session_id.or(val
                .get("sessionId")
                .and_then(|v| v.as_str())
                .map(String::from));
        }

        // First user message has session metadata
        if msg_type == Some("user") {
            session_id = session_id.or(val
                .get("sessionId")
                .and_then(|v| v.as_str())
                .map(String::from));
            timestamp = timestamp.or(val
                .get("timestamp")
                .and_then(|v| v.as_str())
                .map(String::from));
            branch = branch.or(val
                .get("gitBranch")
                .and_then(|v| v.as_str())
                .map(String::from));
            cwd = cwd.or(val.get("cwd").and_then(|v| v.as_str()).map(String::from));
            break;
        }
    }

    // Fall back to filename as session ID
    let id = session_id.or_else(|| path.file_stem()?.to_str().map(String::from))?;

    // Pass 2: read last TAIL_BYTES of the file for custom-title, last-prompt, last timestamp.
    // These metadata lines are appended at end of session, so a reverse scan is efficient.
    let (title, last_updated) = extract_claude_tail_metadata(path);

    Some(AgentSession {
        id,
        agent: AgentKind::Claude,
        timestamp: timestamp?,
        last_updated,
        title,
        summary: summary.map(|s| truncate_summary(&s)),
        branch,
        cwd,
    })
}

/// Bytes to read from the end of a Claude JSONL file for tail metadata.
const CLAUDE_TAIL_BYTES: u64 = 8 * 1024;

/// Extract custom-title and last timestamp from the tail of a Claude session file.
fn extract_claude_tail_metadata(path: &Path) -> (Option<String>, Option<String>) {
    use std::io::{Read, Seek, SeekFrom};

    let mut file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return (None, None),
    };
    let file_len = file.metadata().map(|m| m.len()).unwrap_or(0);

    // Seek to near the end (or start if file is small)
    let seek_pos = file_len.saturating_sub(CLAUDE_TAIL_BYTES);
    if file.seek(SeekFrom::Start(seek_pos)).is_err() {
        return (None, None);
    }

    let mut buf = String::new();
    if file.read_to_string(&mut buf).is_err() {
        return (None, None);
    }

    let mut title: Option<String> = None;
    let mut last_timestamp: Option<String> = None;

    // Process lines in reverse so the LAST custom-title wins
    for line in buf.lines().rev() {
        let val: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let msg_type = val.get("type").and_then(|t| t.as_str());

        // custom-title is set by /rename — last one wins
        if msg_type == Some("custom-title") && title.is_none() {
            title = val
                .get("customTitle")
                .and_then(|v| v.as_str())
                .map(String::from);
        }

        // Grab the latest timestamp from any message that has one
        if last_timestamp.is_none() {
            last_timestamp = val
                .get("timestamp")
                .and_then(|v| v.as_str())
                .map(String::from);
        }

        if title.is_some() && last_timestamp.is_some() {
            break;
        }
    }

    (title, last_timestamp)
}

/// Extract the user prompt from Claude's queue-operation content.
/// Format is typically `<number>\n<prompt>\n` — skip the leading number line.
fn extract_claude_prompt(content: &str) -> Option<String> {
    let lines: Vec<&str> = content.lines().filter(|l| !l.is_empty()).collect();
    if lines.is_empty() {
        return None;
    }
    // If first line is just a number (permission mode indicator), skip it
    if lines.len() > 1
        && !lines[0].trim().is_empty()
        && lines[0].trim().bytes().all(|b| b.is_ascii_digit())
    {
        Some(lines[1..].join(" "))
    } else {
        Some(lines.join(" "))
    }
}

// ---------------------------------------------------------------------------
// Gemini CLI — ~/.gemini/tmp/<project-name>/chats/session-*.json
// ---------------------------------------------------------------------------

/// Scan Gemini sessions. Note: Gemini CLI stores sessions by project directory
/// **name** only (not the full path), so two projects with the same directory
/// name at different paths will match each other's sessions.
fn scan_gemini(home: &Path, project_cwd: &str, out: &mut Vec<AgentSession>) {
    let project_name = match Path::new(project_cwd).file_name().and_then(|n| n.to_str()) {
        Some(name) if !name.is_empty() => name,
        _ => return,
    };

    let chats_dir = home
        .join(".gemini")
        .join("tmp")
        .join(project_name)
        .join("chats");

    if !chats_dir.is_dir() {
        return;
    }

    let entries = match std::fs::read_dir(&chats_dir) {
        Ok(e) => e,
        Err(e) => {
            eprintln!(
                "[session_scanner] Failed to read Gemini chats dir {}: {e}",
                chats_dir.display()
            );
            return;
        }
    };

    let mut gemini_sessions = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().is_none_or(|e| e != "json") || !path.is_file() {
            continue;
        }
        if let Some(session) = parse_gemini_session(&path) {
            gemini_sessions.push(session);
        }
    }

    // Gemini's --resume accepts a 1-based index, ordered by startTime ascending.
    // Sort and assign the index as the session ID for correct resume behavior.
    gemini_sessions.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
    for (i, session) in gemini_sessions.iter_mut().enumerate() {
        session.id = (i + 1).to_string();
    }

    out.extend(gemini_sessions);
}

/// Max file size (10 MB) for Gemini session JSON before skipping.
const MAX_GEMINI_FILE_SIZE: u64 = 10 * 1024 * 1024;

fn parse_gemini_session(path: &Path) -> Option<AgentSession> {
    // Guard against oversized files — Gemini sessions can contain full conversations
    if let Ok(meta) = std::fs::metadata(path) {
        if meta.len() > MAX_GEMINI_FILE_SIZE {
            eprintln!(
                "[session_scanner] Skipping oversized Gemini session file ({} bytes): {}",
                meta.len(),
                path.display()
            );
            return None;
        }
    }
    let content = std::fs::read_to_string(path).ok()?;
    let val: serde_json::Value = serde_json::from_str(&content).ok()?;

    let id = val.get("sessionId").and_then(|v| v.as_str())?.to_string();
    let timestamp = val.get("startTime").and_then(|v| v.as_str())?.to_string();

    // AI-generated session summary (e.g. "Redesign sidebar visuals and theme them.")
    let title = val
        .get("summary")
        .and_then(|v| v.as_str())
        .map(String::from);

    let last_updated = val
        .get("lastUpdated")
        .and_then(|v| v.as_str())
        .map(String::from);

    // Extract first user message as fallback summary
    let summary = val
        .get("messages")
        .and_then(|m| m.as_array())
        .and_then(|arr| {
            arr.iter().find_map(|msg| {
                let role = msg
                    .get("role")
                    .and_then(|r| r.as_str())
                    .or_else(|| msg.get("type").and_then(|t| t.as_str()));
                if role != Some("user") {
                    return None;
                }
                // Try Gemini's parts[].text format, then plain content
                msg.get("parts")
                    .and_then(|p| p.as_array())
                    .and_then(|parts| {
                        parts.iter().find_map(|part| {
                            part.get("text").and_then(|t| t.as_str()).map(String::from)
                        })
                    })
                    .or_else(|| {
                        msg.get("content")
                            .and_then(|c| c.as_str())
                            .map(String::from)
                    })
            })
        });

    Some(AgentSession {
        id,
        agent: AgentKind::Gemini,
        timestamp,
        last_updated,
        title,
        summary: summary.map(|s| truncate_summary(&s)),
        branch: None,
        cwd: None,
    })
}

// ---------------------------------------------------------------------------
// Codex CLI — reads from ~/.codex/state_5.sqlite (threads table)
// Falls back to JSONL scanning if sqlite3 is unavailable.
// ---------------------------------------------------------------------------

fn scan_codex(home: &Path, project_cwd: &str, out: &mut Vec<AgentSession>) {
    // Try SQLite first — much faster and gives us title + updated_at
    if scan_codex_sqlite(home, project_cwd, out) {
        return;
    }
    // Fallback: scan JSONL files
    let sessions_dir = home.join(".codex").join("sessions");
    if sessions_dir.is_dir() {
        walk_codex_dir(&sessions_dir, project_cwd, out, 0);
    }
}

/// Read Codex sessions from SQLite via the `sqlite3` CLI.
/// Returns true if successful, false if we should fall back to JSONL.
fn scan_codex_sqlite(home: &Path, project_cwd: &str, out: &mut Vec<AgentSession>) -> bool {
    let db_path = home.join(".codex").join("state_5.sqlite");
    if !db_path.is_file() {
        return false;
    }

    // Shell out to sqlite3 — ships on macOS/Linux, avoids rusqlite dependency.
    // Output format: id|title|cwd|git_branch|created_at|updated_at|first_user_message
    let result = std::process::Command::new("sqlite3")
        .arg("-separator")
        .arg("\t")
        .arg(db_path.as_os_str())
        .arg(format!(
            "SELECT id, title, cwd, git_branch, created_at, updated_at, first_user_message \
             FROM threads WHERE cwd = '{}' AND archived = 0 \
             ORDER BY updated_at DESC LIMIT {};",
            // Simple quote escaping for the CWD value
            project_cwd.replace('\'', "''"),
            MAX_SESSIONS,
        ))
        .output();

    let output = match result {
        Ok(o) if o.status.success() => o,
        Ok(o) => {
            eprintln!(
                "[session_scanner] sqlite3 failed (status {:?}): {}",
                o.status.code(),
                String::from_utf8_lossy(&o.stderr),
            );
            return false;
        }
        Err(e) => {
            // sqlite3 not found — fall back to JSONL
            eprintln!("[session_scanner] sqlite3 not available: {e}");
            return false;
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        let cols: Vec<&str> = line.split('\t').collect();
        if cols.len() < 7 {
            continue;
        }
        let id = cols[0].to_string();
        let title_raw = cols[1];
        let git_branch = if cols[3].is_empty() {
            None
        } else {
            Some(cols[3].to_string())
        };
        let created_at = cols[4].parse::<i64>().unwrap_or(0);
        let updated_at = cols[5].parse::<i64>().unwrap_or(0);
        let first_user_msg = cols[6];

        // Convert unix timestamps to ISO 8601
        let timestamp = unix_to_iso(created_at);
        let last_updated = if updated_at > 0 {
            Some(unix_to_iso(updated_at))
        } else {
            None
        };

        // Title: use thread title if it differs from first_user_message (i.e. was renamed)
        let title = if !title_raw.is_empty() {
            Some(truncate_summary(title_raw))
        } else {
            None
        };
        let summary = if !first_user_msg.is_empty() {
            Some(truncate_summary(first_user_msg))
        } else {
            None
        };

        out.push(AgentSession {
            id,
            agent: AgentKind::Codex,
            timestamp,
            last_updated,
            title,
            summary,
            branch: git_branch,
            cwd: Some(cols[2].to_string()),
        });
    }

    true
}

fn walk_codex_dir(dir: &Path, project_cwd: &str, out: &mut Vec<AgentSession>, depth: usize) {
    if depth > 4 {
        return;
    }
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) => {
            eprintln!(
                "[session_scanner] Failed to read Codex sessions dir {}: {e}",
                dir.display()
            );
            return;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk_codex_dir(&path, project_cwd, out, depth + 1);
        } else if path.extension().is_some_and(|e| e == "jsonl") && path.is_file() {
            if let Some(session) = parse_codex_session(&path, project_cwd) {
                out.push(session);
            }
        }
    }
}

fn parse_codex_session(path: &Path, project_cwd: &str) -> Option<AgentSession> {
    use std::io::{BufRead, BufReader};

    let file = std::fs::File::open(path).ok()?;
    let reader = BufReader::new(file);
    let mut lines = reader.lines();

    // First line must be session_meta
    let first_line = lines.next()?.ok()?;
    let val: serde_json::Value = serde_json::from_str(&first_line).ok()?;

    if val.get("type").and_then(|t| t.as_str()) != Some("session_meta") {
        return None;
    }

    let payload = val.get("payload")?;
    let id = payload.get("id").and_then(|v| v.as_str())?.to_string();
    let timestamp = payload
        .get("timestamp")
        .and_then(|v| v.as_str())?
        .to_string();
    let cwd = payload
        .get("cwd")
        .and_then(|v| v.as_str())
        .map(String::from);
    let branch = payload
        .get("git")
        .and_then(|g| g.get("branch"))
        .and_then(|b| b.as_str())
        .map(String::from);

    // Filter by CWD — exclude sessions with no CWD or mismatched CWD
    match cwd {
        Some(ref session_cwd) if session_cwd == project_cwd => {}
        _ => return None,
    }

    // Try to extract first user prompt from subsequent lines
    let mut summary: Option<String> = None;
    for line in lines.take(MAX_LINES_TO_READ) {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };
        let ev: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if ev.get("type").and_then(|t| t.as_str()) == Some("response_item") {
            if let Some(payload) = ev.get("payload") {
                let role = payload.get("role").and_then(|r| r.as_str());
                if role == Some("user") {
                    summary = payload
                        .get("content")
                        .and_then(|c| c.as_array())
                        .and_then(|arr| {
                            arr.iter().find_map(|item| {
                                if item.get("type").and_then(|t| t.as_str()) == Some("input_text") {
                                    item.get("text").and_then(|t| t.as_str()).map(String::from)
                                } else {
                                    None
                                }
                            })
                        });
                    if summary.is_some() {
                        break;
                    }
                }
            }
        }
    }

    Some(AgentSession {
        id,
        agent: AgentKind::Codex,
        timestamp,
        last_updated: None,
        title: None,
        summary: summary.map(|s| truncate_summary(&s)),
        branch,
        cwd,
    })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn truncate_summary(s: &str) -> String {
    let trimmed = s.trim();
    let truncated = crate::tracker::truncate_str(trimmed, MAX_SUMMARY_LEN);
    if truncated.len() < trimmed.len() {
        format!("{truncated}…")
    } else {
        truncated.to_string()
    }
}

/// Convert a Unix timestamp (seconds) to an ISO 8601 string.
fn unix_to_iso(secs: i64) -> String {
    // Manual conversion — avoids chrono dependency.
    // Codex stores seconds since epoch; we produce a UTC ISO 8601 string.
    let d = std::time::UNIX_EPOCH + std::time::Duration::from_secs(secs as u64);
    let dt: std::time::SystemTime = d;
    // Format via the humantime crate pattern (already used transitively) or manual
    // We'll use a simple approach: convert to RFC 3339 manually
    match dt.duration_since(std::time::UNIX_EPOCH) {
        Ok(dur) => {
            let total_secs = dur.as_secs();
            let days = total_secs / 86400;
            let time_secs = total_secs % 86400;
            let hours = time_secs / 3600;
            let mins = (time_secs % 3600) / 60;
            let secs = time_secs % 60;

            // Days since Unix epoch to Y-M-D (civil calendar)
            let (y, m, d) = days_to_ymd(days as i64);
            format!("{y:04}-{m:02}-{d:02}T{hours:02}:{mins:02}:{secs:02}Z")
        }
        Err(_) => String::new(),
    }
}

/// Convert days since Unix epoch (1970-01-01) to (year, month, day).
fn days_to_ymd(days: i64) -> (i64, u32, u32) {
    // Algorithm from http://howardhinnant.github.io/date_algorithms.html
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}
