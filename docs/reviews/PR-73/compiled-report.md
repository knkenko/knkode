# Compiled Review — PR #73: Session History v2

**Summary:** 5 files reviewed, 11 agents ran (code-reviewer, security-auditor, silent-failure-hunter, code-simplifier, dry-reuse, comment-analyzer, type-design, frontend-ui, rust-review, typescript-review, efficiency)

---

## Must Fix (8 items)

1. **`src-tauri/src/session_scanner.rs:484-491` — SQL injection via string interpolation in sqlite3 shell-out**
   [security-auditor, rust-review, code-reviewer, code-simplifier, dry-reuse, efficiency, silent-failure-hunter]
   CWD interpolated into SQL with only `replace('\'', "''")`. A CWD containing a newline followed by `.shell` could execute arbitrary commands. Validate CWD contains no control characters/newlines before interpolation, or use `-cmd ".param set"` approach.

2. **`src-tauri/src/session_scanner.rs:267` — `read_to_string` fails on invalid UTF-8 at seek boundary**
   [code-reviewer, rust-review, security-auditor]
   `extract_claude_tail_metadata` seeks to `file_len - 8192`. If the seek lands mid-multibyte character (emoji, non-ASCII), `read_to_string` errors and returns `(None, None)` — losing title and last_updated for that session. Fix: use `read_to_end` into `Vec<u8>` and `String::from_utf8_lossy`.

3. **`src-tauri/src/session_scanner.rs:692` — `secs as u64` wraps negative values**
   [rust-review, security-auditor, silent-failure-hunter, code-reviewer]
   `unix_to_iso` casts `i64` to `u64` via `as`. Negative values from corrupt DB rows wrap to huge positive numbers, producing far-future dates that corrupt sort order. Fix: `let secs_u64 = secs.max(0) as u64;`.

4. **`src-tauri/src/session_scanner.rs:513` — Tab-delimited SQLite output breaks on embedded tabs/newlines**
   [code-reviewer, rust-review]
   `split('\t')` parsing breaks if `title` or `first_user_message` contains tabs (shifts columns) or newlines (splits rows). Fix: use `splitn('\t', 7)` so the last field captures remaining content, or switch to `sqlite3 -json` mode.

5. **`src/components/SessionHistoryModal.tsx:144` — Duplicate conflicting `max-w` classes**
   [frontend-ui, code-simplifier, code-reviewer, typescript-review]
   `max-w-xl max-w-[calc(100vw-2rem)]` — `max-w-xl` is dead code. Fix: replace with `max-w-[min(36rem,calc(100vw-2rem))]`.

6. **`src/components/SessionHistoryModal.tsx:116-129` — No focus trap in modal**
   [frontend-ui]
   Tab/Shift+Tab escapes the dialog into background content. `SettingsPanel.tsx:335-362` implements a proper focus trap — match that pattern. Required for WCAG 2.1 SC 2.4.3 with `aria-modal="true"`.

7. **`src/components/SessionHistoryModal.tsx:163-180` — Filter tabs missing focus-visible styles**
   [frontend-ui]
   `FOCUS_RING` applied to resume/close buttons but not filter tabs. Keyboard users can't see focus. Add `${FOCUS_RING}` to filter tab classNames.

8. **`src-tauri/src/session_scanner.rs:689-711` — Redundant SystemTime round-trip in `unix_to_iso`**
   [rust-review, code-simplifier, efficiency]
   Constructs `SystemTime` from `secs`, then immediately calls `duration_since(UNIX_EPOCH)` to get the same value back. Dead `Err` branch. Simplify to direct arithmetic on `secs`.

## Suggestions (15 items)

1. **`src-tauri/src/session_scanner.rs:169-233` — Double file open per Claude session**
   [efficiency]
   `parse_claude_session` opens file, then `extract_claude_tail_metadata` opens the same file again. Pass the file handle or restructure to use a single open.

2. **`src-tauri/src/session_scanner.rs:93-105` — `build_augmented_path()` rebuilt 3 times per scan**
   [efficiency]
   Called once per agent detection. Compute once and pass to each `is_command_available` call.

3. **`src-tauri/src/session_scanner.rs` (multiple locations) — Silent failures with no logging**
   [silent-failure-hunter]
   `extract_claude_tail_metadata` (3 error points), `parse_claude_session`, `parse_gemini_session`, `scan_codex_sqlite` all return None/empty on errors with zero logging. Add `tracing::debug!` or `tracing::warn!` on unexpected failures.

4. **`src-tauri/src/session_scanner.rs:6,231,479,536` — Stale/inaccurate comments (4 instances)**
   [comment-analyzer, code-simplifier]
   - Line 6: module doc says "sorted by timestamp descending" → now sorts by `last_updated`
   - Line 231: claims "last-prompt" extraction which doesn't exist
   - Line 479: uses `|` separator in comment but actual separator is `\t`
   - Line 536: says "if it differs from first_user_message" but code only checks `is_empty()`

