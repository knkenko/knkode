//! Minimal Windows ConPTY wrapper.
//!
//! portable-pty sets `PSEUDOCONSOLE_WIN32_INPUT_MODE` (0x4) which tells ConPTY
//! to expect `INPUT_RECORD` binary structures on the input pipe. Our app writes
//! UTF-8 bytes, causing ConPTY to stall output. This module wraps the ConPTY API
//! directly with no flags (no `PSEUDOCONSOLE_WIN32_INPUT_MODE`, no
//! `PSEUDOCONSOLE_INHERIT_CURSOR`).

use std::ffi::OsString;
use std::io::{self, Error as IoError, Read, Write};
use std::mem;
use std::os::windows::ffi::OsStrExt;
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
use std::ptr;
use std::sync::Mutex;

use winapi::shared::minwindef::DWORD;
use winapi::shared::winerror::S_OK;
use winapi::um::handleapi::INVALID_HANDLE_VALUE;
use winapi::um::namedpipeapi::CreatePipe;
use winapi::um::processthreadsapi::{
    CreateProcessW, GetExitCodeProcess, GetProcessId, TerminateProcess, PROCESS_INFORMATION,
};
use winapi::um::synchapi::WaitForSingleObject;
use winapi::um::winbase::{
    CREATE_UNICODE_ENVIRONMENT, EXTENDED_STARTUPINFO_PRESENT, INFINITE, STARTUPINFOEXW,
};
use winapi::um::wincon::COORD;
use winapi::um::winnt::HANDLE;

// ConPTY function signatures — loaded from kernel32.dll.
// These MUST match the Win32 SDK definitions exactly (used with mem::transmute).
// See: https://learn.microsoft.com/en-us/windows/console/createpseudoconsole
type CreatePseudoConsoleFn =
    unsafe extern "system" fn(COORD, HANDLE, HANDLE, DWORD, *mut HANDLE) -> i32;
type ResizePseudoConsoleFn = unsafe extern "system" fn(HANDLE, COORD) -> i32;
type ClosePseudoConsoleFn = unsafe extern "system" fn(HANDLE);

// PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE = 0x00020016
const PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE: usize = 0x00020016;

struct ConPtyFuncs {
    create: CreatePseudoConsoleFn,
    resize: ResizePseudoConsoleFn,
    close: ClosePseudoConsoleFn,
}

fn load_conpty() -> Result<ConPtyFuncs, &'static str> {
    use winapi::um::libloaderapi::{GetProcAddress, LoadLibraryW};

    unsafe {
        let name: Vec<u16> = OsString::from("kernel32.dll")
            .encode_wide()
            .chain(Some(0))
            .collect();
        let module = LoadLibraryW(name.as_ptr());
        if module.is_null() {
            return Err("Failed to load kernel32.dll");
        }

        let create = GetProcAddress(module, b"CreatePseudoConsole\0".as_ptr() as *const _);
        let resize = GetProcAddress(module, b"ResizePseudoConsole\0".as_ptr() as *const _);
        let close = GetProcAddress(module, b"ClosePseudoConsole\0".as_ptr() as *const _);

        if create.is_null() || resize.is_null() || close.is_null() {
            return Err("ConPTY not available — Windows 10 October 2018 or newer is required");
        }

        // SAFETY: null checks above guarantee valid pointers. The type aliases
        // (lines 32-35) must match the Win32 SDK signatures exactly — see:
        // https://learn.microsoft.com/en-us/windows/console/createpseudoconsole
        Ok(ConPtyFuncs {
            create: mem::transmute(create),
            resize: mem::transmute(resize),
            close: mem::transmute(close),
        })
    }
}

static CONPTY: std::sync::LazyLock<Result<ConPtyFuncs, &'static str>> =
    std::sync::LazyLock::new(load_conpty);

fn conpty() -> Result<&'static ConPtyFuncs, String> {
    CONPTY.as_ref().map_err(|e| e.to_string())
}

/// Clamp a `usize` length to `DWORD` range to prevent truncation on 64-bit platforms.
fn clamp_to_dword(len: usize) -> DWORD {
    len.min(u32::MAX as usize) as DWORD
}

fn coord(cols: u16, rows: u16) -> COORD {
    COORD {
        X: cols as i16,
        Y: rows as i16,
    }
}

