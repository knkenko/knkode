# PR-15 Comment Analysis: `feature/cwd-tracker`

## Summary

The PR introduces a CWD/branch/PR polling tracker across four files. Comment quality is generally high -- doc comments on public APIs are accurate, and inline comments explain "why" rather than restating code. There are two factual inaccuracies and several opportunities to improve documentation for future maintainers.

## Must Fix

- **`src-tauri/src/pty.rs:14-16`** -- The doc comment on `detect_cwd` says it "parses the `fcwd` + `n/path` lines," but the actual lsof flag used is `-Fn` (field-name only), not `-Fn` in the sense described. The comment omits that `-Fn` requests the "name" field for each file descriptor and that the `f` column is the file descriptor identifier. More importantly, the comment says "macOS: `lsof -p PID -Fn`" as if this is macOS-specific documentation, but the function itself is already gated by `#[cfg(target_os = "macos")]`. The doc comment should describe the parsing logic rather than repeating the platform gate. Minor point: saying "parses the `fcwd` + `n/path` lines" is technically correct but could mislead readers into thinking `fcwd` is some lsof flag rather than an output line meaning "file descriptor: cwd". Consider: `/// Parses lsof output looking for the "fcwd" file-descriptor line followed by its "n<path>" name line.`

- **`src-tauri/src/tracker.rs:287-288`** -- The doc comment on `should_retry_tool` says "Returns true if the tool is available or if enough time has passed since it was last found missing." The function does not check whether the tool is available -- it only checks whether the `missing_since` option is `None` (meaning no previous failure has been recorded) or whether enough time has elapsed. A tool could have been tried and failed for a non-NotFound reason (returning `ToolResult::Err`), in which case `missing_since` stays `None` and `should_retry_tool` returns `true` on every call. The comment should say: "Returns true if no tool-missing state is active, or if enough time has passed since the tool was last found missing." The word "available" implies an actual availability check that does not happen.

## Suggestions

- **`src-tauri/src/tracker.rs:38-39`** -- The struct doc comment says "Polls every 3 seconds" which hardcodes the `POLL_INTERVAL` value. If `POLL_INTERVAL` changes, this comment will silently become wrong. Suggestion: reference the constant name instead, e.g., `/// Polls at POLL_INTERVAL using OS-level CWD detection + git/gh CLI.`

- **`src-tauri/src/tracker.rs:405-406`** -- The doc comment on `build_augmented_path` says "Cached for the lifetime of the polling thread." This is accurate (it is called once at thread start and stored in a local variable), but the caching behavior is an emergent property of the call site in `start()`, not of this function. A reader looking at `build_augmented_path` in isolation would not understand why it claims to be cached. Suggestion: move the caching note to the call site as an inline comment (e.g., `let augmented_path = build_augmented_path(); // computed once, reused for thread lifetime`) and keep the function doc focused on what it does.

- **`src-tauri/src/tracker.rs` (PaneState struct, line 31)** -- The `PaneState` struct has no doc comment. Since it holds the core state model for the tracker, a brief comment explaining its fields (especially the non-obvious `pr_last_checked` initialization with `Instant::now() - PR_REFRESH_INTERVAL` in `track_pane`) would help maintainers understand the "check PR immediately on first poll" pattern.

- **`src-tauri/src/tracker.rs` (ToolResult enum, line 281)** -- The `ToolResult` enum has no doc comment. It carries meaningful semantics (distinguishing "tool binary not found" from "tool ran but failed") that warrant a brief explanation, especially since the `Err` variant silently swallows errors and the `ToolMissing` variant triggers a cooldown. A one-liner like `/// Result type that distinguishes "binary not on PATH" from other failures, enabling retry-after-cooldown for missing tools.` would clarify intent.

