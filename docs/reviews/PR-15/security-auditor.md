# Security Audit: PR #15 -- CWD Tracker

**Branch:** `feature/cwd-tracker` (base: `main`)
**Auditor:** security-auditor (claude-opus-4-6)
**Date:** 2026-03-18
**Scope:** Command injection, untrusted input handling, PATH manipulation, environment variable security, race conditions, information leakage.

## Summary

The PR introduces a background polling thread that detects per-pane CWD changes via `lsof`, resolves the git branch via `git rev-parse`, and queries PR status via `gh pr view`. The subprocess invocations are well-structured (no shell interpolation, arguments are passed as arrays), and existing input validation in `commands.rs` is solid. There are two real issues to address: a panic-on-multibyte-boundary in the PR title truncation, and an unbounded error-deduplication set that can grow without limit.

## Must Fix

- **`tracker.rs:362` -- PR title truncation panics on multi-byte UTF-8 boundaries.** `&title[..MAX_PR_TITLE_LEN - 3]` performs a byte slice on a `&str`. If the 253rd byte falls in the middle of a multi-byte UTF-8 character (e.g. CJK, emoji, accented characters in PR titles), this will panic at runtime with a "byte index is not a char boundary" error. Use `title.char_indices()` to find a safe truncation point, or use `title.chars().take(N).collect::<String>()`, or use the `floor_char_boundary` method (stabilized in Rust 1.74+).

- **`tracker.rs:88` -- `gh_logged_errors: HashSet<String>` is unbounded.** This set grows for the entire lifetime of the polling thread (which is the entire application lifetime). Each unique `gh` stderr message is inserted and never removed. A misbehaving or misconfigured `gh` CLI that produces unique error messages (e.g., containing timestamps, request IDs, or token fragments) could cause unbounded memory growth. Cap the set size (e.g., evict all entries after it exceeds a threshold like 100, or use a bounded LRU structure).

## Suggestions

- **`tracker.rs:305-308` / `tracker.rs:335-338` -- `Command::env("PATH", ...)` replaces only PATH but inherits all other environment variables.** The `git` and `gh` subprocesses inherit the full parent environment, including `GIT_DIR`, `GIT_WORK_TREE`, `GIT_CONFIG`, `GIT_CONFIG_GLOBAL`, `GH_TOKEN`, `GITHUB_TOKEN`, etc. If a user or another process sets `GIT_DIR` or `GIT_WORK_TREE` in the Tauri process environment, git commands will operate on an unexpected repository. Consider using `.env_clear()` followed by explicitly setting only the required variables (`PATH`, `HOME`, and optionally `GIT_TERMINAL_PROMPT=0` to prevent git from hanging on credential prompts), or at minimum `.env_remove("GIT_DIR").env_remove("GIT_WORK_TREE")` to prevent redirection attacks.

- **`tracker.rs:305-308` / `tracker.rs:335-338` -- Subprocess calls lack `GIT_TERMINAL_PROMPT=0` / `GH_PROMPT_DISABLED=1`.** If `git` or `gh` encounters a situation requiring user input (credential prompt, SSH key passphrase, gh auth login), the subprocess will block indefinitely since stdin is not connected to a terminal. This would stall the polling thread for that pane and delay updates for all subsequent panes in the iteration. Set `GIT_TERMINAL_PROMPT=0` for git and `GH_PROMPT_DISABLED=1` for gh to force immediate failure instead of blocking.

- **`pty.rs:18-31` -- `detect_cwd` via `lsof` does not inherit the augmented PATH.** The `detect_cwd` function calls `Command::new("lsof")` without setting any PATH. When Tauri is launched from Dock/Spotlight (the exact scenario `EXTRA_PATH_DIRS` was designed for), `lsof` is at `/usr/sbin/lsof` which is typically in the default minimal PATH, so this is likely fine in practice. However, for consistency and to guard against unusual system configurations, consider passing the augmented PATH here as well, or at least documenting why it is intentionally omitted.

- **`pty.rs:307-314` -- TOCTOU race between PID retrieval and `lsof` execution.** The sessions lock is dropped at line 312 before `detect_cwd(pid)` runs the `lsof` subprocess at line 314. Between the drop and the `lsof` call, the child process could exit and the OS could recycle the PID to a different process. On macOS, PID reuse is relatively slow (PIDs increment monotonically up to ~99999 before wrapping), so the practical risk is very low for a 3-second polling interval. However, the result could theoretically return the CWD of an unrelated process. Consider validating that the returned path is a directory, or accepting this as a known low-risk limitation and documenting it.

- **`tracker.rs:376-384` -- Error logging may leak sensitive data from `gh` stdout.** When JSON parsing fails, the first 200 bytes of `gh` stdout are printed to stderr. If `gh` returns an error page or unexpected content (e.g., during a GitHub outage), this could include URLs, partial tokens, or other contextual data in the stderr logs. Consider redacting or omitting the raw output, or at least limiting to a shorter prefix.

## Nitpicks

- **`tracker.rs:355-359` -- URL protocol validation logging could panic on very short URLs.** The expression `&url[..url.find(':').unwrap_or(10).min(20)]` slices by byte index. If the URL is shorter than the computed index (e.g., an empty or very short non-protocol string), this will panic. This is extremely unlikely given the data comes from GitHub's API via `gh`, but for robustness consider using `url.get(..idx).unwrap_or(url)` instead of a direct byte slice.

- **`tracker.rs:387-395` -- Same pattern with stderr truncation.** `&stderr[..200.min(stderr.len())]` is safe because `.min(stderr.len())` is used, but if `stderr` contains multi-byte UTF-8 characters, slicing at byte 200 could panic. Use `stderr.get(..200).unwrap_or(&stderr)` or `stderr.chars().take(200).collect::<String>()` for safety.

- **`tracker.rs:377-380` -- Same multi-byte issue with stdout error logging.** `&String::from_utf8_lossy(&output.stdout)[..200.min(output.stdout.len())]` -- note the `.min()` uses `output.stdout.len()` (the byte length of the original bytes) but the slice is applied to the lossy-decoded String, which can have a different length (replacement characters are 3 bytes each). This can panic if the byte lengths diverge. Use `.chars().take(N)` or `.get(..N)` on the decoded string.

- **`lib.rs:43-44` -- No join handle for the tracker thread.** The spawned thread has no join handle stored, so `stop()` sets the flag but cannot guarantee the thread has actually exited before `kill_all()` runs. In practice the 3-second sleep granularity means the thread will exit within one poll cycle, but during rapid shutdown, a subprocess (`lsof`, `git`, `gh`) could still be running when the process exits. This is benign (orphaned subprocesses will be cleaned up by the OS) but worth noting.