/// A Windows pseudoconsole session.
///
/// `hpc` is behind a `Mutex<Option<>>` because concurrent `resize()` calls
/// (which take `&self`) must be serialized. `Drop` uses `get_mut()` for
/// exclusive access and `take()`s the handle to prevent use-after-close.
pub struct WinPtySession {
    hpc: Mutex<Option<HANDLE>>,
    process: OwnedHandle,
    pid: u32,
}

// SAFETY: All fields are safe to send across threads:
// - `hpc` is guarded by Mutex (shared access via lock(), exclusive via get_mut())
// - `process` (`OwnedHandle`) is only mutated behind `&mut self` (`kill()`)
// - `pid` is `Copy`
// Concurrent `wait()` + `resize()` touch different Win32 handles (process vs hpc),
// which is safe per the Win32 API contract (kernel handles are thread-safe).
unsafe impl Send for WinPtySession {}
unsafe impl Sync for WinPtySession {}

/// Pipe pair for ConPTY I/O.
pub struct WinPtyPipes {
    pub reader: PipeReader,
    pub writer: PipeWriter,
}

pub struct PipeReader {
    handle: OwnedHandle,
}

impl Read for PipeReader {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        use winapi::um::fileapi::ReadFile;
        let len = clamp_to_dword(buf.len());
        let mut bytes_read: DWORD = 0;
        let ok = unsafe {
            ReadFile(
                self.handle.as_raw_handle() as _,
                buf.as_mut_ptr() as _,
                len,
                &mut bytes_read,
                ptr::null_mut(),
            )
        };
        if ok == 0 {
            let err = IoError::last_os_error();
            if err.raw_os_error() == Some(109) {
                // ERROR_BROKEN_PIPE — EOF
                Ok(0)
            } else {
                Err(err)
            }
        } else {
            Ok(bytes_read as usize)
        }
    }
}

pub struct PipeWriter {
    handle: OwnedHandle,
}

impl Write for PipeWriter {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        use winapi::um::fileapi::WriteFile;
        let len = clamp_to_dword(buf.len());
        let mut bytes_written: DWORD = 0;
        let ok = unsafe {
            WriteFile(
                self.handle.as_raw_handle() as _,
                buf.as_ptr() as _,
                len,
                &mut bytes_written,
                ptr::null_mut(),
            )
        };
        if ok == 0 {
            Err(IoError::last_os_error())
        } else {
            Ok(bytes_written as usize)
        }
    }

    fn flush(&mut self) -> io::Result<()> {
        use winapi::um::fileapi::FlushFileBuffers;
        let ok = unsafe { FlushFileBuffers(self.handle.as_raw_handle() as _) };
        if ok == 0 {
            Err(IoError::last_os_error())
        } else {
            Ok(())
        }
    }
}

fn create_pipe() -> io::Result<(OwnedHandle, OwnedHandle)> {
    let mut read_handle: HANDLE = ptr::null_mut();
    let mut write_handle: HANDLE = ptr::null_mut();
    let ok = unsafe { CreatePipe(&mut read_handle, &mut write_handle, ptr::null_mut(), 0) };
    if ok == 0 {
        return Err(IoError::last_os_error());
    }
    unsafe {
        Ok((
            OwnedHandle::from_raw_handle(read_handle as _),
            OwnedHandle::from_raw_handle(write_handle as _),
        ))
    }
}