5. **`src/components/SessionHistoryModal.tsx:34` — `FOCUS_RING` duplicates `FOCUS_VIS`**
   [dry-reuse]
   Character-for-character identical to `FOCUS_VIS` at `src/components/pane-chrome/shared.tsx:37-38`. Import and reuse instead.

6. **`src/components/SessionHistoryModal.tsx:36-54` — Parameter sprawl in `SessionRow`**
   [code-simplifier]
   5 individual token props instead of a single `tokens: SessionHistoryTokens` object. The project pattern (e.g., `AddPaneButton`) passes a single tokens object.

7. **`src/components/SessionHistoryModal.tsx:80` — `!important` overrides for unsafe button**
   [code-simplifier, frontend-ui, code-reviewer, typescript-review]
   `!text-danger hover:!bg-danger hover:!text-canvas` to override theme tokens. Fragile — consider a dedicated `unsafeButton` token or separate class.

8. **`src/components/SessionHistoryModal.tsx:104-107` — Repeated "resolve active preset" pattern**
   [dry-reuse]
   Same `workspaces.find + toPresetName` pattern appears in `Sidebar.tsx:107-110`. Extract a `useActivePreset` hook.

9. **`src-tauri/src/session_scanner.rs:519-545` — Repeated `non_empty` pattern**
   [code-simplifier, dry-reuse]
   Three `if !x.is_empty() { Some(truncate_summary(x)) } else { None }` blocks. Extract a `non_empty_summary` helper.

10. **`src-tauri/src/session_scanner.rs:383-395` — Gemini TOCTOU: `metadata()` then `read_to_string()`**
    [efficiency]
    File could change between check and read. Open once, check metadata from handle, read from handle.

11. **`src-tauri/src/session_scanner.rs:480-492` — No timeout on sqlite3 subprocess**
    [security-auditor]
    If SQLite DB is locked, `sqlite3` could hang indefinitely blocking the Tauri command thread.

12. **`src/components/SessionHistoryModal.tsx:55` — Empty string `lastUpdated` doesn't null-coalesce**
    [silent-failure-hunter]
    `unix_to_iso` can return `""` on error. `lastUpdated ?? timestamp` won't fall through on `""` — will show "unknown" even when valid `timestamp` exists.

13. **`src/store/session-history-actions.ts:64-71` — Resume error with no user feedback**
    [silent-failure-hunter]
    If `writePty` or `buildResumeCommand` throws, user gets zero visual feedback. Consider a toast or error state.

14. **`src-tauri/src/session_scanner.rs:694` — Stale planning comment**
    [rust-review, code-simplifier, comment-analyzer]
    "Format via the humantime crate pattern" is a leftover dev note. Remove.

15. **`src-tauri/src/session_scanner.rs:709` — `unix_to_iso` returns empty string on error**
    [silent-failure-hunter]
    Empty string flows to frontend producing "unknown" timestamp with no way to investigate root cause.

## Nitpicks (11 items)

1. **`src-tauri/src/session_scanner.rs:693` — Redundant `let dt: SystemTime = d;` binding**
   [rust-review, security-auditor, silent-failure-hunter]

2. **`src/components/AgentIcons.tsx:5,56` — `className?: string | undefined` — `| undefined` redundant with `?`**
   [code-simplifier, type-design]
   Note: may be required by `exactOptionalPropertyTypes` — verify before removing.

3. **`src/components/SessionHistoryModal.tsx:85` — Unsafe button label not themed**
   [code-simplifier]
   Lowercase `unsafe` while `resumeLabel` uses themed casing. Consider a themed `unsafeLabel` token.

4. **`src-tauri/src/session_scanner.rs:717` — Operator precedence ambiguity in era calculation**
   [rust-review]
   Add parentheses: `(if z >= 0 { z } else { z - 146096 }) / 146097`.

5. **`src-tauri/src/session_scanner.rs:248` — `CLAUDE_TAIL_BYTES` may miss metadata**
   [efficiency]
   8 KB tail window may miss custom-title if session has long recent outputs.

6. **`ThemeRegistry.tsx` — ~560 lines of session history tokens across 16 variants**
   [efficiency, code-simplifier]
   Could derive from base + overrides to reduce duplication. Follows established pattern though.

7. **`src-tauri/src/session_scanner.rs:282` — Duplicate custom-title comment**
   [comment-analyzer]
   Partially duplicates comment on line 274.

8. **`src/components/AgentIcons.tsx:4-6` — `IconProps` duplicated inline at `AgentIcon`**
   [type-design]
   Extract `AgentIconProps` extending `IconProps` with `agent`.

9. **`src/shared/types.ts:276` — Document `lastUpdated` fallback contract**
   [type-design]
   Add JSDoc noting consumers should fall back to `timestamp` when null.

10. **`src/components/sidebar-variants/types.ts:99` — `resumeLabel` doc example outdated**
    [typescript-review]
    Lists `"jack_in"` but Cyberpunk uses `"[ RESUME ]"`.

11. **`src/components/SessionHistoryModal.tsx:10-14` — `AGENT_LABELS` could co-locate with `AGENT_ICONS`**
    [frontend-ui]
    Prevent divergence if a new agent kind is added.
