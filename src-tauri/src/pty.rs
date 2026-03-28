use crate::terminal::{
    TerminalState, DEFAULT_CELL_PIXEL_HEIGHT, DEFAULT_CELL_PIXEL_WIDTH, DEFAULT_COLS, DEFAULT_ROWS,
};
#[cfg(not(target_os = "windows"))]
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde_json::json;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex, MutexGuard};
use std::time::{Duration, Instant};
use tauri::Emitter;

const SHELL_READY_DELAY_MS: u64 = 300;
const READ_BUFFER_SIZE: usize = 8192;
const MAX_SESSIONS: usize = 64;
/// Minimum interval between render events per terminal (~60fps).
/// During high-throughput output the reader advances terminal state on every
/// chunk but only snapshots + emits at this cadence, preventing UI freezes.
const RENDER_INTERVAL: Duration = Duration::from_millis(16);

/// RAII guard for Windows HANDLEs — calls `CloseHandle` on drop.
#[cfg(target_os = "windows")]
struct WinHandle(winapi::shared::ntdef::HANDLE);

#[cfg(target_os = "windows")]
impl Drop for WinHandle {
    fn drop(&mut self) {
        unsafe {
            winapi::um::handleapi::CloseHandle(self.0);
        }
    }
}

/// Detect the CWD of a child process via `proc_pidinfo(PROC_PIDVNODEPATHINFO)`.
/// Single kernel syscall — replaces the previous `lsof` fork+exec+parse which
/// spawned a full subprocess every poll cycle per pane.
///
/// Uses `libc::proc_vnodepathinfo` struct for type-safe field access.
#[cfg(target_os = "macos")]
fn detect_cwd(pid: u32) -> Option<String> {
    use std::ffi::CStr;
    use std::mem::{self, MaybeUninit};

    let pid = i32::try_from(pid).ok()?;
    let mut info = MaybeUninit::<libc::proc_vnodepathinfo>::uninit();
    let expected = mem::size_of::<libc::proc_vnodepathinfo>() as libc::c_int;

    let ret = unsafe {
        libc::proc_pidinfo(
            pid,
            libc::PROC_PIDVNODEPATHINFO,
            0,
            info.as_mut_ptr() as *mut libc::c_void,
            expected,
        )
    };

    // Require full struct fill — partial return means uninitialized fields
    if ret < expected {
        return None;
    }

    let info = unsafe { info.assume_init() };
    // vip_path is [[c_char; 32]; 32] in libc (workaround for old MSRV) — flatten to &[u8]
    let path_bytes: &[u8] = unsafe {
        std::slice::from_raw_parts(
            info.pvi_cdir.vip_path.as_ptr() as *const u8,
            mem::size_of_val(&info.pvi_cdir.vip_path),
        )
    };
    let cstr = CStr::from_bytes_until_nul(path_bytes).ok()?;
    let path = cstr.to_str().ok()?;
    if path.is_empty() {
        return None;
    }
    Some(path.to_string())
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

/// Detect the CWD of a child process on Windows by reading the process's PEB
/// (Process Environment Block) via `NtQueryInformationProcess` + `ReadProcessMemory`.
///
/// Offsets are for 64-bit processes only. 32-bit Windows is not supported.
///   PEB + 0x20 → ProcessParameters (RTL_USER_PROCESS_PARAMETERS*)
///   ProcessParameters + 0x38 → CurrentDirectory.DosPath (UNICODE_STRING)
#[cfg(target_os = "windows")]
#[cfg(target_arch = "x86_64")]
fn detect_cwd(pid: u32) -> Option<String> {
    use std::mem;
    use std::ptr;
    use winapi::shared::minwindef::FALSE;
    use winapi::shared::ntdef::HANDLE;
    use winapi::um::memoryapi::ReadProcessMemory;
    use winapi::um::processthreadsapi::OpenProcess;
    use winapi::um::winnt::{PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};

    /// Max CWD path length in bytes (extended-length paths: 32767 chars * 2 bytes).
    const MAX_CWD_BYTES: usize = 65534;

    // NtQueryInformationProcess is not exposed by winapi 0.3 — declare manually.
    // Links to ntdll.dll implicitly. Can be removed if migrating to the `windows` crate.
    #[repr(C)]
    struct ProcessBasicInformation {
        reserved1: *mut std::ffi::c_void,
        peb_base_address: *mut std::ffi::c_void,
        reserved2: [*mut std::ffi::c_void; 2],
        unique_process_id: usize,
        reserved3: *mut std::ffi::c_void,
    }

    extern "system" {
        fn NtQueryInformationProcess(
            process_handle: HANDLE,
            process_information_class: u32,
            process_information: *mut std::ffi::c_void,
            process_information_length: u32,
            return_length: *mut u32,
        ) -> i32;
    }

    /// Read `buf.len()` bytes from `address` in the target process.
    unsafe fn read_mem(handle: HANDLE, address: usize, buf: &mut [u8]) -> bool {
        ReadProcessMemory(
            handle,
            address as *const _,
            buf.as_mut_ptr() as *mut _,
            buf.len(),
            ptr::null_mut(),
        ) != FALSE
    }

    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, pid);
        if handle.is_null() {
            eprintln!(
                "[pty] detect_cwd: OpenProcess failed for pid {pid}: {}",
                std::io::Error::last_os_error()
            );
            return None;
        }
        let _guard = WinHandle(handle);

        // Step 1: Get PEB address via NtQueryInformationProcess
        let mut pbi: ProcessBasicInformation = mem::zeroed();
        let mut ret_len: u32 = 0;
        let status = NtQueryInformationProcess(
            handle,
            0, // ProcessBasicInformation
            &mut pbi as *mut _ as *mut std::ffi::c_void,
            mem::size_of::<ProcessBasicInformation>() as u32,
            &mut ret_len,
        );
        if status != 0 {
            eprintln!("[pty] detect_cwd: NtQueryInformationProcess failed for pid {pid}: NTSTATUS 0x{status:08X}");
            return None;
        }
        let peb_addr = pbi.peb_base_address as usize;
        if peb_addr == 0 {
            eprintln!("[pty] detect_cwd: PEB address is null for pid {pid}");
            return None;
        }

        // Step 2: Read ProcessParameters pointer from PEB + 0x20
        let mut buf = [0u8; 8];
        if !read_mem(handle, peb_addr + 0x20, &mut buf) {
            eprintln!("[pty] detect_cwd: failed to read ProcessParameters for pid {pid}");
            return None;
        }
        let params_ptr = usize::from_ne_bytes(buf);
        if params_ptr == 0 {
            eprintln!("[pty] detect_cwd: ProcessParameters is null for pid {pid}");
            return None;
        }

        // Step 3: Read CurrentDirectory.DosPath (UNICODE_STRING) at ProcessParameters + 0x38
        // UNICODE_STRING layout (64-bit): Length(u16) + MaxLength(u16) + pad(4) + Buffer(u64)
        let mut us_buf = [0u8; 16];
        if !read_mem(handle, params_ptr + 0x38, &mut us_buf) {
            eprintln!("[pty] detect_cwd: failed to read UNICODE_STRING for pid {pid}");
            return None;
        }
        let length = u16::from_ne_bytes([us_buf[0], us_buf[1]]) as usize;
        let buffer_ptr = usize::from_ne_bytes(us_buf[8..16].try_into().unwrap());

        // Validate: length must be even (UTF-16), non-zero, within bounds, and buffer non-null
        if length == 0 || length % 2 != 0 || length > MAX_CWD_BYTES || buffer_ptr == 0 {
            return None;
        }

        // Step 4: Read the wide-character path string
        let mut path_buf = vec![0u8; length];
        if !read_mem(handle, buffer_ptr, &mut path_buf) {
            eprintln!("[pty] detect_cwd: failed to read path buffer for pid {pid}");
            return None;
        }

        // Convert from UTF-16LE to String — fail on invalid UTF-16 rather than
        // silently inserting replacement characters that produce garbled paths.
        let wide: Vec<u16> = path_buf
            .chunks_exact(2)
            .map(|c| u16::from_ne_bytes([c[0], c[1]]))
            .collect();
        let path = String::from_utf16(&wide).ok()?;

        // Strip trailing backslash (e.g. "C:\Users\foo\" → "C:\Users\foo")
        // but keep root drive paths like "C:\" intact.
        let trimmed = path.trim_end_matches('\\');
        if trimmed.ends_with(':') {
            Some(path)
        } else {
            Some(trimmed.to_string())
        }
    }
}

