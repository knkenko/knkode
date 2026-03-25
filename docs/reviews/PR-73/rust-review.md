# Rust Code Review -- PR #73 (`session_scanner.rs`)

## Summary

The PR adds `title`, `last_updated` fields to `AgentSession`, implements tail-reading for Claude session metadata, reads Codex sessions from SQLite via `sqlite3` shell-out, and fixes Gemini resume indexing. The code is generally well-structured and idiomatic. The main concern is a **SQL injection vector** in the SQLite shell-out; there are also a few minor correctness and robustness issues worth addressing.

## Must Fix

- **`session_scanner.rs:489` -- SQL injection via `project_cwd`**: The CWD value is interpolated into a SQL string with only single-quote escaping (`replace('\'', "''")`). This is insufficient: a CWD containing a backslash followed by a single quote, or other exotic sequences, could break out of the string literal in the `sqlite3` CLI. More importantly, `sqlite3` CLI supports dot-commands (`.shell`, `.system`) which are not SQL but are processed line-by-line -- a CWD containing a newline followed by `.shell rm -rf /` would be executed. While CWD values come from the local OS (not untrusted user input), this is still a defense-in-depth concern. **Fix**: pass the CWD value via a positional parameter using sqlite3's `-cmd "SET @cwd = ?"` or, more practically, validate that `project_cwd` contains no newlines, null bytes, or control characters before interpolation.

- **`session_scanner.rs:692` -- `secs as u64` panics on negative input**: `unix_to_iso` accepts `i64` but casts to `u64` with `secs as u64`. If `created_at` or `updated_at` from the database is negative (corrupt data, pre-epoch timestamp), this wraps to a huge value on release builds and panics in debug builds. **Fix**: clamp to 0 or return an empty/error string for negative values: `let secs_u64 = secs.max(0) as u64;`.

## Suggestions

- **`session_scanner.rs:692-710` -- Redundant round-trip in `unix_to_iso`**: The function constructs a `SystemTime` from `secs`, then immediately calls `duration_since(UNIX_EPOCH)` to get back the same seconds value. The intermediate `SystemTime` and the `match` on `Err` are dead code since `secs` is already clamped non-negative by the cast. Simplify by working directly with the `u64` value and removing the `SystemTime` detour entirely.

- **`session_scanner.rs:258` -- `file.metadata().map(|m| m.len()).unwrap_or(0)`**: If `metadata()` fails, `file_len` silently becomes 0, causing the entire file to be read (since `saturating_sub(CLAUDE_TAIL_BYTES)` on 0 yields seek position 0). This is functionally harmless but semantically misleading -- the intent is to read only the tail. Consider using `file.seek(SeekFrom::End(-(CLAUDE_TAIL_BYTES as i64)))` instead, which avoids the metadata call entirely and handles the "file smaller than TAIL_BYTES" case by clamping to the start.

- **`session_scanner.rs:526` -- Tab-separated fields may contain tabs**: If a Codex thread title or `first_user_message` contains a literal tab character, the `split('\t')` parsing will produce extra columns, shifting field indices. Consider using `splitn('\t', 7)` so the last field captures everything remaining, or validate column count more carefully.

- **`session_scanner.rs:267` -- `read_to_string` on a seeked binary-safe file**: If the tail 8KB of a JSONL file contains invalid UTF-8 (e.g., truncated multi-byte character at the seek boundary), `read_to_string` will return `Err` and the function returns `(None, None)`. This is a silent data loss scenario. Consider reading into a `Vec<u8>` and using `String::from_utf8_lossy`, or skipping the first partial line after the seek point.

- **`session_scanner.rs:370-375` -- Gemini session ID overwrite discards the real UUID**: The original `sessionId` from the JSON is overwritten with a 1-based index string for `--resume` compatibility. If the frontend ever needs the real session ID (e.g., for linking to Gemini's internal storage), it is lost. Consider storing the resume index in a separate field or keeping the UUID as the `id` and adding a `resume_index` field.

## Nitpicks

- **`session_scanner.rs:693` -- Unused binding `let dt: std::time::SystemTime = d;`**: The variable `d` is a `SystemTime` already; re-binding it to `dt` with a type annotation adds nothing. Remove the `let dt` line and use `d` directly (or remove both and work with the raw seconds as suggested above).

- **`session_scanner.rs:694-695` -- Stale/misleading comments**: The comment "Format via the humantime crate pattern (already used transitively) or manual" suggests `humantime` was considered but not used. Clean up the comment to reflect the actual approach.

- **`session_scanner.rs:717` -- Operator precedence in era calculation**: `if z >= 0 { z } else { z - 146096 } / 146097` -- the division binds to the entire `if` expression, which is correct, but reads ambiguously at a glance. Adding parentheses `(if z >= 0 { z } else { z - 146096 }) / 146097` would improve clarity.

- **`session_scanner.rs:251-304` -- `extract_claude_tail_metadata` opens the file a second time**: The file was already opened and read in `parse_claude_session`. Consider passing the file handle or path + length to avoid a second `open()` syscall, though the performance impact is negligible for this use case.
