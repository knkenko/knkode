# PR-15 DRY/Reuse Review

## Summary

The PR introduces a well-structured CWD/branch/PR polling tracker, but contains one clear intra-PR duplication (the "clear PR and emit null" block is copy-pasted) and a cross-file inconsistency where `detect_cwd` in `pty.rs` shells out to `lsof` without the PATH augmentation that `tracker.rs` applies to `git`/`gh`. The URL validation logic is also duplicated across the Rust/TypeScript boundary.

## Must Fix

- **Duplicated "clear PR" block within `tracker.rs`**: The 10-line block that locks `panes`, sets `s.pr = None`, checks `had_pr`, and emits `"pty:pr-changed"` with `null` appears verbatim at two locations:
  - `src-tauri/src/tracker.rs:166-182` (branch changed case)
  - `src-tauri/src/tracker.rs:237-253` (no branch case)

  Extract to a helper like `fn clear_pr_if_present(panes: &Mutex<...>, pane_id: &str, app: &AppHandle) -> ()` to eliminate the duplication.

## Suggestions

- **`detect_cwd` in `pty.rs` does not use augmented PATH**: `detect_cwd` (`src-tauri/src/pty.rs:18-32`) shells out to `lsof` using the inherited (minimal) PATH. Meanwhile, `get_git_branch` and `get_pr_status` in `tracker.rs:308,338` use `build_augmented_path()` to fix the Dock-launched-app PATH issue. If the app is launched from Dock/Spotlight, `lsof` lives in `/usr/sbin` which is typically in the default PATH, so this is likely fine today -- but the inconsistency is worth noting. Consider either: (a) passing the augmented PATH to `detect_cwd` for consistency, or (b) adding a comment to `detect_cwd` explaining why it doesn't need augmentation (since `lsof` is in `/usr/sbin`).

- **URL validation duplicated across Rust and TypeScript**: The `url.starts_with("https://") || url.starts_with("http://")` check exists in both:
  - `src-tauri/src/tracker.rs:355` (Rust, inside `get_pr_status`)
  - `src/lib/tauri-api.ts:42-44` (`isAllowedUrl` function)

  These serve different purposes (Rust validates `gh` CLI output, TypeScript gates `openExternal`), but the logic is identical. If the allowed-scheme list ever changes, it must be updated in two places. Consider defining the allowed schemes as a shared constant or documenting the coupling.

- **`get_git_branch` and `get_pr_status` share a structural pattern**: Both functions (`tracker.rs:304-328` and `tracker.rs:330-402`) follow the same structure: `Command::new(tool).args(...).current_dir(cwd).env("PATH", augmented_path).output()` then match on `Ok(output)` with success/failure branches, then `Err(NotFound) => ToolMissing`, `Err(_) => Err`. Consider a small helper like `fn run_cli(tool: &str, args: &[&str], cwd: &str, path: &str) -> ToolResult<Output>` that centralizes the command execution and `NotFound` handling, leaving only the output parsing to the callers.

- **Repeated lock-mutate-drop pattern in the polling loop**: The pattern `if let Ok(mut p) = panes.lock() { if let Some(state) = p.get_mut(&pane_id) { /* mutate */ } }` appears 4+ times in the polling loop (`tracker.rs:119, 141, 189, 218`). While each mutation is different, consider a small helper like `fn with_pane<F>(panes: &Mutex<HashMap<...>>, id: &str, f: F)` to reduce boilerplate. This is a judgment call -- the current form is readable, but it adds visual noise.

## Nitpicks

- **`ToolResult` mirrors `Result` but with three variants**: `ToolResult<T>` (`tracker.rs:281-285`) is essentially `Result<T, ToolError>` where `ToolError` has two variants (`Missing`, `Other`). Using a standard `Result<T, ToolError>` enum would let you use `?` and combinators. Low-priority since the current approach works and is clear.

- **`detect_cwd` could use `stderr` suppression**: `detect_cwd` (`pty.rs:20-22`) doesn't redirect stderr, so `lsof` errors could leak to the app's stderr. The tracker functions don't have this issue since they capture full `output()`. Consider adding `.stderr(std::process::Stdio::null())` to the `lsof` command.

- **Magic number 200 in stderr truncation**: `tracker.rs:379,394` uses `[..200.min(...)]` to truncate error messages for logging. This limit appears twice and should be a named constant (e.g., `const MAX_LOG_MSG_LEN: usize = 200`).