/// Fallback for 32-bit Windows (unsupported — PEB offsets differ).
#[cfg(target_os = "windows")]
#[cfg(not(target_arch = "x86_64"))]
fn detect_cwd(_pid: u32) -> Option<String> {
    None
}

/// Catch-all for platforms without CWD detection (FreeBSD, etc.).
#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn detect_cwd(_pid: u32) -> Option<String> {
    None
}

/// Check foreground process status for multiple shell PIDs via `sysctl(KERN_PROC)`.
///
/// For each PID, a single `sysctl` syscall retrieves `kinfo_proc` which contains
/// `e_pgid` (shell's process group) and `e_tpgid` (terminal's foreground group).
/// If they differ, another process group owns the foreground → child is running.
///
/// Replaces the previous `ps` subprocess which forked every 3 seconds.
///
/// Returns a map from PID to `true` (foreground child running) / `false` (idle).
/// PIDs where detection fails (exited, not found) are omitted.
#[cfg(target_os = "macos")]
fn check_foreground_all(pids: &[(String, u32)]) -> HashMap<u32, bool> {
    if pids.is_empty() {
        return HashMap::new();
    }

    let mut result = HashMap::with_capacity(pids.len());
    for &(_, pid) in pids {
        if let Some(has_child) = check_foreground_sysctl(pid) {
            result.insert(pid, has_child);
        }
    }
    result
}

