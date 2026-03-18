# PR-15 Code Simplifier Review

## Summary

The polling loop in `tracker.rs` has grown into a deeply nested monolith (lines 90-264, ~175 lines inside a single closure) with repeated mutex-lock-get-mutate-drop patterns and duplicated "clear stale PR" logic. Extracting helpers and consolidating state access would cut nesting by 3-4 levels and remove copy-paste blocks without changing behavior.

## Must Fix

- **`tracker.rs:164-183` / `tracker.rs:235-253` — duplicated "clear stale PR" logic**: The exact same pattern (lock panes, check `pr.is_some()`, set `pr = None`, emit `pty:pr-changed` with null) appears in two places. Extract a `clear_pr_if_present()` helper that takes the panes Arc, pane_id, and app handle. This eliminates ~30 lines of duplication and the risk of the two copies drifting apart.

- **`tracker.rs:362` — title truncation slices at byte offset, not char boundary**: `&title[..MAX_PR_TITLE_LEN - 3]` will panic if the title contains multi-byte UTF-8 characters and the boundary falls mid-character. PR titles from GitHub regularly contain emoji and non-ASCII characters. Use `title.chars().take(MAX_PR_TITLE_LEN - 3).collect::<String>()` or `title.char_indices()` to find a safe boundary.

- **`tracker.rs:90-264` — monolithic poll loop needs decomposition**: The inner `for pane_id in pane_ids` body is ~160 lines of deeply nested logic (up to 8 levels of indentation). Extract per-pane polling into a separate function like `fn poll_pane(pane_id, panes, pty_manager, app, augmented_path, git_missing_since, gh_missing_since, gh_logged_errors)`. This makes the main loop trivially readable and each concern independently testable.

## Suggestions

- **`tracker.rs:104-114` / `tracker.rs:119-123` / `tracker.rs:141-145` / `tracker.rs:155-162` / `tracker.rs:166-176` / `tracker.rs:189-193` / `tracker.rs:204-212` / `tracker.rs:218-224` / `tracker.rs:237-246` — repetitive lock-get-mutate pattern**: Nearly every state mutation follows the same `panes.lock().ok().and_then(|mut p| p.get_mut(&pane_id).map(|s| ...)).unwrap_or(default)` shape. Consider adding a helper method like `fn with_pane_mut<R>(&self, pane_id: &str, f: impl FnOnce(&mut PaneState) -> R) -> Option<R>` on a wrapper or as a free function. This would replace 9+ instances of the same boilerplate.

- **`tracker.rs:202-203` / `tracker.rs:210` — shadowed variable name `p`**: The variable `p` is used to mean both `PrInfo` (line 203: `pr.as_ref().map(|p| p.number)`) and the panes mutex guard (line 205+). While the scopes don't technically conflict, it hurts readability in a dense block. Use `pr_info` or `info` for the PrInfo closure parameter.

- **`tracker.rs:153-162` — `should_check_pr` computed via chained lock**: The `should_check_pr` flag is computed by locking the panes mutex and checking `pr_last_checked.elapsed()`, right after another lock was released on line 145. This could be combined with the earlier branch-update lock to avoid an extra lock/unlock cycle per iteration.

- **`pty.rs:14-36` — `detect_cwd` belongs in `tracker.rs`**: The `detect_cwd` function is only used by `PtyManager::get_cwd`, which itself is only called by the tracker polling loop. Since it is an OS-level CWD detection helper (using `lsof`), it is logically part of the tracking concern rather than the PTY concern. Moving it to `tracker.rs` (or a shared `os` module) would keep `pty.rs` focused on PTY lifecycle management and avoid the `cfg` blocks in an otherwise platform-agnostic module.

- **`tracker.rs:407-423` — `build_augmented_path` uses intermediate `Vec<&&str>` unnecessarily**: The double-reference `Vec<&&str>` collected on line 410 is only used to iterate again on line 420. This can be simplified to build the string directly:
  ```rust
  let extras: Vec<&str> = EXTRA_PATH_DIRS
      .iter()
      .copied()
      .filter(|d| !segments.contains(d))
      .collect();
  ```
  Then `extras.join(":")` works without the `**d` deref dance.

- **`commands.rs:79` — `tracker.track_pane` called before `pty_mgr.create` can fail**: If `pty_mgr.create(...)` returns `Err`, the tracker still holds a pane entry for an ID that has no PTY session. The tracker will then poll a non-existent pane until it is explicitly killed. Move `tracker.track_pane(...)` after the `pty_mgr.create(...)` call succeeds, or add cleanup on error.

## Nitpicks

- **`tracker.rs:281-285` — `ToolResult` enum mirrors `Result` naming**: Using `Ok` and `Err` as variant names on a non-`Result` type can be confusing when reading code that also uses `std::result::Result`. Consider `ToolResult::Success` / `ToolResult::Failed` or similar to reduce cognitive load, though this is admittedly a matter of taste.

- **`tracker.rs:358` — URL protocol validation truncation is fragile**: The expression `&url[..url.find(':').unwrap_or(10).min(20)]` in the eprintln is clever but hard to parse at a glance. A simple `&url[..20.min(url.len())]` would be clearer for a diagnostic message.

- **`pty.rs:314` — `.or(Some(fallback))` could be `.or_else(|| Some(fallback))`**: Using `.or()` eagerly evaluates the `Some(fallback)` argument even when the `Option` already has a value. Since `fallback` is a `String` (already allocated), this doesn't matter for correctness or performance here, but `.or_else` is the idiomatic pattern for the "only compute fallback if needed" intent.
