use crate::terminal::{
    TerminalState, DEFAULT_CELL_PIXEL_HEIGHT, DEFAULT_CELL_PIXEL_WIDTH, DEFAULT_COLS, DEFAULT_ROWS,
};
#[cfg(not(target_os = "windows"))]
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde_json::json;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};
use tauri::Emitter;

const SHELL_READY_DELAY_MS: u64 = 300;
const READ_BUFFER_SIZE: usize = 8192;
const MAX_SESSIONS: usize = 64;
/// Minimum interval between render events per terminal (~60fps).
/// During high-throughput output the reader advances terminal state on every
/// chunk but only snapshots + emits at this cadence, preventing UI freezes.
const RENDER_INTERVAL: Duration = Duration::from_millis(16);

/// Detect the CWD of a child process by parsing `lsof -p PID -Fn` output.
/// Scans for the `fcwd` file descriptor line, then reads the `n/path` line after it.
/// Does not need PATH augmentation — `lsof` lives in `/usr/sbin` which is always
/// in the default PATH, even for Dock/Spotlight-launched apps.
#[cfg(target_os = "macos")]
fn detect_cwd(pid: u32) -> Option<String> {
    use std::process::Command;
    let output = Command::new("lsof")
        .args(["-p", &pid.to_string(), "-Fn"])
        .stderr(std::process::Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut found_cwd = false;
    for line in stdout.lines() {
        if found_cwd {
            return line.strip_prefix('n').map(|path| path.to_string());
        }
        if line == "fcwd" {
            found_cwd = true;
        }
    }
    None
}

/// Detect the CWD of a child process on Linux via `/proc/<pid>/cwd` symlink.
/// The kernel appends ` (deleted)` when the directory has been removed — strip it.
#[cfg(target_os = "linux")]
fn detect_cwd(pid: u32) -> Option<String> {
    std::fs::read_link(format!("/proc/{pid}/cwd"))
        .ok()
        .and_then(|p| {
            p.to_str()
                .map(|s| s.trim_end_matches(" (deleted)").to_string())
        })
}

/// Windows CWD detection requires NtQueryInformationProcess (ntapi crate) or
/// the `windows` crate — not worth the dependency for now. Falls back to
/// initial CWD which is set at PTY creation time.
#[cfg(target_os = "windows")]
fn detect_cwd(_pid: u32) -> Option<String> {
    None
}

/// Catch-all for platforms without CWD detection (FreeBSD, etc.).
#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn detect_cwd(_pid: u32) -> Option<String> {
    None
}

/// Check foreground process status for multiple shell PIDs in a single `ps` call.
///
/// A single `ps -o pid=,stat= -p pid1,pid2,...` invocation replaces per-pane
/// fork+exec, reducing O(N) subprocesses to O(1) per poll cycle.
///
/// Returns a map from PID to `true` (foreground child running) / `false` (idle).
/// PIDs where detection fails (exited, not found) are omitted.
#[cfg(target_os = "macos")]
fn check_foreground_batch(pids: &[(String, u32)]) -> HashMap<u32, bool> {
    use std::process::Command;

    if pids.is_empty() {
        return HashMap::new();
    }

    let pid_args: Vec<String> = pids.iter().map(|(_, pid)| pid.to_string()).collect();
    let pid_list = pid_args.join(",");

    let output = match Command::new("ps")
        .args(["-o", "pid=,stat=", "-p", &pid_list])
        .stderr(std::process::Stdio::null())
        .output()
    {
        Ok(o) => o,
        Err(e) => {
            eprintln!("[pty] ps command failed: {e} — foreground detection unavailable");
            return HashMap::new();
        }
    };

    if !output.status.success() {
        return HashMap::new();
    }

    // Parse lines like "  1234 S+  " — each has PID and STAT columns.
    // '+' in STAT = process is in the foreground process group.
    // Shell has '+' → shell is foreground → no child running (idle).
    let mut result = HashMap::with_capacity(pids.len());
    for line in output.stdout.split(|&b| b == b'\n') {
        let line = line.trim_ascii();
        if line.is_empty() {
            continue;
        }
        // Split on whitespace: first token is PID, rest is STAT
        if let Some(space_pos) = line.iter().position(|&b| b == b' ' || b == b'\t') {
            if let Ok(pid) = std::str::from_utf8(&line[..space_pos])
                .unwrap_or("")
                .parse::<u32>()
            {
                let stat_field = &line[space_pos..];
                // '+' present in STAT bytes → shell is foreground → idle (no child)
                result.insert(pid, !stat_field.contains(&b'+'));
            }
        }
    }
    result
}