/// Check if a single process has a foreground child via sysctl(KERN_PROC_PID).
///
/// kinfo_proc layout (verified via offsetof() on arm64 macOS):
///   kp_proc  (extern_proc) at offset 0
///   kp_eproc (eproc)       at offset 296
///     e_pgid  at absolute offset 564 (pid_t, 4 bytes)
///     e_tpgid at absolute offset 576 (pid_t, 4 bytes)
///
/// If e_tpgid != e_pgid, another process group is in the foreground.
///
/// Note: offsets are verified on arm64. On x86_64 they may differ due to
/// alignment — if this crate is built for x86_64, verify with offsetof().
#[cfg(target_os = "macos")]
fn check_foreground_sysctl(pid: u32) -> Option<bool> {
    use std::mem::MaybeUninit;
    // kinfo_proc is 648 bytes on arm64 macOS.
    // Offsets verified via offsetof() on arm64:
    //   kp_eproc at 296, e_pgid at 564, e_tpgid at 576.
    const KINFO_PROC_SIZE: usize = 648;
    const E_PGID_OFFSET: usize = 564;
    const E_TPGID_OFFSET: usize = 576;

    let pid = i32::try_from(pid).ok()?;
    let mut mib: [libc::c_int; 4] = [libc::CTL_KERN, libc::KERN_PROC, libc::KERN_PROC_PID, pid];
    let mut buf = MaybeUninit::<[u8; KINFO_PROC_SIZE]>::uninit();
    let mut size: libc::size_t = KINFO_PROC_SIZE;

    let ret = unsafe {
        libc::sysctl(
            mib.as_mut_ptr(),
            4,
            buf.as_mut_ptr() as *mut libc::c_void,
            &mut size,
            std::ptr::null_mut(),
            0,
        )
    };

    if ret != 0 || size < KINFO_PROC_SIZE {
        return None;
    }

    let buf = unsafe { buf.assume_init() };
    let e_pgid = i32::from_ne_bytes(buf[E_PGID_OFFSET..E_PGID_OFFSET + 4].try_into().ok()?);
    let e_tpgid = i32::from_ne_bytes(buf[E_TPGID_OFFSET..E_TPGID_OFFSET + 4].try_into().ok()?);

    // tpgid == 0 means no controlling terminal — can't determine foreground
    if e_tpgid == 0 {
        return None;
    }

    // If terminal foreground group != shell's group, a child process is running
    Some(e_tpgid != e_pgid)
}