impl WinPtySession {
    /// Create a new ConPTY session and spawn the given command.
    ///
    /// Sets no flags — no `PSEUDOCONSOLE_WIN32_INPUT_MODE`, no
    /// `PSEUDOCONSOLE_INHERIT_CURSOR`.
    pub fn spawn(
        cols: u16,
        rows: u16,
        exe: &str,
        cwd: &str,
        env_vars: &[(&str, &str)],
    ) -> Result<(Self, WinPtyPipes), String> {
        // Create pipes: pty_in feeds the pseudoconsole input, pty_out receives output
        let (pty_in_read, pty_in_write) =
            create_pipe().map_err(|e| format!("Failed to create input pipe: {e}"))?;
        let (pty_out_read, pty_out_write) =
            create_pipe().map_err(|e| format!("Failed to create output pipe: {e}"))?;

        let size = coord(cols, rows);

        // Create pseudoconsole with no flags (matches node-pty behavior).
        // PSEUDOCONSOLE_INHERIT_CURSOR (0x1) can hang when no parent console exists.
        let funcs = conpty()?;
        let mut hpc: HANDLE = INVALID_HANDLE_VALUE;
        let result = unsafe {
            (funcs.create)(
                size,
                pty_in_read.as_raw_handle() as _,
                pty_out_write.as_raw_handle() as _,
                0, // no flags
                &mut hpc,
            )
        };
        if result != S_OK {
            return Err(format!(
                "CreatePseudoConsole failed: HRESULT 0x{:08x}",
                result
            ));
        }

        // Inner helper that owns hpc cleanup on error. Factored out so that
        // early returns in the middle of spawn() don't leak the pseudoconsole.
        let spawn_inner = |hpc: HANDLE| -> Result<(PROCESS_INFORMATION, Vec<u8>), String> {
            // Set up process thread attribute list with the pseudoconsole
            let mut attr_size: usize = 0;
            unsafe {
                use winapi::um::processthreadsapi::InitializeProcThreadAttributeList;
                InitializeProcThreadAttributeList(ptr::null_mut(), 1, 0, &mut attr_size);
            }
            let mut attr_buf = vec![0u8; attr_size];
            let attr_list = attr_buf.as_mut_ptr() as *mut _;
            unsafe {
                use winapi::um::processthreadsapi::InitializeProcThreadAttributeList;
                let ok = InitializeProcThreadAttributeList(attr_list, 1, 0, &mut attr_size);
                if ok == 0 {
                    return Err(format!(
                        "InitializeProcThreadAttributeList failed: {}",
                        IoError::last_os_error()
                    ));
                }
            }
            // attr_list is now initialized — must call Delete before returning.
            let result = (|| -> Result<PROCESS_INFORMATION, String> {
                unsafe {
                    use winapi::um::processthreadsapi::UpdateProcThreadAttribute;
                    let ok = UpdateProcThreadAttribute(
                        attr_list,
                        0,
                        PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE,
                        hpc as _,
                        mem::size_of::<HANDLE>(),
                        ptr::null_mut(),
                        ptr::null_mut(),
                    );
                    if ok == 0 {
                        return Err(format!(
                            "UpdateProcThreadAttribute failed: {}",
                            IoError::last_os_error()
                        ));
                    }
                }

                // Close the ConPTY-side pipe ends now — they are duplicated inside the
                // pseudoconsole. Must happen before CreateProcessW (matches MS sample).
                drop(pty_in_read);
                drop(pty_out_write);

                // Build environment block (null-separated, double-null terminated)
                let env_block = build_env_block(env_vars);

                // Build command line and CWD as wide strings
                let exe_wide: Vec<u16> = OsString::from(exe).encode_wide().chain(Some(0)).collect();
                let cwd_wide: Vec<u16> = OsString::from(cwd).encode_wide().chain(Some(0)).collect();

                let mut si: STARTUPINFOEXW = unsafe { mem::zeroed() };
                si.StartupInfo.cb = mem::size_of::<STARTUPINFOEXW>() as u32;
                si.lpAttributeList = attr_list as _;

                let mut pi: PROCESS_INFORMATION = unsafe { mem::zeroed() };
                let mut cmdline = exe_wide.clone();

                let ok = unsafe {
                    CreateProcessW(
                        ptr::null(),
                        cmdline.as_mut_ptr(),
                        ptr::null_mut(),
                        ptr::null_mut(),
                        0, // don't inherit handles
                        EXTENDED_STARTUPINFO_PRESENT | CREATE_UNICODE_ENVIRONMENT,
                        env_block.as_ptr() as *mut _,
                        cwd_wide.as_ptr(),
                        &mut si.StartupInfo,
                        &mut pi,
                    )
                };

                if ok == 0 {
                    return Err(format!(
                        "CreateProcessW failed: {}",
                        IoError::last_os_error()
                    ));
                }
                Ok(pi)
            })();

            // Always clean up attribute list, whether inner succeeded or failed
            unsafe {
                use winapi::um::processthreadsapi::DeleteProcThreadAttributeList;
                DeleteProcThreadAttributeList(attr_list);
            }

            result.map(|pi| (pi, attr_buf))
        };

        let pi = match spawn_inner(hpc) {
            Ok((pi, _attr_buf)) => pi,
            Err(e) => {
                unsafe { (funcs.close)(hpc) };
                return Err(e);
            }
        };

        // Close thread handle, keep process handle
        let _thread = unsafe { OwnedHandle::from_raw_handle(pi.hThread as _) };
        let process = unsafe { OwnedHandle::from_raw_handle(pi.hProcess as _) };
        let pid = unsafe { GetProcessId(process.as_raw_handle() as _) };
        if pid == 0 {
            eprintln!(
                "[win_pty] GetProcessId returned 0: {}",
                IoError::last_os_error()
            );
        }

        Ok((
            WinPtySession {
                hpc: Mutex::new(Some(hpc)),
                process,
                pid,
            },
            WinPtyPipes {
                reader: PipeReader {
                    handle: pty_out_read,
                },
                writer: PipeWriter {
                    handle: pty_in_write,
                },
            },
        ))
    }