/// Check foreground process status on Linux by reading `/proc/<pid>/stat`.
///
/// No subprocess is spawned — each PID is checked via procfs.
/// Compares field 5 (pgrp) against field 8 (tpgid): if tpgid != pgrp,
/// another process group owns the terminal foreground.
#[cfg(target_os = "linux")]
fn check_foreground_batch(pids: &[(String, u32)]) -> HashMap<u32, bool> {
    let mut result = HashMap::with_capacity(pids.len());
    for &(_, pid) in pids {
        if let Some(has_child) = check_foreground_single_linux(pid) {
            result.insert(pid, has_child);
        }
    }
    result
}

#[cfg(target_os = "linux")]
fn check_foreground_single_linux(pid: u32) -> Option<bool> {
    let stat = std::fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
    // Format: pid (comm) state ppid pgrp session tty_nr tpgid ...
    // (comm) can contain spaces/parens, so skip past the closing ')'.
    // + 2 skips the ") " (close-paren + space) separator before the fields.
    let after_comm = stat.rfind(')')? + 2;
    let fields: Vec<&str> = stat.get(after_comm..)?.split_whitespace().collect();
    // After ')': state(0) ppid(1) pgrp(2) session(3) tty_nr(4) tpgid(5)
    let pgrp: i32 = fields.get(2)?.parse().ok()?;
    let tpgid: i32 = fields.get(5)?.parse().ok()?;
    Some(tpgid != pgrp)
}

/// Windows: check if shell processes have child processes via process snapshot.
/// ConPTY has no foreground process group concept, so we check the process tree
/// instead — if the shell has any child process, a command is running.
#[cfg(target_os = "windows")]
fn check_foreground_batch(pids: &[(String, u32)]) -> HashMap<u32, bool> {
    use std::collections::HashSet;
    use winapi::um::handleapi::CloseHandle;
    use winapi::um::tlhelp32::{
        CreateToolhelp32Snapshot, Process32First, Process32Next, PROCESSENTRY32, TH32CS_SNAPPROCESS,
    };

    if pids.is_empty() {
        return HashMap::new();
    }

    let shell_pids: HashSet<u32> = pids.iter().map(|(_, pid)| *pid).collect();

    // Snapshot all processes and find which shell PIDs have children
    let mut parent_pids_with_children: HashSet<u32> = HashSet::new();
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == winapi::um::handleapi::INVALID_HANDLE_VALUE {
            eprintln!("[pty] CreateToolhelp32Snapshot failed — foreground detection unavailable");
            return HashMap::new();
        }

        let mut entry: PROCESSENTRY32 = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32>() as u32;

        if Process32First(snapshot, &mut entry) != 0 {
            loop {
                // If this process's parent is one of our shell PIDs, mark it
                if shell_pids.contains(&entry.th32ParentProcessID) {
                    parent_pids_with_children.insert(entry.th32ParentProcessID);
                }
                if Process32Next(snapshot, &mut entry) == 0 {
                    break;
                }
            }
        }
        CloseHandle(snapshot);
    }

    // Map results: shell has children → active, no children → idle
    let mut result = HashMap::with_capacity(pids.len());
    for &(_, pid) in pids {
        result.insert(pid, parent_pids_with_children.contains(&pid));
    }
    result
}

/// Unsupported platform — foreground detection unavailable.
#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn check_foreground_batch(_pids: &[(String, u32)]) -> HashMap<u32, bool> {
    HashMap::new()
}

/// Emit a terminal render snapshot to the frontend.
/// Returns `true` if the emit succeeded or there was nothing to emit,
/// `false` if the Tauri event channel is broken.
fn emit_snapshot(app: &tauri::AppHandle, term_state: &TerminalState, id: &str) -> bool {
    if let Some(snapshot) = term_state.snapshot(id) {
        app.emit("terminal:render", json!({ "id": id, "grid": snapshot }))
            .is_ok()
    } else {
        true
    }
}