/// Check foreground process status on Linux by reading `/proc/<pid>/stat`.
///
/// No subprocess is spawned — each PID is checked via procfs.
/// Compares field 5 (pgrp) against field 8 (tpgid): if tpgid != pgrp,
/// another process group owns the terminal foreground.
#[cfg(target_os = "linux")]
fn check_foreground_all(pids: &[(String, u32)]) -> HashMap<u32, bool> {
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
///
/// Note: Windows reuses PIDs aggressively. If a shell exits and its PID is
/// reassigned, stale `th32ParentProcessID` entries may cause brief false positives.
#[cfg(target_os = "windows")]
fn check_foreground_all(pids: &[(String, u32)]) -> HashMap<u32, bool> {
    use winapi::um::handleapi::INVALID_HANDLE_VALUE;
    use winapi::um::tlhelp32::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    if pids.is_empty() {
        return HashMap::new();
    }

    // Pre-fill result with false (idle) for every shell PID; flip to true during walk
    let mut result: HashMap<u32, bool> = HashMap::with_capacity(pids.len());
    for &(_, pid) in pids {
        result.insert(pid, false);
    }

    // SAFETY: CreateToolhelp32Snapshot returns INVALID_HANDLE_VALUE or a valid
    // handle. PROCESSENTRY32W is safely zeroable (all-integer + fixed-size array).
    // WinHandle ensures CloseHandle is called exactly once.
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == INVALID_HANDLE_VALUE {
            eprintln!(
                "[pty] CreateToolhelp32Snapshot failed ({}) — foreground detection unavailable",
                std::io::Error::last_os_error()
            );
            return result;
        }
        let _guard = WinHandle(snapshot);

        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

        if Process32FirstW(snapshot, &mut entry) != 0 {
            loop {
                if let Some(active) = result.get_mut(&entry.th32ParentProcessID) {
                    *active = true;
                }
                if Process32NextW(snapshot, &mut entry) == 0 {
                    break;
                }
            }
        } else {
            eprintln!(
                "[pty] Process32FirstW failed ({}) — activity detection may be inaccurate",
                std::io::Error::last_os_error()
            );
        }
    }

    result
}

/// Unsupported platform — foreground detection unavailable.
#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn check_foreground_all(_pids: &[(String, u32)]) -> HashMap<u32, bool> {
    HashMap::new()
}

