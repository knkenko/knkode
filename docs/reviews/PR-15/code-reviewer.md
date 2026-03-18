# PR-15 Code Review: CWD Tracker (`feature/cwd-tracker`)

## Summary

Adds a background polling thread (`CwdTracker`) that detects per-pane CWD changes via `lsof`, git branch via `git rev-parse`, and open PR status via `gh pr view`, emitting Tauri events on change. The implementation is solid overall with good defensive coding (tool-missing retry, poisoned-lock handling, generation-based cleanup). Several issues warrant attention: a panic-possible string slice on non-ASCII PR titles, a potential orphaned tracker entry on PTY creation failure, and `lsof` being called with the mutex held (blocking all PTY operations during the subprocess call).

## Must Fix

- **`src-tauri/src/tracker.rs:362-363` -- Panic on non-ASCII PR title truncation.** `&title[..MAX_PR_TITLE_LEN - 3]` slices by byte offset, not character boundary. If the title contains multi-byte UTF-8 characters (e.g. CJK, emoji) and the 253rd byte lands in the middle of a character, this will panic at runtime. Use `title.char_indices()` to find a safe truncation point, or use `title.chars().take(MAX_PR_TITLE_LEN - 3).collect::<String>()`.

- **`src-tauri/src/commands.rs:79-80` -- Tracker entry orphaned if PTY creation fails.** `tracker.track_pane()` is called before `pty_mgr.create()`. If `create()` returns `Err`, the pane is registered in the tracker but has no corresponding PTY session. The polling thread will then call `pty_manager.get_cwd(&pane_id)` which returns `None`, and the tracker will use the stale initial CWD forever (or until the user explicitly kills the pane). Move `track_pane` after the `create()` call, or clean up on error:
  ```rust
  let result = pty_mgr.create(id.clone(), cwd.clone(), startup_command, app);
  if result.is_ok() {
      tracker.track_pane(id, cwd);
  }
  result
  ```

- **`src-tauri/src/pty.rs:307-314` -- `lsof` subprocess spawned while sessions mutex is conceptually in the hot path.** `get_cwd` correctly drops the sessions lock before calling `detect_cwd`, but `detect_cwd` spawns `lsof` as a synchronous subprocess (which can take hundreds of milliseconds or hang if the process is in an uninterruptible state). Since the polling thread calls `get_cwd` for every pane sequentially, a single slow `lsof` call blocks all other pane updates for that poll cycle. With many panes this compounds. Consider adding a timeout to the `lsof` command (e.g. wrapping with `Command::new("timeout").args(["2", "lsof", ...])`) or spawning the detection asynchronously.

## Suggestions

- **`src-tauri/src/tracker.rs:358` -- URL protocol validation slice can panic on very short URLs.** The expression `&url[..url.find(':').unwrap_or(10).min(20)]` will panic if `url` is shorter than the computed index (e.g. a URL with no colon and fewer than 10 bytes). While `gh` is unlikely to return such a URL, defensive code should use `&url[..url.len().min(url.find(':').unwrap_or(10).min(20))]` or simply log the full (already short, malformed) URL.

- **`src-tauri/src/tracker.rs:90-267` -- Deeply nested polling loop is hard to follow.** The main `while` loop body is ~175 lines with 6+ levels of nesting. Consider extracting per-pane processing into a helper method like `poll_pane(pane_id, &pty_manager, &panes, &app, ...)` to improve readability and testability.

- **`src-tauri/src/tracker.rs:88` -- `gh_logged_errors` HashSet grows unboundedly.** Every unique `gh` stderr message is inserted and never removed. Over a long-running session with many distinct error messages, this set grows without bound. Consider using an LRU cache or periodically clearing it.

- **`src-tauri/src/lib.rs:49-51` -- `stop()` then `kill_all()` ordering on exit.** `CwdTracker::stop()` sets the `running` flag to `false` and clears panes, but the polling thread may still be mid-iteration (e.g. waiting on `lsof` or `gh`). There is no `join()` on the thread handle, so `kill_all()` could race with an in-flight `get_cwd` call. Consider storing the `JoinHandle` and joining it in `stop()` to ensure clean shutdown.

## Nitpicks

- **`src-tauri/src/tracker.rs:61` -- `Instant::now() - PR_REFRESH_INTERVAL` for initial state.** This is a clever trick to force an immediate first PR check, but it is subtle. A brief comment like `// Force immediate check on first poll` would help future readers.

- **`src-tauri/src/pty.rs:34-37` -- Non-macOS `detect_cwd` stub returns `None`.** On Linux, reading `/proc/<pid>/cwd` would be trivial and much cheaper than `lsof`. This is a feature gap worth noting with a TODO comment for future cross-platform support.

- **`src-tauri/src/tracker.rs:281-285` -- `ToolResult` enum shadows `std::result::Result`.** The name `ToolResult::Ok` mirrors `Result::Ok` which could confuse readers. Consider `ToolOutcome` or `ToolResponse` to avoid the visual collision.