    pub fn pid(&self) -> u32 {
        self.pid
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        let funcs = conpty()?;
        // Surface poisoning to caller — normal operations should not hide panics.
        // (Drop recovers from poison via get_mut() because cleanup must always run.)
        let guard = self
            .hpc
            .lock()
            .map_err(|e| format!("hpc lock poisoned: {e}"))?;
        let hpc = guard.ok_or("pseudoconsole already closed")?;
        let result = unsafe { (funcs.resize)(hpc, coord(cols, rows)) };
        if result != S_OK {
            Err(format!(
                "ResizePseudoConsole failed: HRESULT 0x{:08x}",
                result
            ))
        } else {
            Ok(())
        }
    }

    pub fn kill(&mut self) {
        let ok = unsafe { TerminateProcess(self.process.as_raw_handle() as _, 1) };
        if ok == 0 {
            let err = IoError::last_os_error();
            // ERROR_ACCESS_DENIED (5) is expected if the process already exited
            if err.raw_os_error() != Some(5) {
                eprintln!(
                    "[win_pty] TerminateProcess failed (pid {}): {err}",
                    self.pid
                );
            }
        }
    }

    pub fn wait(&self) -> i64 {
        unsafe {
            let wait_result = WaitForSingleObject(self.process.as_raw_handle() as _, INFINITE);
            if wait_result == 0xFFFF_FFFF {
                eprintln!(
                    "[win_pty] WaitForSingleObject failed (pid {}): {}",
                    self.pid,
                    IoError::last_os_error()
                );
                return -1;
            }
            let mut code: DWORD = 0;
            let ok = GetExitCodeProcess(self.process.as_raw_handle() as _, &mut code);
            if ok == 0 {
                eprintln!(
                    "[win_pty] GetExitCodeProcess failed (pid {}): {}",
                    self.pid,
                    IoError::last_os_error()
                );
                return -1;
            }
            code as i64
        }
    }
}

impl Drop for WinPtySession {
    fn drop(&mut self) {
        match conpty() {
            Ok(funcs) => {
                // get_mut() is safe here — Drop has exclusive &mut self access.
                // unwrap_or_else recovers from a poisoned Mutex (best-effort cleanup).
                let hpc = self.hpc.get_mut().unwrap_or_else(|e| e.into_inner());
                if let Some(handle) = hpc.take() {
                    unsafe {
                        (funcs.close)(handle);
                    }
                }
            }
            Err(e) => {
                // Unreachable: if a WinPtySession exists, spawn() succeeded,
                // which means conpty() returned Ok — and LazyLock caches the result.
                eprintln!("[win_pty] Drop: cannot close pseudoconsole — {e}");
            }
        }
    }
}

/// Build a Windows environment block from key-value pairs.
/// Inherits the current process environment and overrides with the given vars.
fn build_env_block(overrides: &[(&str, &str)]) -> Vec<u16> {
    use std::collections::BTreeMap;
    use std::env;

    let mut env_map: BTreeMap<String, String> = env::vars().collect();
    for (k, v) in overrides {
        env_map.insert(k.to_string(), v.to_string());
    }

    let mut block = Vec::new();
    for (k, v) in &env_map {
        let entry = format!("{k}={v}");
        block.extend(OsString::from(&entry).encode_wide());
        block.push(0);
    }
    block.push(0); // double-null terminator
    block
}