/// Emit a terminal render snapshot to the frontend.
/// Returns `true` if the emit succeeded or there was nothing to emit,
/// `false` if the Tauri event channel is broken.
///
/// Also checks for terminal title changes (OSC 1/2) and emits
/// `pty:title-changed` when the title differs from the previously observed
/// value. Title is read under the same lock as the snapshot to avoid a
/// redundant lock acquisition on the hot path.
fn emit_snapshot(app: &tauri::AppHandle, term_state: &TerminalState, id: &str) -> bool {
    if let Some((snapshot, title_changed)) = term_state.snapshot_and_title(id) {
        if let Some(title) = title_changed {
            if let Err(e) = app.emit("pty:title-changed", json!({ "paneId": id, "title": title })) {
                eprintln!("[pty] Failed to emit title-changed for {id}: {e}");
            }
        }
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
    cmd.env("COLORTERM", "truecolor");

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

    let env_vars = [("TERM", "xterm-256color"), ("COLORTERM", "truecolor")];
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
    /// Timestamp of the last PTY output per pane.
    /// Reader threads update on each render; the tracker polls to detect idle agents.
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

        // Clone writer for the reader thread to route terminal responses back to PTY
        let pty_writer = Arc::clone(&writer);

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

        // Shared state between reader and flush threads.
        // `dirty`: set when terminal state advances but no snapshot was emitted (throttled).
        // `alive`: cleared when the reader exits so the flush thread can stop.
        // `flush_cond`: wakes the flush thread when throttled data is pending, replacing
        // the previous 16ms sleep-poll that caused ~60 idle wakeups/sec per session.
        let dirty = Arc::new(AtomicBool::new(false));
        let alive = Arc::new(AtomicBool::new(true));
        let flush_cond = Arc::new((Mutex::new(()), Condvar::new()));

        // Trailing-edge flush thread: ensures the screen always shows the latest
        // state after a data burst ends. Without this, the last chunk in a burst
        // gets throttled and the reader blocks on read(), leaving the screen stale.
        // Uses condvar instead of sleep-poll — zero wakeups when idle.
        {
            let dirty_flush = Arc::clone(&dirty);
            let alive_flush = Arc::clone(&alive);
            let cond = Arc::clone(&flush_cond);
            let term_state = Arc::clone(&self.terminal_state);
            let id_flush = id.clone();
            let app_flush = app.clone();
            std::thread::spawn(move || {
                let (lock, cv) = &*cond;
                while alive_flush.load(Ordering::Relaxed) {
                    // Wait until notified by reader or timeout — zero CPU when idle.
                    // Mutex exists only to satisfy condvar API; the bool is in `dirty`.
                    let guard = lock.lock().unwrap_or_else(|e| {
                        eprintln!("[pty] flush condvar mutex poisoned, recovering");
                        e.into_inner()
                    });
                    let _ = cv
                        .wait_timeout(guard, RENDER_INTERVAL)
                        .unwrap_or_else(|e| e.into_inner());
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
        let last_output_at = Arc::clone(&self.last_output_at);
        let pty_writer_for_reader = pty_writer;
        std::thread::spawn(move || {
            eprintln!("[pty] Reader thread started for {id_clone}");
            let (_, cv) = &*flush_cond;
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
                        term_state.advance_only(&id_clone, &buf[..n]);

                        // Route terminal responses (DA, CPR, OSC replies) back to PTY.
                        // wezterm-term writes these to its writer during advance_bytes().
                        let responses = term_state.drain_responses(&id_clone);
                        if !responses.is_empty() {
                            match pty_writer_for_reader.lock() {
                                Ok(mut w) => {
                                    if let Err(e) = w.write_all(&responses) {
                                        eprintln!(
                                            "[pty] response write failed for {id_clone}: {e}"
                                        );
                                    }
                                    let _ = w.flush();
                                }
                                Err(e) => {
                                    eprintln!("[pty] writer lock failed for {id_clone}: {e}");
                                }
                            }
                        }

                        if last_emit.elapsed() >= RENDER_INTERVAL {
                            // Record output timestamp for activity detection.
                            // Throttled to ~60fps — sub-16ms precision is irrelevant
                            // given the 2-second idle threshold polled every 3 seconds.
                            let mut times =
                                last_output_at.lock().unwrap_or_else(|e| e.into_inner());
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
                            // Signal flush thread that dirty data is available
                            cv.notify_one();
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
            // Wake flush thread so it exits immediately instead of waiting up to 16ms
            cv.notify_one();

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
                last_output_at
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
    /// On macOS uses `lsof`; on Linux reads `/proc/<pid>/cwd`;
    /// on Windows reads the process PEB via `NtQueryInformationProcess`.
    /// Falls back to the initial CWD if detection fails.
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
    /// Sessions where detection fails (process exited, snapshot error) are omitted.
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

        let by_pid = check_foreground_all(&pids);

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
