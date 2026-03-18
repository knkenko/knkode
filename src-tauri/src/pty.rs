use crate::terminal::{TerminalState, DEFAULT_COLS, DEFAULT_ROWS};
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde_json::json;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use tauri::Emitter;

const SHELL_READY_DELAY_MS: u64 = 300;
const READ_BUFFER_SIZE: usize = 8192;
const MAX_SESSIONS: usize = 64;

fn pty_size(cols: u16, rows: u16) -> PtySize {
    PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }
}

/// A single PTY session. The `generation` counter disambiguates sessions that
/// reuse the same ID, preventing a stale reader thread from cleaning up a
/// newly-created session.
struct PtySession {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    /// Retained after `take_writer()`/`try_clone_reader()` solely for `resize()`.
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
    generation: u64,
}

/// Thread-safe manager for PTY sessions. Each session is identified by a
/// string ID (typically a pane/tab ID). All methods are safe to call
/// concurrently from any thread.
pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
    next_generation: AtomicU64,
    terminal_state: Arc<TerminalState>,
}

impl PtyManager {
    pub fn new(terminal_state: Arc<TerminalState>) -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            next_generation: AtomicU64::new(1),
            terminal_state,
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

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(pty_size(DEFAULT_COLS as u16, DEFAULT_ROWS as u16))
            .map_err(|e| format!("Failed to open PTY: {e}"))?;

        let shell = std::env::var("SHELL").unwrap_or_else(|_| {
            if cfg!(windows) {
                "powershell.exe".to_string()
            } else {
                "/bin/sh".to_string()
            }
        });

        let mut cmd = CommandBuilder::new(&shell);
        if !cfg!(windows) {
            cmd.arg("-l");
        }
        cmd.cwd(&cwd);
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell: {e}"))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to get PTY writer: {e}"))?;
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to get PTY reader: {e}"))?;

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
            master: pair.master,
            child,
            generation,
        };
        self.lock_sessions()?.insert(id.clone(), session);

        // Create terminal state AFTER successful session insert to avoid orphaned
        // terminal entries if sessions lock is poisoned
        self.terminal_state.create(&id, DEFAULT_COLS, DEFAULT_ROWS);

        // Background reader thread: read PTY output → wezterm-term → emit grid snapshot
        let id_clone = id.clone();
        let sessions_clone = Arc::clone(&self.sessions);
        let term_state = Arc::clone(&self.terminal_state);
        std::thread::spawn(move || {
            let mut buf = [0u8; READ_BUFFER_SIZE];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        if let Some(snapshot) = term_state.advance_bytes(&id_clone, &buf[..n]) {
                            if app
                                .emit(
                                    "terminal:render",
                                    json!({ "id": &id_clone, "grid": snapshot }),
                                )
                                .is_err()
                            {
                                break;
                            }
                        } else {
                            eprintln!("[pty] Terminal state returned None for {id_clone} ({n} bytes dropped)");
                        }
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
                    Err(e) => {
                        eprintln!("[pty] Read error for {id_clone}: {e}");
                        break;
                    }
                }
            }

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
                session
                    .child
                    .wait()
                    .map(|s| s.exit_code() as i64)
                    .unwrap_or(-1)
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

    pub fn resize(&self, id: &str, cols: u16, rows: u16) -> Result<(), String> {
        // Silently ignore missing sessions — resize can race with tab close
        {
            let sessions = self.lock_sessions()?;
            if let Some(session) = sessions.get(id) {
                session
                    .master
                    .resize(pty_size(cols, rows))
                    .map_err(|e| format!("PTY resize failed: {e}"))?;
            }
        } // Drop sessions lock before acquiring terminals lock to prevent deadlock
        self.terminal_state.resize(id, cols as usize, rows as usize);
        Ok(())
    }

    pub fn kill(&self, id: &str) -> Result<(), String> {
        // Kill is idempotent — silently ignore missing sessions
        let mut sessions = self.lock_sessions()?;
        if let Some(mut session) = sessions.remove(id) {
            let _ = session.child.kill();
        }
        self.terminal_state.remove(id);
        Ok(())
    }

    /// Clean up all sessions on app shutdown.
    pub fn kill_all(&self) {
        let mut sessions = self.sessions.lock().unwrap_or_else(|e| e.into_inner());
        for (_id, mut session) in sessions.drain() {
            let _ = session.child.kill();
        }
        self.terminal_state.remove_all();
    }

    fn lock_sessions(&self) -> Result<MutexGuard<'_, HashMap<String, PtySession>>, String> {
        self.sessions
            .lock()
            .map_err(|e| format!("Session lock poisoned: {e}"))
    }
}
