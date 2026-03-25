# PR #73 Efficiency Review

## Summary

The PR adds session metadata extraction (title, last_updated) for all three agents and introduces themed styling tokens for the session history modal. The Rust backend has two material efficiency issues: Claude session files are opened twice per session, and `build_augmented_path()` is rebuilt on every `is_command_available` call. The frontend changes are clean with appropriate memoization.

## Must Fix

- **`session_scanner.rs:169-233` — Double file open per Claude session.** `parse_claude_session` opens the file at line 172 via `File::open` for pass 1, then `extract_claude_tail_metadata` (called at line 233) opens the same file again at line 254. With 50 session files this means 100 file opens instead of 50. The fix is to pass the already-opened file handle (or at minimum the file path's metadata/length) into `extract_claude_tail_metadata`, or restructure so a single `File::open` is reused for both the head read and tail seek.

- **`session_scanner.rs:93-105` — `build_augmented_path()` rebuilt 3 times per scan.** `detect_installed_agents` calls `is_command_available` once per agent (claude, gemini, codex), and each call rebuilds the augmented PATH string via `build_augmented_path()` which allocates a `HashSet`, collects segments, and potentially formats a new string. This should be computed once and passed to each `is_command_available` call.

## Suggestions

- **`session_scanner.rs:383-395` — Gemini TOCTOU: `metadata()` then `read_to_string()`.** The file size guard calls `std::fs::metadata(path)` followed by `std::fs::read_to_string(path)`, which is a time-of-check-to-time-of-use pattern. The file could grow between the check and the read. A more robust approach: open the file once, check `file.metadata()?.len()`, then read from the open handle. This also avoids a double syscall (stat + open).

- **`session_scanner.rs:689-711` — Redundant `duration_since` round-trip in `unix_to_iso`.** The function constructs `d = UNIX_EPOCH + Duration::from_secs(secs as u64)`, assigns it to `dt`, then immediately calls `dt.duration_since(UNIX_EPOCH)` which returns the exact same duration it started with. The intermediate `SystemTime` is unnecessary. Also, casting `secs: i64` to `u64` via `as` silently wraps negative values; a `try_from` or early return on negative input would be safer.

- **`session_scanner.rs:58-86` — Sequential agent scanning.** `list_sessions` calls `scan_claude`, `scan_gemini`, and `scan_codex` sequentially. Claude and Gemini involve filesystem I/O; Codex may shell out to `sqlite3`. These are independent and could run in parallel via `std::thread::scope` or `rayon::join`. On a machine with all three agents installed, this would reduce wall-clock latency. Low priority since this is user-triggered, not a hot path.

- **`SessionHistoryModal.tsx:100` — Broad `workspaces` selector.** `useStore((s) => s.workspaces)` subscribes to the entire workspaces array. Any workspace mutation (rename, reorder, theme change on a different workspace) will trigger a re-render of the modal even when the active workspace's preset hasn't changed. A narrower selector like `useStore((s) => s.workspaces.find((w) => w.id === s.appState.activeWorkspaceId)?.theme.preset)` would reduce unnecessary re-renders. Low impact since the modal is short-lived.

## Nitpicks

- **`session_scanner.rs:484-492` — SQL injection surface.** The Codex SQLite query interpolates `project_cwd` with only single-quote escaping (`replace('\'', "''")`). While this is adequate for SQLite string literals, using a parameterized query via `sqlite3` (e.g., via `.param set`) would be more defensive. Low risk since the value comes from the app's own CWD, not user input.

- **`session_scanner.rs:248` — `CLAUDE_TAIL_BYTES` at 8 KB may miss metadata.** If a session has very long assistant responses near the end, the custom-title or last timestamp could fall outside the 8 KB tail window. Consider documenting this tradeoff or making the constant configurable. The current value is likely fine in practice.

- **`ThemeRegistry.tsx` — ~190 lines of static token strings added.** Each of the 16 themes gets a `sessionHistory` block with 7-9 string fields, adding substantial static data. This is the established pattern in the file and not a functional concern, but worth noting that the registry is growing. A future refactoring could generate theme variants from a base + overrides pattern to reduce duplication.
