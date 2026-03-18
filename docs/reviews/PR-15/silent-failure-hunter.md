# PR-15 Silent Failure Review: `feature/cwd-tracker`

## Summary

The CwdTracker introduces a background polling thread that silently swallows mutex-poisoning errors in at least 10 locations via `if let Ok(...)` guards, silently discards Tauri event-emission failures in 7 locations via `let _ = app.emit(...)`, and has two completely empty `ToolResult::Err => {}` arms that drop all context from git/gh CLI failures. The `create_pty` command tracks a pane before creating it, leaking tracker state when PTY creation fails.

## Must Fix

- **`src-tauri/src/tracker.rs:54,68`** -- `track_pane` and `untrack_pane` silently swallow mutex poison errors with `if let Ok(mut panes) = self.panes.lock()`. If the mutex is poisoned, pane tracking silently stops working. The user will never see CWD/branch/PR updates and will have no idea why. These are not recoverable conditions -- a poisoned mutex means a thread panicked while holding the lock. At minimum, log via `eprintln!` when the lock fails; ideally, propagate the error upward so the caller (commands.rs) can return an `Err` to the frontend.

- **`src-tauri/src/tracker.rs:119,141,155-162,166-176,189,204-212,218,237-247,275`** -- Inside the polling loop, there are approximately 10 `if let Ok(mut p) = panes.lock()` / `panes.lock().ok()` calls that silently ignore lock failure. Every one of these is a separate location where a poisoned mutex causes the tracker to silently skip updating state or checking PR status. A poisoned mutex is an unrecoverable condition that means internal data is corrupt. All of these should at minimum log when the lock fails. The two that use `break` on `Err(_)` (lines 94, 112) are slightly better because they kill the loop, but they do so without logging why.

- **`src-tauri/src/tracker.rs:262`** -- `ToolResult::Err => {}` in the git branch detection match arm. When `get_git_branch` returns `ToolResult::Err` (which happens on any `Err(_)` from `Command::new("git")...output()` that is NOT `NotFound`), the error is completely discarded. This could hide permission denied errors, out-of-memory failures, or I/O errors that prevent `git` from running. The user sees no branch info and has zero diagnostics. At minimum, the `Err` variant should carry a string and the match arm should log it.

- **`src-tauri/src/tracker.rs:233`** -- `ToolResult::Err => {}` in the PR detection match arm. Same as above but for `gh` CLI failures. When `get_pr_status` returns `ToolResult::Err` (which can come from JSON parse failures at line 383 or non-`NotFound` I/O errors at line 401), this arm discards it entirely. The JSON parse path does log before returning `ToolResult::Err`, but the I/O error path at line 401 (`Err(_) => ToolResult::Err`) drops the error before it even gets here.

- **`src-tauri/src/tracker.rs:326`** -- `Err(_) => ToolResult::Err` in `get_git_branch`. The actual `std::io::Error` is dropped. This could be `PermissionDenied`, `Other`, or any non-`NotFound` I/O error. The error message is permanently lost. The `ToolResult::Err` variant should carry `String` or `std::io::Error` so the caller can log it.

- **`src-tauri/src/tracker.rs:401`** -- `Err(_) => ToolResult::Err` in `get_pr_status`. Same issue: the `std::io::Error` is discarded before it ever reaches the caller.

- **`src-tauri/src/tracker.rs:284`** -- `ToolResult::Err` variant carries no payload. This is the root cause of the above issues. The `Err` variant should be `Err(String)` so that error context can flow from the detection functions to the logging code.

- **`src-tauri/src/commands.rs:79-80`** -- `tracker.track_pane` is called before `pty_mgr.create`. If `create` fails (e.g., PTY open failure, shell spawn failure, lock poisoning), the pane remains tracked in the CwdTracker with no corresponding PTY session. The polling loop will then repeatedly call `pty_manager.get_cwd(&pane_id)` for a nonexistent session, getting `None` every 3 seconds until the app exits. The fix is to move `tracker.track_pane` after the `pty_mgr.create()?` call, or add cleanup on the error path.

## Suggestions

- **`src-tauri/src/tracker.rs:124,146,178,214,249`** -- Seven `let _ = app.emit(...)` calls discard Tauri event emission failures. If the app handle is closed or the event system is broken, every CWD/branch/PR change notification will be silently lost. The frontend will show stale data with no indication of failure. Consider logging at debug level on emission failure, or at least logging once and setting a flag to avoid log spam.

- **`src-tauri/src/pty.rs:307-308`** -- `get_cwd` converts a `lock_sessions` `Err` into `None` via `.ok()?`. This means a poisoned mutex is indistinguishable from "no such pane." Since this is called every 3 seconds per pane by the tracker, a poisoned sessions mutex causes silent CWD detection failure for all panes with no log output. Consider logging the lock error instead of using `.ok()`.

- **`src-tauri/src/pty.rs:314`** -- `pid.and_then(detect_cwd).or(Some(fallback))` silently falls back to `initial_cwd` when `detect_cwd` fails. This fallback is documented and arguably intentional, but the user sees a stale CWD with no indication that live detection is failing. If `lsof` is broken or returning unexpected output, the fallback will mask the problem indefinitely. Consider logging at debug level on the first fallback occurrence per pane.

- **`src-tauri/src/pty.rs:18-32`** -- `detect_cwd` uses `.ok()?` on `Command::new("lsof")...output()` to discard the I/O error. If `lsof` is not found, permission-denied, or encounters any error, the function returns `None` with no logging. This makes it impossible to diagnose CWD detection failures on macOS. At least log the error when it is not `NotFound`.

- **`src-tauri/src/tracker.rs:362-363`** -- The PR title truncation at `&title[..MAX_PR_TITLE_LEN - 3]` performs byte-level slicing on a string that may contain multi-byte UTF-8 characters. If the 253rd byte falls inside a multi-byte character, this will panic at runtime. Use `title.chars().take(MAX_PR_TITLE_LEN - 3).collect::<String>()` or `title.char_indices()` to find a safe boundary.

- **`src-tauri/src/tracker.rs:358`** -- `url[..url.find(':').unwrap_or(10).min(20)]` also performs byte-level slicing and can panic on multi-byte URLs. Though unlikely for URL protocol prefixes, this is still a latent panic in a background thread that would kill the entire tracker.

- **`src-tauri/src/tracker.rs:94,112`** -- `Err(_) => break` on poisoned pane mutex exits the polling loop without any logging. The tracker thread silently dies. The user loses all CWD/branch/PR tracking with no error message anywhere. Add `eprintln!("[tracker] Pane mutex poisoned, stopping tracker")` before the break.

## Nitpicks

- **`src-tauri/src/tracker.rs:88`** -- `gh_logged_errors: HashSet<String>` grows unboundedly. If `gh` produces many distinct error messages over a long-running session, this set will consume memory without limit. Consider using a bounded cache (e.g., keep only the last N errors).

- **`src-tauri/src/tracker.rs:408`** -- `std::env::var("PATH").unwrap_or_default()` silently uses an empty PATH if the environment variable is not set. While unlikely, this would cause all CLI tool lookups to fail (only the EXTRA_PATH_DIRS would be searched). A debug log would help diagnose this edge case.

- **`src-tauri/src/pty.rs:159`** -- `let _ = w.flush()` in the startup command thread silently discards flush errors. If the flush fails, the startup command may not have been sent to the shell, but the user will see no error.
