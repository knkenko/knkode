## Summary

Adds a `CwdTracker` module that polls per-pane working directories, git branches, and GitHub PR status on a background thread. The code compiles cleanly (no `cargo check` or `clippy` warnings), and the overall architecture is sound -- mutex scoping is careful, generation counters prevent stale cleanup, and tool-missing detection with retry backoff is well-designed. The main concerns are **panicking byte-index string slices on untrusted Unicode input** and a **tracking inconsistency when PTY creation fails**.

## Must Fix

- **`tracker.rs:362-363`** -- `&title[..MAX_PR_TITLE_LEN - 3]` performs byte slicing on a PR title that can contain arbitrary Unicode (emoji, CJK, etc.). If byte 253 falls inside a multi-byte UTF-8 character, this panics at runtime. Use `title.char_indices()` to find a safe truncation point, or use `title.chars().take(N).collect::<String>()`.

- **`tracker.rs:358`** -- `&url[..url.find(':').unwrap_or(10).min(20)]` byte-slices a string. While URL schemes are typically ASCII, the `unwrap_or(10)` fallback path could slice into non-ASCII if a malformed URL contains multibyte characters before position 10. Use `.get(..n).unwrap_or(&url)` or `chars()` for safety.

- **`tracker.rs:379-380`** -- `&String::from_utf8_lossy(&output.stdout)[..200.min(output.stdout.len())]` slices the lossy-decoded string using the **raw byte length** of `output.stdout`. `from_utf8_lossy` can expand invalid bytes into 3-byte replacement characters, so the decoded string can be longer than `output.stdout.len()` bytes, and byte index 200 may split a replacement character boundary. Replace with a char-safe truncation or just use `.get(..200).unwrap_or(&s)`.

- **`tracker.rs:394`** -- `&stderr[..200.min(stderr.len())]` -- while `stderr.len()` is from the same string (so no out-of-bounds), byte 200 can still land inside a multi-byte character, causing a panic. Same fix: use `.get(..200).unwrap_or(&stderr)` which returns the whole string if 200 is not on a char boundary is also wrong -- it will panic too. Use `stderr.chars().take(200).collect::<String>()` or find the nearest char boundary.

- **`commands.rs:79-80`** -- `tracker.track_pane(id.clone(), cwd.clone())` is called **before** `pty_mgr.create(...)`. If `create` fails, the pane is tracked but no PTY exists. The polling thread will silently poll a phantom pane forever (returning the initial CWD, no branch detection). Move `track_pane` to after `pty_mgr.create` succeeds, or add cleanup on the error path.

## Suggestions

- **`tracker.rs:270`** -- `.expect("Failed to spawn cwd-tracker thread")` will crash the entire application if thread spawning fails (e.g., resource limits). Consider returning a `Result` from `start()` or logging the error and degrading gracefully (CWD tracking is a non-critical enhancement).

- **`lib.rs:49-51`** -- `stop()` sets the `running` flag but does not join the tracker thread. The polling thread could still be mid-iteration when `kill_all()` runs, and it may outlive the Exit handler entirely. Store the `JoinHandle` from `thread::Builder::spawn` and join it in `stop()` to guarantee clean shutdown.

- **`tracker.rs:88`** -- `gh_logged_errors: HashSet<String>` grows unbounded over the app lifetime. Every unique stderr output from `gh pr view` is stored forever. In a long-running session with diverse error messages, this is an unbounded memory leak. Consider using an LRU set or capping the size.

- **`pty.rs:18-31`** -- `detect_cwd` spawns an `lsof` process every 3 seconds per pane. For N panes that is N subprocess spawns per polling cycle. On macOS, consider using `proc_pidinfo` via `libc` FFI for zero-overhead CWD detection, or at minimum document the performance trade-off.

- **`tracker.rs:54,68`** -- `track_pane` and `untrack_pane` silently swallow poisoned mutex errors (`if let Ok(...)`). If the mutex is poisoned (which means a prior panic corrupted state), a pane will silently fail to register or deregister. Consider logging when the lock is poisoned, or using `unwrap_or_else(|e| e.into_inner())` to recover the inner data (as `kill_all` already does in `pty.rs:297`).

## Nitpicks

- **`tracker.rs:368`** -- `number as u32` silently truncates a `u64`. GitHub PR numbers will not exceed `u32::MAX` in practice, but `u32::try_from(number).unwrap_or(0)` or `.ok()?` would be more defensive and idiomatic.

- **`tracker.rs:281-285`** -- The `ToolResult` enum shadows `std::result::Result::Ok` and `std::result::Result::Err` with its own `Ok`/`Err` variants. This is legal but confusing when reading code that mixes both. Consider renaming to `ToolOutcome { Success(T), Missing, Failed }` or similar.

- **`tracker.rs:46`** -- `CwdTracker::new()` is a public constructor for a public type but does not implement `Default`. Adding `#[derive(Default)]` or an explicit `impl Default` would be more idiomatic for a struct with an obvious default state.
