use crate::pty::PtyManager;
use serde::Serialize;
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::Emitter;

/// Polling interval for CWD/branch/PR detection. Effective cycle time accounts
/// for processing duration so the interval stays consistent.
const POLL_INTERVAL: Duration = Duration::from_secs(3);
const PR_REFRESH_INTERVAL: Duration = Duration::from_secs(60);
const TOOL_RETRY_INTERVAL: Duration = Duration::from_secs(300);
const MAX_PR_TITLE_LEN: usize = 256;
const MAX_LOG_MSG_LEN: usize = 200;
const MAX_LOGGED_ERRORS: usize = 64;

/// Extra PATH directories for subprocess calls. Tauri launched from Dock/Spotlight
/// inherits a minimal PATH — Homebrew/Linuxbrew tools are invisible without this.
const EXTRA_PATH_DIRS: &[&str] = &[
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/home/linuxbrew/.linuxbrew/bin",
];

#[derive(Clone, Serialize)]
pub struct PrInfo {
    pub number: u32,
    pub url: String,
    pub title: String,
}

/// Per-pane tracking state. Initialized with the shell's starting CWD and
/// `pr_last_checked` set to one `PR_REFRESH_INTERVAL` in the past to force
/// an immediate first PR check.
struct PaneState {
    cwd: String,
    branch: Option<String>,
    pr: Option<PrInfo>,
    pr_last_checked: Instant,
}

/// Per-pane CWD, git branch, and PR status tracker.
/// Polls at [`POLL_INTERVAL`] using OS-level CWD detection + git/gh CLI.
pub struct CwdTracker {
    panes: Arc<Mutex<HashMap<String, PaneState>>>,
    running: Arc<AtomicBool>,
    handle: Mutex<Option<std::thread::JoinHandle<()>>>,
}

/// Result of running an external CLI tool. Uses distinct variant names
/// to avoid shadowing `std::result::Result::Ok`/`Err`.
enum ToolOutcome<T> {
    Success(T),
    Missing,
    Failed(String),
}

/// Mutable state carried across polling cycles.
struct PollState {
    augmented_path: String,
    git_missing_since: Option<Instant>,
    gh_missing_since: Option<Instant>,
    gh_logged_errors: HashSet<String>,
}

/// Cached git/PR results for a single repo root within one poll cycle.
/// Avoids duplicate subprocess calls when multiple panes share a repo.
struct RepoCacheEntry {
    branch: Option<String>,
    pr: Option<Option<PrInfo>>,
}

impl CwdTracker {
    pub fn new() -> Self {
        Self {
            panes: Arc::new(Mutex::new(HashMap::new())),
            running: Arc::new(AtomicBool::new(false)),
            handle: Mutex::new(None),
        }
    }

    pub fn track_pane(&self, pane_id: String, initial_cwd: String) {
        match self.panes.lock() {
            Ok(mut panes) => {
                panes.insert(
                    pane_id,
                    PaneState {
                        cwd: initial_cwd,
                        branch: None,
                        pr: None,
                        pr_last_checked: Instant::now() - PR_REFRESH_INTERVAL,
                    },
                );
            }
            Err(e) => eprintln!("[tracker] Failed to track pane — lock poisoned: {e}"),
        }
    }

    pub fn untrack_pane(&self, pane_id: &str) {
        match self.panes.lock() {
            Ok(mut panes) => {
                panes.remove(pane_id);
            }
            Err(e) => eprintln!("[tracker] Failed to untrack pane — lock poisoned: {e}"),
        }
    }

    /// Start the background polling thread. No-op if already running.
    pub fn start(&self, app: tauri::AppHandle, pty_manager: Arc<PtyManager>) {
        if self.running.swap(true, Ordering::SeqCst) {
            return;
        }

        let panes = Arc::clone(&self.panes);
        let running = Arc::clone(&self.running);

        let handle = match std::thread::Builder::new()
            .name("cwd-tracker".into())
            .spawn(move || {
                let mut state = PollState {
                    augmented_path: build_augmented_path(),
                    git_missing_since: None,
                    gh_missing_since: None,
                    gh_logged_errors: HashSet::new(),
                };

                while running.load(Ordering::SeqCst) {
                    let cycle_start = Instant::now();

                    let pane_ids: Vec<String> = match panes.lock() {
                        Ok(p) => p.keys().cloned().collect(),
                        Err(e) => {
                            eprintln!("[tracker] Panes lock poisoned — stopping: {e}");
                            break;
                        }
                    };

                    // Per-cycle repo cache: repo_root → cached branch/PR results.
                    // Prevents duplicate git/gh calls when multiple panes share a repo.
                    let mut repo_cache: HashMap<String, RepoCacheEntry> = HashMap::new();

                    for pane_id in pane_ids {
                        if !running.load(Ordering::SeqCst) {
                            break;
                        }
                        poll_pane(
                            &pane_id,
                            &panes,
                            &pty_manager,
                            &app,
                            &mut state,
                            &mut repo_cache,
                        );
                    }

                    let elapsed = cycle_start.elapsed();
                    if elapsed < POLL_INTERVAL {
                        std::thread::sleep(POLL_INTERVAL - elapsed);
                    }
                }
            }) {
            Ok(h) => h,
            Err(e) => {
                eprintln!("[tracker] Failed to spawn cwd-tracker thread: {e}");
                self.running.store(false, Ordering::SeqCst);
                return;
            }
        };

        if let Ok(mut h) = self.handle.lock() {
            *h = Some(handle);
        }
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
        if let Ok(mut handle) = self.handle.lock() {
            if let Some(h) = handle.take() {
                let _ = h.join();
            }
        }
        if let Ok(mut panes) = self.panes.lock() {
            panes.clear();
        }
    }
}