#[cfg(not(target_os = "windows"))]
fn pty_size(cols: u16, rows: u16, pixel_width: u16, pixel_height: u16) -> PtySize {
    PtySize {
        rows,
        cols,
        pixel_width,
        pixel_height,
    }
}

/// A single PTY session. The `generation` counter disambiguates sessions that
/// reuse the same ID, preventing a stale reader thread from cleaning up a
/// newly-created session.
struct PtySession {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    generation: u64,
    /// CWD at spawn time — fallback when OS-level CWD detection fails.
    initial_cwd: String,
    platform: PlatformPty,
}

#[cfg(not(target_os = "windows"))]
struct PlatformPty {
    /// Retained after `take_writer()`/`try_clone_reader()` solely for `resize()`.
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

#[cfg(target_os = "windows")]
struct PlatformPty {
    session: crate::win_pty::WinPtySession,
}

#[cfg(not(target_os = "windows"))]
impl PlatformPty {
    fn resize(
        &self,
        cols: u16,
        rows: u16,
        pixel_width: u16,
        pixel_height: u16,
    ) -> Result<(), String> {
        self.master
            .resize(pty_size(cols, rows, pixel_width, pixel_height))
            .map_err(|e| format!("PTY resize failed: {e}"))
    }

    fn kill(&mut self) {
        let _ = self.child.kill();
    }

    fn wait(&mut self) -> i64 {
        self.child
            .wait()
            .map(|s| s.exit_code() as i64)
            .unwrap_or(-1)
    }

    fn pid(&self) -> Option<u32> {
        self.child.process_id()
    }
}

#[cfg(target_os = "windows")]
impl PlatformPty {
    fn resize(
        &self,
        cols: u16,
        rows: u16,
        _pixel_width: u16,
        _pixel_height: u16,
    ) -> Result<(), String> {
        self.session.resize(cols, rows)
    }

    fn kill(&mut self) {
        self.session.kill();
    }

    fn wait(&mut self) -> i64 {
        self.session.wait()
    }

    fn pid(&self) -> Option<u32> {
        Some(self.session.pid())
    }
}

#[cfg(not(target_os = "windows"))]
fn create_platform_pty(
    id: &str,
    cwd: &str,
) -> Result<
    (
        Box<dyn Write + Send>,
        Box<dyn std::io::Read + Send>,
        PlatformPty,
    ),
    String,
> {
    let default_pw = (DEFAULT_COLS * DEFAULT_CELL_PIXEL_WIDTH) as u16;
    let default_ph = (DEFAULT_ROWS * DEFAULT_CELL_PIXEL_HEIGHT) as u16;

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(pty_size(
            DEFAULT_COLS as u16,
            DEFAULT_ROWS as u16,
            default_pw,
            default_ph,
        ))
        .map_err(|e| format!("Failed to open PTY: {e}"))?;

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
    let mut cmd = CommandBuilder::new(&shell);
    cmd.arg("-l");
    cmd.cwd(cwd);
    cmd.env("TERM", "xterm-256color");

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {e}"))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take PTY writer: {e}"))?;
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {e}"))?;

    eprintln!(
        "[pty] Created Unix PTY for {id}, shell={shell}, pid={:?}",
        child.process_id()
    );

    Ok((
        writer,
        reader,
        PlatformPty {
            master: pair.master,
            child,
        },
    ))
}

#[cfg(target_os = "windows")]
fn create_platform_pty(
    id: &str,
    cwd: &str,
) -> Result<
    (
        Box<dyn Write + Send>,
        Box<dyn std::io::Read + Send>,
        PlatformPty,
    ),
    String,
> {
    // On Windows, SHELL may contain an MSYS2 path like "/usr/bin/bash" which
    // CreateProcessW can't resolve. Only use SHELL if it looks like a valid
    // Windows path (contains ':' or '\'). Default to PowerShell (not COMSPEC/cmd.exe)
    // since PowerShell handles ConPTY output better.
    let exe = std::env::var("SHELL")
        .ok()
        .filter(|s| s.contains(':') || s.contains('\\'))
        .unwrap_or_else(|| "powershell.exe".to_string());

    eprintln!("[pty] Windows shell detection for {id}: exe={exe}");

    let env_vars = [("TERM", "xterm-256color")];
    let (session, pipes) = crate::win_pty::WinPtySession::spawn(
        DEFAULT_COLS as u16,
        DEFAULT_ROWS as u16,
        &exe,
        cwd,
        &env_vars,
    )?;

    eprintln!(
        "[pty] Created Windows PTY for {id}, shell={exe}, pid={}",
        session.pid()
    );

    let writer: Box<dyn Write + Send> = Box::new(pipes.writer);
    let reader: Box<dyn std::io::Read + Send> = Box::new(pipes.reader);

    Ok((writer, reader, PlatformPty { session }))
}

