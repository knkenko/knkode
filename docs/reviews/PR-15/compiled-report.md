# PR #15 Compiled Review Report

**PR**: feat: CWD tracker with git branch and PR detection
**Files**: 4 changed (tracker.rs +423, pty.rs +41, commands.rs +21, lib.rs +13)
**Agents**: 8 ran (code-reviewer, security-auditor, silent-failure-hunter, code-simplifier, dry-reuse, comment-analyzer, rust-reviewer, efficiency)

---

## Must Fix (6 items)

1. **`tracker.rs:362` — PR title truncation panics on multi-byte UTF-8**
   [code-reviewer, security-auditor, code-simplifier, rust-reviewer, efficiency, silent-failure-hunter] `&title[..MAX_PR_TITLE_LEN - 3]` slices by byte offset. Multi-byte characters (CJK, emoji) will panic at runtime. Fix: `title.chars().take(MAX_PR_TITLE_LEN - 3).collect::<String>()`.

2. **`commands.rs:79-80` — Tracker entry orphaned if PTY creation fails**
   [code-reviewer, code-simplifier, rust-reviewer, efficiency, silent-failure-hunter] `tracker.track_pane()` called before `pty_mgr.create()`. If create fails, pane is tracked with no PTY — polled forever with stale CWD. Fix: move `track_pane` after successful `create()`.

3. **`tracker.rs:166-182` / `tracker.rs:237-253` — Duplicated "clear PR" logic**
   [code-simplifier, dry-reuse] The 10-line block (lock panes, set `pr = None`, check `had_pr`, emit null event) is copy-pasted verbatim. Fix: extract `clear_pr_if_present()` helper.

4. **`tracker.rs:358,379-380,394` — Multiple byte-slice panics on untrusted strings**
   [rust-reviewer, security-auditor, code-reviewer, silent-failure-hunter] URL protocol log: `&url[..url.find(':').unwrap_or(10).min(20)]` panics on short URLs. Stdout log: uses raw byte length on lossy-decoded string. Stderr log: byte 200 can land mid-character. Fix: use `.get(..n).unwrap_or(&s)` or char-safe truncation throughout.

5. **`tracker.rs:284,326,401` — ToolResult::Err drops error context**
   [silent-failure-hunter] The `Err` variant carries no payload. I/O errors from git/gh are permanently lost. The two `ToolResult::Err => {}` match arms (lines 233, 262) silently discard them. Fix: add `Err(String)` payload, log in match arms.

6. **`tracker.rs:88` — `gh_logged_errors` HashSet grows unbounded**
   [code-reviewer, security-auditor, efficiency, rust-reviewer] Every unique stderr message stored forever. Misconfigured `gh` with timestamps/request IDs causes unbounded memory growth. Fix: cap size or periodically clear.

## Suggestions (14 items)

7. **`tracker.rs:90-264` — Extract per-pane processing into helper function**
   [code-reviewer, code-simplifier, efficiency] The poll loop body is ~175 lines with 6+ nesting levels. Extract `poll_pane()` for readability and testability.

8. **`tracker.rs` (9+ occurrences) — Repeated lock-get-mutate pattern**
   [code-simplifier, dry-reuse] Add `with_pane_mut()` helper to replace 9+ instances of the same boilerplate.

9. **`tracker.rs:305-308,335-338` — Add `GIT_TERMINAL_PROMPT=0` / `GH_PROMPT_DISABLED=1`**
   [security-auditor] Prevent `git`/`gh` from blocking on credential prompts, which would stall the polling thread.

10. **`tracker.rs:305-308,335-338` — Remove `GIT_DIR`/`GIT_WORK_TREE` from environment**
    [security-auditor, efficiency] Inherited env vars could redirect git to unexpected repo. At minimum `.env_remove("GIT_DIR").env_remove("GIT_WORK_TREE")`.

11. **`tracker.rs:54,68` — Log poisoned mutex in track_pane/untrack_pane**
    [silent-failure-hunter, rust-reviewer] Currently silently swallowed. Add `eprintln!` on failure.

12. **`tracker.rs:94,112` — Log before breaking on poisoned mutex in poll loop**
    [silent-failure-hunter] `Err(_) => break` with no logging — tracker silently dies.

13. **`tracker.rs:267` — Sleep should account for processing time**
    [efficiency] Unconditional 3s sleep makes effective cycle 3s + processing time. Use `Instant` delta.

14. **`tracker.rs:407-423` — Simplify `build_augmented_path` double-collect**
    [code-simplifier, efficiency] Use `.copied().filter().collect::<Vec<&str>>()` instead of `Vec<&&str>`.

15. **`lib.rs:49-51` — Store JoinHandle for tracker thread**
    [code-reviewer, rust-reviewer] `stop()` sets flag but no `join()`. `kill_all()` races with in-flight subprocess.

16. **`tracker.rs:270` — `.expect()` on thread spawn crashes the app**
    [rust-reviewer] CWD tracking is non-critical. Return `Result` or log and degrade gracefully.

17. **`pty.rs:18-32` — `detect_cwd` doesn't use augmented PATH**
    [security-auditor, dry-reuse] `lsof` at `/usr/sbin` is fine in practice but inconsistent. Add comment explaining.

18. **`tracker.rs:304-328,330-402` — Extract shared CLI execution helper**
    [dry-reuse] `get_git_branch` and `get_pr_status` share command/match structure. Extract `run_cli()`.

19. **`pty.rs:18-32` — Use iterator instead of collecting all lsof lines**
    [efficiency] `lsof` output can be large. Use `lines().skip_while(...)` instead of collecting to Vec.

20. **`tracker.rs:376-384` — Error log may leak sensitive gh output**
    [security-auditor] First 200 bytes of stdout printed. Could contain tokens during outage.

## Nitpicks (10 items)

21. **`tracker.rs:281-285` — Rename `ToolResult` to avoid `Ok`/`Err` shadow**
    [code-reviewer, code-simplifier, rust-reviewer, dry-reuse] Consider `ToolOutcome { Success, Missing, Failed }`.

22. **`tracker.rs:61` — Add comment explaining `Instant::now() - PR_REFRESH_INTERVAL` trick**
    [code-reviewer] Forces immediate first PR check — non-obvious.

23. **`pty.rs:34-37` — Add TODO for Linux `/proc/<pid>/cwd` support**
    [code-reviewer] Trivial to implement, currently returns None.

24. **`tracker.rs:368` — `number as u32` silently truncates u64**
    [rust-reviewer] Use `u32::try_from(number).unwrap_or(0)`.

25. **`tracker.rs:38-39` — Doc hardcodes "every 3 seconds"**
    [comment-analyzer] Reference `POLL_INTERVAL` constant name instead.

26. **`tracker.rs:287-288` — Doc says "available" but doesn't check availability**
    [comment-analyzer] Should say "no tool-missing state is active."

27. **`pty.rs:14-16` — Doc on `detect_cwd` is redundant with cfg gate**
    [comment-analyzer] Describe parsing logic instead of repeating "macOS".

28. **`tracker.rs:31` — Add doc comment to `PaneState` struct**
    [comment-analyzer] Non-obvious initialization pattern deserves explanation.

29. **`tracker.rs:379,394` — Magic number 200 for log truncation**
    [dry-reuse] Extract `const MAX_LOG_MSG_LEN: usize = 200`.

30. **`lib.rs:46-47` — Update exit comment to mention tracker cleanup**
    [comment-analyzer] Pre-existing comment only mentions PTY cleanup.