// ---------------------------------------------------------------------------
// Polling logic
// ---------------------------------------------------------------------------

fn poll_pane(
    pane_id: &str,
    panes: &Mutex<HashMap<String, PaneState>>,
    pty_manager: &PtyManager,
    app: &tauri::AppHandle,
    state: &mut PollState,
    repo_cache: &mut HashMap<String, RepoCacheEntry>,
) {
    let current_cwd = pty_manager.get_cwd(pane_id);
    let (last_cwd, last_branch) = match panes.lock() {
        Ok(p) => match p.get(pane_id) {
            Some(s) => (s.cwd.clone(), s.branch.clone()),
            None => return,
        },
        Err(e) => {
            eprintln!("[tracker] Panes lock poisoned in poll_pane: {e}");
            return;
        }
    };

    // CWD change detection
    let cwd = if let Some(ref detected) = current_cwd {
        if *detected != last_cwd {
            with_pane_mut(panes, pane_id, |s| {
                s.cwd = detected.clone();
            });
            let _ = app.emit(
                "pty:cwd-changed",
                json!({ "paneId": pane_id, "cwd": detected }),
            );
        }
        detected.clone()
    } else {
        last_cwd
    };

    // Git branch detection — deduplicated per repo root
    if !should_retry_tool(&mut state.git_missing_since) {
        return;
    }

    // Resolve repo root to share results across panes in the same repo
    let repo_root = get_repo_root(&cwd, &state.augmented_path);

    // Check if we already have cached results for this repo
    let current_branch = if let Some(root) = &repo_root {
        if let Some(cached) = repo_cache.get(root) {
            cached.branch.clone()
        } else {
            // First pane in this repo — actually query git
            let branch = match get_git_branch(&cwd, &state.augmented_path) {
                ToolOutcome::Success(b) => {
                    state.git_missing_since = None;
                    b
                }
                ToolOutcome::Missing => {
                    if state.git_missing_since.is_none() {
                        state.git_missing_since = Some(Instant::now());
                        eprintln!(
                            "[tracker] git not found — branch detection disabled (will retry)"
                        );
                    }
                    return;
                }
                ToolOutcome::Failed(e) => {
                    eprintln!("[tracker] git error: {}", truncate_str(&e, MAX_LOG_MSG_LEN));
                    return;
                }
            };
            repo_cache.insert(
                root.clone(),
                RepoCacheEntry {
                    branch: branch.clone(),
                    pr: None,
                },
            );
            branch
        }
    } else {
        // Not in a git repo — query directly (won't match other panes)
        match get_git_branch(&cwd, &state.augmented_path) {
            ToolOutcome::Success(b) => {
                state.git_missing_since = None;
                b
            }
            ToolOutcome::Missing => {
                if state.git_missing_since.is_none() {
                    state.git_missing_since = Some(Instant::now());
                    eprintln!("[tracker] git not found — branch detection disabled (will retry)");
                }
                return;
            }
            ToolOutcome::Failed(_) => {
                return;
            }
        }
    };

    let branch_changed = current_branch != last_branch;

    if branch_changed {
        with_pane_mut(panes, pane_id, |s| {
            s.branch = current_branch.clone();
        });
        let _ = app.emit(
            "pty:branch-changed",
            json!({ "paneId": pane_id, "branch": current_branch }),
        );
        clear_pr_if_present(panes, pane_id, app);
    }

    // PR detection — deduplicated per repo root
    let should_check_pr = branch_changed
        || with_pane_mut(panes, pane_id, |s| {
            s.pr_last_checked.elapsed() >= PR_REFRESH_INTERVAL
        })
        .unwrap_or(false);

    if current_branch.is_some() && should_check_pr && should_retry_tool(&mut state.gh_missing_since)
    {
        with_pane_mut(panes, pane_id, |s| {
            s.pr_last_checked = Instant::now();
        });

        // Try to reuse cached PR result for this repo
        let pr_result = if let Some(root) = &repo_root {
            if let Some(cached) = repo_cache.get(root) {
                if let Some(ref cached_pr) = cached.pr {
                    // Already queried gh for this repo this cycle
                    Some(cached_pr.clone())
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };

        let pr = if let Some(cached_pr) = pr_result {
            cached_pr
        } else {
            // First PR check for this repo this cycle — actually query gh
            match get_pr_status(&cwd, &state.augmented_path, &mut state.gh_logged_errors) {
                ToolOutcome::Success(pr) => {
                    state.gh_missing_since = None;
                    // Cache the result for other panes in the same repo
                    if let Some(root) = &repo_root {
                        if let Some(cached) = repo_cache.get_mut(root) {
                            cached.pr = Some(pr.clone());
                        }
                    }
                    pr
                }
                ToolOutcome::Missing => {
                    if state.gh_missing_since.is_none() {
                        state.gh_missing_since = Some(Instant::now());
                        eprintln!(
                            "[tracker] gh CLI not found — PR detection disabled (will retry)"
                        );
                    }
                    return;
                }
                ToolOutcome::Failed(e) => {
                    eprintln!(
                        "[tracker] gh pr view error: {}",
                        truncate_str(&e, MAX_LOG_MSG_LEN)
                    );
                    // Clear stale PR on failure — if we can't verify it's
                    // still open, remove it rather than show stale data.
                    clear_pr_if_present(panes, pane_id, app);
                    return;
                }
            }
        };

        let current_num = pr.as_ref().map(|p| p.number);
        let last_num = with_pane_mut(panes, pane_id, |s| s.pr.as_ref().map(|p| p.number)).flatten();
        if current_num != last_num {
            let _ = app.emit("pty:pr-changed", json!({ "paneId": pane_id, "pr": pr }));
            with_pane_mut(panes, pane_id, |s| {
                s.pr = pr;
            });
        }
    } else if current_branch.is_none() {
        clear_pr_if_present(panes, pane_id, app);
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Mutate a single pane's state under the lock. Returns `None` if the lock
/// is poisoned or the pane is absent.
fn with_pane_mut<F, R>(panes: &Mutex<HashMap<String, PaneState>>, pane_id: &str, f: F) -> Option<R>
where
    F: FnOnce(&mut PaneState) -> R,
{
    panes
        .lock()
        .ok()
        .and_then(|mut p| p.get_mut(pane_id).map(f))
}

/// Clear PR info for a pane and emit a null-PR event if it had one.
fn clear_pr_if_present(
    panes: &Mutex<HashMap<String, PaneState>>,
    pane_id: &str,
    app: &tauri::AppHandle,
) {
    let had_pr = with_pane_mut(panes, pane_id, |s| {
        let had = s.pr.is_some();
        s.pr = None;
        had
    })
    .unwrap_or(false);
    if had_pr {
        let _ = app.emit("pty:pr-changed", json!({ "paneId": pane_id, "pr": null }));
    }
}

/// Truncate a string at a char boundary, returning at most `max_len` bytes.
fn truncate_str(s: &str, max_len: usize) -> &str {
    if s.len() <= max_len {
        return s;
    }
    let mut end = max_len;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    &s[..end]
}

/// Check if a tool should be retried. Returns true if no tool-missing state
/// is active, or if enough time has passed since the tool was last found missing.
fn should_retry_tool(missing_since: &mut Option<Instant>) -> bool {
    match missing_since {
        None => true,
        Some(since) => {
            if since.elapsed() >= TOOL_RETRY_INTERVAL {
                *missing_since = None;
                eprintln!("[tracker] Retrying CLI detection…");
                true
            } else {
                false
            }
        }
    }
}

/// Execute a CLI tool with augmented PATH and git/gh-safe environment.
/// Prevents credential prompts (`GIT_TERMINAL_PROMPT=0`, `GH_PROMPT_DISABLED=1`)
/// and removes `GIT_DIR`/`GIT_WORK_TREE` to avoid redirection to unexpected repos.
fn run_cli(
    tool: &str,
    args: &[&str],
    cwd: &str,
    augmented_path: &str,
) -> ToolOutcome<std::process::Output> {
    let result = Command::new(tool)
        .args(args)
        .current_dir(cwd)
        .env("PATH", augmented_path)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GH_PROMPT_DISABLED", "1")
        .env_remove("GIT_DIR")
        .env_remove("GIT_WORK_TREE")
        .output();

    match result {
        Ok(output) => ToolOutcome::Success(output),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => ToolOutcome::Missing,
        Err(e) => ToolOutcome::Failed(e.to_string()),
    }
}

/// Resolve the git repo root for a given CWD. Returns `None` if not in a repo.
fn get_repo_root(cwd: &str, augmented_path: &str) -> Option<String> {
    match run_cli(
        "git",
        &["rev-parse", "--show-toplevel"],
        cwd,
        augmented_path,
    ) {
        ToolOutcome::Success(output) if output.status.success() => {
            let root = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if root.is_empty() {
                None
            } else {
                Some(root)
            }
        }
        _ => None,
    }
}

fn get_git_branch(cwd: &str, augmented_path: &str) -> ToolOutcome<Option<String>> {
    match run_cli(
        "git",
        &["rev-parse", "--abbrev-ref", "HEAD"],
        cwd,
        augmented_path,
    ) {
        ToolOutcome::Success(output) => {
            if output.status.success() {
                let branch = String::from_utf8_lossy(&output.stdout).trim().to_string();
                ToolOutcome::Success(if branch.is_empty() {
                    None
                } else {
                    Some(branch)
                })
            } else {
                ToolOutcome::Success(None)
            }
        }
        ToolOutcome::Missing => ToolOutcome::Missing,
        ToolOutcome::Failed(e) => ToolOutcome::Failed(e),
    }
}

fn get_pr_status(
    cwd: &str,
    augmented_path: &str,
    logged_errors: &mut HashSet<String>,
) -> ToolOutcome<Option<PrInfo>> {
    match run_cli(
        "gh",
        &["pr", "view", "--json", "number,url,title,state"],
        cwd,
        augmented_path,
    ) {
        ToolOutcome::Success(output) => {
            if output.status.success() {
                match serde_json::from_slice::<serde_json::Value>(&output.stdout) {
                    Ok(data) => {
                        let number = data.get("number").and_then(|v| v.as_u64());
                        let url = data.get("url").and_then(|v| v.as_str());
                        let title = data.get("title").and_then(|v| v.as_str());
                        let state_val = data.get("state").and_then(|v| v.as_str());

                        if let (Some(number), Some(url), Some(title), Some("OPEN")) =
                            (number, url, title, state_val)
                        {
                            if !url.starts_with("https://") && !url.starts_with("http://") {
                                let protocol = url.split(':').next().unwrap_or("unknown");
                                eprintln!(
                                    "[tracker] gh pr URL has unexpected protocol: {protocol}"
                                );
                                return ToolOutcome::Success(None);
                            }
                            let title = if title.len() > MAX_PR_TITLE_LEN {
                                let truncated: String =
                                    title.chars().take(MAX_PR_TITLE_LEN - 3).collect();
                                format!("{truncated}...")
                            } else {
                                title.to_string()
                            };
                            ToolOutcome::Success(Some(PrInfo {
                                number: u32::try_from(number).unwrap_or(0),
                                url: url.to_string(),
                                title,
                            }))
                        } else {
                            ToolOutcome::Success(None)
                        }
                    }
                    Err(e) => {
                        let stdout = String::from_utf8_lossy(&output.stdout);
                        eprintln!(
                            "[tracker] Failed to parse gh pr output: {}",
                            truncate_str(&stdout, MAX_LOG_MSG_LEN)
                        );
                        eprintln!("[tracker] Parse error: {e}");
                        ToolOutcome::Failed(e.to_string())
                    }
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                if !stderr.is_empty() && !stderr.contains("no pull requests found") {
                    if logged_errors.len() >= MAX_LOGGED_ERRORS {
                        logged_errors.clear();
                    }
                    if logged_errors.insert(stderr.clone()) {
                        eprintln!(
                            "[tracker] gh pr view failed: {}",
                            truncate_str(&stderr, MAX_LOG_MSG_LEN)
                        );
                    }
                }
                ToolOutcome::Success(None)
            }
        }
        ToolOutcome::Missing => ToolOutcome::Missing,
        ToolOutcome::Failed(e) => ToolOutcome::Failed(e),
    }
}

/// Build an augmented PATH with extra directories for Homebrew/Linuxbrew.
/// Cached for the lifetime of the polling thread.
fn build_augmented_path() -> String {
    let current = std::env::var("PATH").unwrap_or_default();
    let segments: HashSet<&str> = current.split(':').collect();
    let missing: Vec<&str> = EXTRA_PATH_DIRS
        .iter()
        .copied()
        .filter(|d| !segments.contains(d))
        .collect();
    if missing.is_empty() {
        current
    } else {
        format!("{}:{}", current, missing.join(":"))
    }
}
