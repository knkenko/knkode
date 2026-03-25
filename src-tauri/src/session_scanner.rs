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
    /// First user prompt or session name (truncated).
    pub summary: Option<String>,
    /// Git branch active when the session started.
    pub branch: Option<String>,
    /// Working directory of the session.
    pub cwd: Option<String>,
}

/// List agent sessions matching `project_cwd`, sorted by timestamp descending.
pub fn list_sessions(project_cwd: &str) -> Vec<AgentSession> {
    let agents = detect_installed_agents();
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return Vec::new(),
    };

    let mut sessions = Vec::new();

    for agent in agents {
        match agent {
            AgentKind::Claude => scan_claude(&home, project_cwd, &mut sessions),
            AgentKind::Gemini => scan_gemini(&home, project_cwd, &mut sessions),
            AgentKind::Codex => scan_codex(&home, project_cwd, &mut sessions),
        }
    }

    sessions.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
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
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("where")
        .arg(name)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();
    #[cfg(not(target_os = "windows"))]
    let result = std::process::Command::new("which")
        .arg(name)
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
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map_or(true, |e| e != "jsonl") || !path.is_file() {
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

    Some(AgentSession {
        id,
        agent: AgentKind::Claude,
        timestamp: timestamp?,
        summary: summary.map(|s| truncate_summary(&s)),
        branch,
        cwd,
    })
}

/// Extract the user prompt from Claude's queue-operation content.
/// Format is typically `<number>\n<prompt>\n` — skip the leading number line.
fn extract_claude_prompt(content: &str) -> Option<String> {
    let lines: Vec<&str> = content.lines().filter(|l| !l.is_empty()).collect();
    if lines.is_empty() {
        return None;
    }
    // If first line is just a number (permission mode), skip it
    if lines.len() > 1 && lines[0].trim().parse::<u32>().is_ok() {
        Some(lines[1..].join(" "))
    } else {
        Some(lines.join(" "))
    }
}

// ---------------------------------------------------------------------------
// Gemini CLI — ~/.gemini/tmp/<project-name>/chats/session-*.json
// ---------------------------------------------------------------------------

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
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map_or(true, |e| e != "json") || !path.is_file() {
            continue;
        }
        if let Some(session) = parse_gemini_session(&path) {
            out.push(session);
        }
    }
}

fn parse_gemini_session(path: &Path) -> Option<AgentSession> {
    let content = std::fs::read_to_string(path).ok()?;
    let val: serde_json::Value = serde_json::from_str(&content).ok()?;

    let id = val.get("sessionId").and_then(|v| v.as_str())?.to_string();
    let timestamp = val.get("startTime").and_then(|v| v.as_str())?.to_string();

    // Extract first user message as summary
    let summary = val
        .get("messages")
        .and_then(|m| m.as_array())
        .and_then(|arr| {
            arr.iter().find_map(|msg| {
                let role = msg.get("role").and_then(|r| r.as_str());
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
        summary: summary.map(|s| truncate_summary(&s)),
        branch: None,
        cwd: None,
    })
}

// ---------------------------------------------------------------------------
// Codex CLI — ~/.codex/sessions/<year>/<month>/<day>/rollout-*.jsonl
// ---------------------------------------------------------------------------

fn scan_codex(home: &Path, project_cwd: &str, out: &mut Vec<AgentSession>) {
    let sessions_dir = home.join(".codex").join("sessions");
    if !sessions_dir.is_dir() {
        return;
    }
    walk_codex_dir(&sessions_dir, project_cwd, out);
}

fn walk_codex_dir(dir: &Path, project_cwd: &str, out: &mut Vec<AgentSession>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk_codex_dir(&path, project_cwd, out);
        } else if path.extension().map_or(false, |e| e == "jsonl") && path.is_file() {
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

    // Filter by CWD
    if let Some(ref session_cwd) = cwd {
        if session_cwd != project_cwd {
            return None;
        }
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
        // Look for the first user message with input_text
        if ev.get("type").and_then(|t| t.as_str()) == Some("response_item") {
            if let Some(payload) = ev.get("payload") {
                let role = payload.get("role").and_then(|r| r.as_str());
                // Skip developer (system) messages, look for user input
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
        summary: summary.map(|s| truncate_summary(&s)),
        branch: None,
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
