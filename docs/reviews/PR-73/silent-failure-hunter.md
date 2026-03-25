# PR #73 Silent Failure & Error Handling Review

## Summary

The Rust backend (`session_scanner.rs`) has several silent-failure patterns where file I/O errors, JSON parse failures, and timestamp conversion errors return empty/None values with no logging, making it impossible to diagnose why sessions are missing or displaying incorrectly. The TypeScript frontend has two catch blocks that swallow errors with only `console.error` and no user feedback, leaving users with a blank modal or a silently-failed resume with no indication of what went wrong.

## Must Fix

- **`src-tauri/src/session_scanner.rs:692`** -- `unix_to_iso` silently wraps negative `i64` timestamps via `secs as u64` cast. If `cols[4].parse::<i64>()` produces a negative value (corrupt DB row), `secs as u64` wraps to a massive positive number, producing a nonsensical far-future date that corrupts sort order. The `unwrap_or(0)` on line 524-525 masks parse failures entirely -- a non-numeric `created_at` column silently becomes epoch zero ("1970-01-01T00:00:00Z"), which is misleading rather than obviously wrong.

- **`src-tauri/src/session_scanner.rs:709`** -- `unix_to_iso` returns `String::new()` (empty string) on `Err(_)` from `duration_since`. This empty string becomes the `timestamp` field of an `AgentSession`. Downstream, `formatRelativeTime("")` in TypeScript will produce `NaN` from `new Date("").getTime()`, which the `!Number.isFinite(diff)` guard catches as "unknown" -- but the root cause (a bad timestamp in the DB) is never logged anywhere. The user sees "unknown" with no way to investigate.

- **`src-tauri/src/session_scanner.rs:254-268`** -- `extract_claude_tail_metadata` has three separate error points (`File::open`, `seek`, `read_to_string`) that all return `(None, None)` with zero logging. If a Claude session file becomes unreadable (permissions, disk error, file locked by another process), the session silently loses its title and `last_updated` timestamp. The user sees a session with "Untitled session" and an older timestamp, with no clue that metadata extraction failed. At minimum, the `File::open` failure on a path that was just successfully opened moments ago in `parse_claude_session` deserves a warning -- it indicates a race condition or permissions issue.

- **`src-tauri/src/session_scanner.rs:484-491`** -- The `sqlite3` query builds SQL by string interpolation with only single-quote escaping (`replace('\'', "''")`). While this prevents basic SQL injection via `project_cwd`, it does not handle backslashes, null bytes, or other SQLite-specific escape sequences. The `project_cwd` comes from the Tauri frontend which derives it from the filesystem, so this is low-risk in practice, but the pattern is fragile. A path containing a backslash followed by a single quote could still break the query or produce unexpected results on Windows. More importantly, if the query is malformed, the `sqlite3` stderr is logged but the sessions silently fall back to JSONL scanning -- the user has no idea they are seeing an incomplete or stale session list.

- **`src/store/session-history-actions.ts:64-71`** -- `resumeSession` catches all errors and only logs to `console.error`. The user clicks "Resume", the modal closes (line 68 runs before the `writePty` await completes due to the try/catch structure -- actually, looking again, the `set` is after `await`, so if `writePty` throws, the modal stays open but the user gets zero visual feedback about why nothing happened). If `buildResumeCommand` throws due to an invalid session ID (line 8), or `writePty` fails because the pane was killed, the user sees... nothing. No toast, no error message, no indication that the resume failed.

## Suggestions

- **`src-tauri/src/session_scanner.rs:172`** -- `parse_claude_session` uses `.ok()?` on `File::open`, silently returning `None` if the file cannot be opened. While this is an acceptable pattern for "file doesn't exist" cases during directory iteration, it also suppresses permission-denied errors, I/O errors, and other unexpected failures. Consider logging at debug/trace level when the error is not `NotFound`.

- **`src-tauri/src/session_scanner.rs:183-189`** -- Two consecutive `continue` branches for line read errors and JSON parse errors in the Claude session parser. These silently skip corrupt or binary lines. This is reasonable for JSON parse failures (partial lines are expected in JSONL), but an I/O error on `line` (line 185) indicates a deeper problem (encoding issue, disk error) that should be logged at least once rather than silently skipped on every iteration.

- **`src-tauri/src/session_scanner.rs:395-396`** -- `parse_gemini_session` uses `.ok()?` on both `read_to_string` and `serde_json::from_str`. If a Gemini session file contains valid JSON that does not have `sessionId` or `startTime` (schema change), or if the file is valid UTF-8 but invalid JSON (truncated write), the session is silently dropped with no log. Consider logging a warning when a file in the expected directory fails to parse, to help users understand why sessions are missing.

- **`src/store/session-history-actions.ts:43-49`** -- `fetchAgentSessions` catches all errors, logs to `console.error`, and sets `agentSessions` to `[]`. The user sees "No sessions found for this project" -- indistinguishable from a project that genuinely has no sessions. Consider setting an error state that the modal can display (e.g., "Failed to load sessions -- check console for details").

- **`src-tauri/src/session_scanner.rs:514`** -- When `cols.len() < 7`, the line is silently skipped with `continue`. If the SQLite schema changes and adds/removes columns, every row will be silently skipped and the function returns `true` (indicating success), preventing the JSONL fallback from running. The user sees an empty session list with no error. Consider logging when column count is unexpected, or returning `false` to trigger the fallback.

## Nitpicks

- **`src-tauri/src/session_scanner.rs:258`** -- `file.metadata().map(|m| m.len()).unwrap_or(0)` silently treats metadata-read failure as a zero-length file. This means the seek position will be `0` and the function will try to read the entire file into memory as a string. For very large files this could cause an OOM rather than a graceful degradation.

- **`src-tauri/src/session_scanner.rs:693`** -- The `let dt: std::time::SystemTime = d;` binding is redundant -- `d` is already a `SystemTime`. This is a no-op assignment that adds visual noise.

- **`src/components/SessionHistoryModal.tsx:55`** -- `session.lastUpdated ?? session.timestamp` uses null coalescing. If `lastUpdated` is an empty string (which `unix_to_iso` can produce on error, see Must Fix above), it will not fall back to `timestamp` because `""` is not null/undefined. This means a corrupt `lastUpdated` value of `""` will be passed to `formatRelativeTime`, producing "unknown" even when a valid `timestamp` exists.