/// Thread-safe manager for PTY sessions. Each session is identified by a
/// string ID (typically a pane/tab ID). All methods are safe to call
/// concurrently from any thread.
pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
    next_generation: AtomicU64,
    terminal_state: Arc<TerminalState>,
    /// Timestamp of last PTY output per pane. Updated by reader threads,
    /// polled by CwdTracker to detect idle vs active agents.
    last_output_at: Arc<Mutex<HashMap<String, Instant>>>,
}

impl PtyManager {
    pub fn new(terminal_state: Arc<TerminalState>) -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            next_generation: AtomicU64::new(1),
            terminal_state,
            last_output_at: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn create(
        &self,
        id: String,
        cwd: String,
        startup_command: Option<String>,
        app: tauri::AppHandle,
    ) -> Result<(), String> {
        // Kill existing session to allow pane restart without explicit cleanup
        self.kill(&id).ok();

        // Enforce session limit to prevent resource exhaustion
        {
            let sessions = self.lock_sessions()?;
            if sessions.len() >= MAX_SESSIONS {
                return Err(format!("Too many PTY sessions (max {MAX_SESSIONS})"));
            }
        }

        let generation = self.next_generation.fetch_add(1, Ordering::Relaxed);
        let default_pw = (DEFAULT_COLS * DEFAULT_CELL_PIXEL_WIDTH) as u16;
        let default_ph = (DEFAULT_ROWS * DEFAULT_CELL_PIXEL_HEIGHT) as u16;

        // Platform-specific PTY creation
        let (writer, mut reader, platform) = create_platform_pty(&id, &cwd)?;
        let writer = Arc::new(Mutex::new(writer));

        // Delay startup command to let the shell initialize (login profile, prompt)
        if let Some(cmd_str) = startup_command {
            let writer_clone = Arc::clone(&writer);
            let id_clone = id.clone();
            let sessions_clone = Arc::clone(&self.sessions);
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(SHELL_READY_DELAY_MS));
                // Check session still exists, then drop the sessions lock before
                // acquiring the writer lock to avoid deadlock
                let exists = sessions_clone
                    .lock()
                    .ok()
                    .is_some_and(|s| s.contains_key(&id_clone));
                if exists {
                    if let Ok(mut w) = writer_clone.lock() {
                        if let Err(e) = w.write_all(cmd_str.as_bytes()) {
                            eprintln!("[pty] Failed to write startup command for {id_clone}: {e}");
                            return;
                        }
                        if let Err(e) = w.write_all(b"\r") {
                            eprintln!("[pty] Failed to write CR for {id_clone}: {e}");
                            return;
                        }
                        let _ = w.flush();
                    }
                }
            });
        }

        // Store session before starting reader — cleanup logic in the reader
        // checks the session map, so it must exist before the reader can race
        // to completion
        let session = PtySession {
            writer,
            generation,
            initial_cwd: cwd.clone(),
            platform,
        };
        self.lock_sessions()?.insert(id.clone(), session);
        eprintln!("[pty] Session stored for {id}");

        // Create terminal state AFTER successful session insert to avoid orphaned
        // terminal entries if sessions lock is poisoned
        self.terminal_state.create(
            &id,
            DEFAULT_COLS,
            DEFAULT_ROWS,
            default_pw as usize,
            default_ph as usize,
        );
        eprintln!("[pty] Terminal state created for {id}");

        // Shared flags between reader and flush threads.
        // `dirty`: set when terminal state advances but no snapshot was emitted (throttled).
        // `alive`: cleared when the reader exits so the flush thread can stop.
        let dirty = Arc::new(AtomicBool::new(false));
        let alive = Arc::new(AtomicBool::new(true));

        // Trailing-edge flush thread: ensures the screen always shows the latest
        // state after a data burst ends. Without this, the last chunk in a burst
        // gets throttled and the reader blocks on read(), leaving the screen stale.
        {
            let dirty_flush = Arc::clone(&dirty);
            let alive_flush = Arc::clone(&alive);
            let term_state = Arc::clone(&self.terminal_state);
            let id_flush = id.clone();
            let app_flush = app.clone();
            std::thread::spawn(move || {
                while alive_flush.load(Ordering::Relaxed) {
                    std::thread::sleep(RENDER_INTERVAL);
                    if dirty_flush.swap(false, Ordering::AcqRel) {
                        emit_snapshot(&app_flush, &term_state, &id_flush);
                    }
                }
            });
        }

        // Background reader thread: read PTY output → wezterm-term → throttled emit.
        // Advances terminal state on every chunk but only snapshots + emits at
        // RENDER_INTERVAL (~60fps) to avoid flooding the frontend during bursts.
        // The flush thread above catches any trailing updates that get throttled.
        let id_clone = id.clone();
        let sessions_clone = Arc::clone(&self.sessions);
        let term_state = Arc::clone(&self.terminal_state);
        let output_times = Arc::clone(&self.last_output_at);
        std::thread::spawn(move || {
            eprintln!("[pty] Reader thread started for {id_clone}");
            let mut buf = [0u8; READ_BUFFER_SIZE];
            let mut last_emit = Instant::now() - RENDER_INTERVAL; // emit first frame immediately
            let mut total_bytes: usize = 0;
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        eprintln!("[pty] Reader EOF for {id_clone} (total bytes: {total_bytes})");
                        break;
                    }
                    Ok(n) => {
                        total_bytes += n;
                        if total_bytes <= 64 {
                            let hex: String = buf[..n]
                                .iter()
                                .map(|b| format!("{b:02x}"))
                                .collect::<Vec<_>>()
                                .join(" ");
                            eprintln!(
                                "[pty] Read #{} for {id_clone}: {n} bytes [{hex}]",
                                total_bytes / n.max(1)
                            );
                        }
                        term_state.advance_only(&id_clone, &buf[..n]);

                        if last_emit.elapsed() >= RENDER_INTERVAL {
                            // Record output timestamp for activity detection.
                            // Throttled to ~60fps — sub-16ms precision is irrelevant
                            // given the 2-second idle threshold polled every 3 seconds.
                            let mut times = output_times.lock().unwrap_or_else(|e| e.into_inner());
                            if let Some(t) = times.get_mut(&id_clone) {
                                *t = Instant::now();
                            } else {
                                times.insert(id_clone.clone(), Instant::now());
                            }
                            drop(times);

                            dirty.store(false, Ordering::Release);
                            if !emit_snapshot(&app, &term_state, &id_clone) {
                                break;
                            }
                            last_emit = Instant::now();
                        } else {
                            dirty.store(true, Ordering::Release);
                        }
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
                    Err(e) => {
                        eprintln!("[pty] Read error for {id_clone}: {e}");
                        break;
                    }
                }
            }

            alive.store(false, Ordering::Release);

            // Always emit a final snapshot so the screen shows the complete output
            // (the last chunk may have been throttled).
            emit_snapshot(&app, &term_state, &id_clone);

            // PTY closed — get exit code and clean up
            // Remove only if this is still the same generation (prevents race on restart)
            let removed = if let Ok(mut sessions) = sessions_clone.lock() {
                if sessions
                    .get(&id_clone)
                    .is_some_and(|s| s.generation == generation)
                {
                    sessions.remove(&id_clone)
                } else {
                    None
                }
            } else {
                eprintln!("[pty] Sessions lock poisoned during cleanup for {id_clone}");
                None
            };

            // Wait for child outside the lock to avoid blocking other operations
            let exit_code: i64 = if let Some(mut session) = removed {
                term_state.remove(&id_clone);
                // Clean up output timestamp so poll_activity doesn't evaluate a dead pane
                output_times
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .remove(&id_clone);
                session.platform.wait()
            } else {
                // Session was replaced by a new generation — skip exit event
                return;
            };

            if let Err(e) = app.emit(
                "pty:exit",
                json!({ "id": &id_clone, "exitCode": exit_code }),
            ) {
                eprintln!("[pty] Failed to emit exit event for {id_clone}: {e}");
            }
        });

        Ok(())
    }

    pub fn write(&self, id: &str, data: &str) -> Result<(), String> {
        // Clone the writer Arc and release the sessions lock before I/O
        // to avoid blocking other PTY operations during write
        let writer = {
            let sessions = self.lock_sessions()?;
            let session = sessions
                .get(id)
                .ok_or_else(|| format!("No PTY session for pane {id}"))?;
            Arc::clone(&session.writer)
        };
        let mut writer = writer.lock().map_err(|e| e.to_string())?;
        writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("PTY write failed: {e}"))?;
        writer.flush().map_err(|e| format!("PTY flush failed: {e}"))
    }

    pub fn resize(
        &self,
        id: &str,
        cols: u16,
        rows: u16,
        pixel_width: u16,
        pixel_height: u16,
    ) -> Result<(), String> {
        // Silently ignore missing sessions — resize can race with tab close
        {
            let sessions = self.lock_sessions()?;
            if let Some(session) = sessions.get(id) {
                session
                    .platform
                    .resize(cols, rows, pixel_width, pixel_height)?;
            }
        } // Drop sessions lock before acquiring terminals lock to prevent deadlock
        self.terminal_state.resize(
            id,
            cols as usize,
            rows as usize,
            pixel_width as usize,
            pixel_height as usize,
        );
        Ok(())
    }

    pub fn kill(&self, id: &str) -> Result<(), String> {
        // Kill is idempotent — silently ignore missing sessions
        let mut sessions = self.lock_sessions()?;
        if let Some(mut session) = sessions.remove(id) {
            session.platform.kill();
        }
        self.terminal_state.remove(id);
        self.last_output_at
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(id);
        Ok(())
    }

    /// Clean up all sessions on app shutdown.
    pub fn kill_all(&self) {
        let mut sessions = self.sessions.lock().unwrap_or_else(|e| e.into_inner());
        for (_id, mut session) in sessions.drain() {
            session.platform.kill();
        }
        self.terminal_state.remove_all();
        self.last_output_at
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clear();
    }

    /// Get the current working directory for a pane.
    /// On macOS uses `lsof`; on Linux reads `/proc/<pid>/cwd`.
    /// Falls back to the initial CWD if detection fails or on Windows.
    pub fn get_cwd(&self, id: &str) -> Option<String> {
        let sessions = self.lock_sessions().ok()?;
        let session = sessions.get(id)?;
        let pid = session.platform.pid();
        let fallback = session.initial_cwd.clone();
        drop(sessions);

        pid.and_then(detect_cwd).or(Some(fallback))
    }

    /// Returns elapsed time since last PTY output for each pane that has produced output.
    /// The CwdTracker polls this once per cycle to detect idle vs active agents.
    pub fn get_output_ages(&self) -> HashMap<String, Duration> {
        let times = self
            .last_output_at
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        times
            .iter()
            .map(|(id, instant)| (id.clone(), instant.elapsed()))
            .collect()
    }

    /// Returns foreground process status for each active session.
    /// `true` = a foreground child process is running (command in progress).
    /// `false` = shell is in foreground (idle, waiting for input).
    /// Sessions where detection fails (Windows, or process exited) are omitted.
    ///
    /// Collects PIDs under the sessions lock, then releases it before running
    /// OS-level checks to avoid blocking PTY operations.
    pub fn get_foreground_statuses(&self) -> HashMap<String, bool> {
        let pids: Vec<(String, u32)> = {
            let sessions = match self.lock_sessions() {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("[pty] {e} — skipping foreground detection");
                    return HashMap::new();
                }
            };
            sessions
                .iter()
                .filter_map(|(id, session)| session.platform.pid().map(|pid| (id.clone(), pid)))
                .collect()
        };

        let by_pid = check_foreground_batch(&pids);

        // Map back from PID-keyed results to pane-ID-keyed results
        let mut result = HashMap::with_capacity(by_pid.len());
        for (id, pid) in &pids {
            if let Some(&has_child) = by_pid.get(pid) {
                result.insert(id.clone(), has_child);
            }
        }
        result
    }

    fn lock_sessions(&self) -> Result<MutexGuard<'_, HashMap<String, PtySession>>, String> {
        self.sessions
            .lock()
            .map_err(|e| format!("Session lock poisoned: {e}"))
    }
}