- **`src-tauri/src/pty.rs:57`** -- The field comment on `initial_cwd` says "CWD at spawn time -- fallback when OS-level CWD detection fails." This is accurate but could mention that this value is also used by the tracker via `get_cwd()` for the initial state, since the same string is passed to both `tracker.track_pane` and stored here. Knowing both copies exist helps maintainers keep them in sync.

- **`src-tauri/src/tracker.rs` (public methods `track_pane`, `untrack_pane`, `stop`)** -- These three public methods on `CwdTracker` have no doc comments. Since `CwdTracker` is a public struct used across module boundaries (`commands.rs` calls `track_pane`/`untrack_pane`, `lib.rs` calls `start`/`stop`), all public methods should have doc comments explaining their contract. For example, `track_pane` silently drops on poisoned mutex -- is that intentional? `stop` clears all pane state -- callers should know this.

- **`src-tauri/src/lib.rs:46-47`** -- The comment "Use build() + run() instead of Builder::run() so we can hook into RunEvent::Exit to clean up all PTY child processes and prevent orphans" is pre-existing but now slightly incomplete: the exit handler also stops the CwdTracker. Consider updating to mention both cleanup responsibilities: PTY processes and the tracker polling thread.

## Nitpicks

- **`src-tauri/src/tracker.rs:116`** -- The inline comment `// CWD change detection` is a section header that merely labels the obvious. The `if let Some(ref detected) = current_cwd` block immediately below makes the intent clear. Similarly, `// Git branch detection` at line 134 and `// PR detection` at line 152 are lightweight section markers. These are borderline -- they help scan a long function but add no insight. Consider extracting these blocks into named helper methods instead; the method names would serve as self-documenting section headers.

- **`src-tauri/src/tracker.rs:321`** -- The inline comment `// Exit code != 0 -- not a git repo or other error` in `get_git_branch` is accurate. However, `git rev-parse` also returns non-zero when run in a bare repo or when HEAD is unborn (freshly `git init`). Mentioning "not a git repo (or no commits yet)" would be slightly more precise for future maintainers debugging empty-repo edge cases.

- **`src-tauri/src/tracker.rs:354`** -- The inline comment `// Validate URL protocol` is accurate but the validation code on line 358 uses `url[..url.find(':').unwrap_or(10).min(20)]` for the error message, which could panic on multi-byte UTF-8 URLs if the slice boundary falls on a non-char boundary. This is not a comment issue per se, but the comment gives a false sense of completeness -- it validates protocol but not URL well-formedness. A note like `// Basic protocol check -- not a full URL validation` would set appropriate expectations.

- **`src-tauri/src/tracker.rs:236`** -- The inline comment `// No branch = no PR` is terse but accurate. It could mention why: `gh pr view` uses the current branch to find the associated PR, so if there is no branch there is nothing to query.

## Positive Findings

- **`src-tauri/src/pty.rs:48-50`** -- The doc comment on `PtySession` explaining the generation counter's purpose ("disambiguates sessions that reuse the same ID, preventing a stale reader thread from cleaning up a newly-created session") is excellent. It explains a non-obvious concurrency invariant that would be very difficult to reconstruct from the code alone.

- **`src-tauri/src/tracker.rs:16-17`** -- The doc comment on `EXTRA_PATH_DIRS` explaining why the augmented PATH is needed (Tauri launched from Dock/Spotlight inherits minimal PATH) captures a platform-specific gotcha that would otherwise require significant debugging to rediscover.

- **`src-tauri/src/tracker.rs:73`** -- The doc comment "Start the background polling thread. No-op if already running." is concise and precisely describes the contract including the idempotency guarantee.

- **`src-tauri/src/pty.rs:304-306`** -- The doc comment on `get_cwd` accurately describes the three-tier behavior: OS-level detection on macOS, fallback to initial CWD, and the return type semantics.

- **`src-tauri/src/lib.rs:42`** -- The inline comment `// Start CWD/branch/PR polling thread` is appropriately brief and helps readers understand the initialization sequence.
