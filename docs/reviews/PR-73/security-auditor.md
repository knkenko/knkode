# Security Audit: PR #73 — Session History v2

## Summary

The PR adds richer session metadata (titles, last-updated timestamps) and introduces a `sqlite3` shell-out for Codex session scanning. The most significant security concern is a **SQL injection vector** in `scan_codex_sqlite` where `project_cwd` is interpolated into a SQL string with only single-quote escaping -- insufficient against payloads that break out of the string context or exploit SQLite-specific features. The frontend is well-defended: React's JSX escaping prevents XSS, session IDs are validated with an allowlist regex before command construction, and no `dangerouslySetInnerHTML` is used anywhere.

## Must Fix

- **`src-tauri/src/session_scanner.rs:484-491` -- SQL injection via string interpolation in sqlite3 shell-out.** The `project_cwd` value is interpolated into a raw SQL string passed as a CLI argument to `sqlite3`. The only protection is `replace('\'', "''")` (single-quote doubling). While this blocks the simplest `'`-based breakouts, it is fundamentally fragile for several reasons:
  1. The value is passed as a shell argument (`Command::arg`), which avoids shell metacharacter injection, but the SQL itself is still constructed via string formatting.
  2. Single-quote doubling is the correct escaping mechanism for SQL string literals, but relying on manual escaping is error-prone and violates defense-in-depth. If `project_cwd` were ever sourced from a less trusted origin (e.g., a workspace config file edited by another tool, or a symlinked path containing adversarial components), the attack surface widens.
  3. There is no validation that `project_cwd` contains only expected filesystem characters before it reaches the SQL string. The upstream `commands.rs:191-196` checks for null bytes and absolute path, but does not reject characters like backslashes (on non-Windows), semicolons, or other SQL-significant characters.

  **Recommended fix:** Use a SQLite parameterized query via the `-cmd` flag pattern, or pass the CWD value through stdin. For example:
  ```rust
  // Parameterized approach using sqlite3's parameter binding
  .arg("-separator").arg("\t")
  .arg(db_path.as_os_str())
  .arg(format!(
      "SELECT id, title, cwd, git_branch, created_at, updated_at, first_user_message \
       FROM threads WHERE cwd = ?1 AND archived = 0 \
       ORDER BY updated_at DESC LIMIT {};",
      MAX_SESSIONS,
  ))
  ```
  Unfortunately `sqlite3` CLI does not support `?` bind parameters directly. The most robust alternative is to either:
  (a) Add a validation function that rejects `project_cwd` values containing any characters outside `[a-zA-Z0-9/_.-]` before they reach the SQL formatter, or
  (b) Use the `-cmd ".param set :cwd 'value'"` approach with proper escaping, or
  (c) Accept the `rusqlite` dependency for a proper parameterized query.

- **`src-tauri/src/session_scanner.rs:692` -- Negative timestamp causes wrapping in `unix_to_iso`.** The function casts `secs: i64` to `u64` via `secs as u64`. If a malformed SQLite row returns a negative `created_at` or `updated_at` value (e.g., from corruption or a different schema version), this silently wraps to a very large positive number, producing a nonsensical date rather than an error. While not directly exploitable, it could cause sorting anomalies that push malicious sessions to the top of the list.

  **Recommended fix:** Guard against negative values:
  ```rust
  let secs_u64 = if secs < 0 { return String::new(); } else { secs as u64 };
  ```

## Suggestions

- **`src-tauri/src/session_scanner.rs:332-341` -- Gemini path construction uses only the directory basename, risking cross-project session leakage.** If two projects share the same directory name (e.g., `/home/user/work/app` and `/home/user/personal/app`), sessions from one project will appear in the other. This is documented in a comment but could confuse users into resuming the wrong session in the wrong project context. Consider including a note in the UI when Gemini sessions are shown, or logging a warning when multiple CWDs map to the same basename.

- **`src-tauri/src/session_scanner.rs:266-268` -- `read_to_string` on tail of potentially large JSONL files.** The `extract_claude_tail_metadata` function reads up to `CLAUDE_TAIL_BYTES` (8 KB) into a `String`. If the seek lands in the middle of a multi-byte UTF-8 sequence, `read_to_string` will return an error and the function returns `(None, None)`. This is safe but lossy. Consider using `read_to_end` with `String::from_utf8_lossy` for resilience, consistent with how `stdout` is handled in the sqlite3 path (line 511).

- **`src/store/session-history-actions.ts:3` -- Session ID regex allows hyphens and underscores but Gemini IDs are now numeric indices.** The `SAFE_SESSION_ID` regex `/^[a-zA-Z0-9_-]+$/` correctly validates Claude UUIDs and Codex IDs, and also matches the new Gemini numeric indices (`1`, `2`, ...). This is fine currently, but the comment should note that Gemini IDs are now reassigned 1-based indices rather than the original `sessionId` from the JSON file. If the Gemini ID format changes upstream, the regex should be revisited.

- **`src-tauri/src/session_scanner.rs:480-492` -- No timeout on the sqlite3 subprocess.** If the SQLite database is locked (e.g., Codex CLI is actively writing), the `sqlite3` process could hang indefinitely, blocking the Tauri command thread. Consider adding a timeout mechanism or spawning with a deadline.

## Nitpicks

- **`src-tauri/src/session_scanner.rs:693` -- Redundant variable binding.** `let dt: std::time::SystemTime = d;` is redundant since `d` is already a `SystemTime`. The `dt` variable can be removed and `d` used directly.

- **`src/components/SessionHistoryModal.tsx:63` -- Session title in `title` attribute is not sanitized for extremely long strings.** The `title={name}` attribute on the `<p>` tag will show the full session name on hover. Since `truncate_summary` in Rust limits to 120 chars, this is bounded, but worth noting that the raw backend value flows directly into an HTML attribute. React handles escaping here, so no XSS risk.

- **`src-tauri/src/session_scanner.rs:489` -- The comment "Simple quote escaping" understates the security significance.** This is the primary SQL injection defense and should have a more prominent security comment explaining why it is sufficient (or a TODO noting it should be replaced with parameterized queries).
