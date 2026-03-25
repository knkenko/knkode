# DRY / Reuse Analysis -- PR #73

## Summary

The PR introduces moderate amounts of new code across Rust (session scanner enhancements) and React (themed session history modal, agent icons). Most new code is genuinely novel or follows established codebase patterns. Two concrete reuse opportunities exist: a duplicated focus-ring constant and a repeated "resolve active workspace preset" pattern across components.

## Must Fix

None

## Suggestions

- **`FOCUS_RING` duplicates `FOCUS_VIS` from `pane-chrome/shared.tsx`**: `src/components/SessionHistoryModal.tsx:34` defines `const FOCUS_RING = "focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none"` which is character-for-character identical to the already-exported `FOCUS_VIS` at `src/components/pane-chrome/shared.tsx:37-38`. Import and reuse `FOCUS_VIS` instead of declaring a local duplicate.

- **Repeated "resolve active workspace preset" pattern**: `src/components/SessionHistoryModal.tsx:104-107` computes the active preset with `workspaces.find((w) => w.id === activeWorkspaceId)` + `toPresetName(ws?.theme.preset)`. This exact pattern also appears at `src/components/Sidebar.tsx:107-110`. Consider extracting a shared hook (e.g., `useActivePreset`) that encapsulates these two store selectors and the `useMemo` derivation. This would eliminate the three-line repetition and make it harder to forget the `useMemo` wrapper in future consumers.

## Nitpicks

- **`!str.is_empty()` guard repeated for title/summary in `scan_codex_sqlite`**: `src-tauri/src/session_scanner.rs:537-546` repeats the pattern `if !raw.is_empty() { Some(truncate_summary(raw)) } else { None }` twice in succession for `title_raw` and `first_user_msg`. A tiny helper like `fn non_empty_summary(s: &str) -> Option<String>` would reduce this to two one-liners, though the repetition is minor.

- **SQL string interpolation in `scan_codex_sqlite`**: `src-tauri/src/session_scanner.rs:484-491` builds a SQL query via `format!()` with `project_cwd.replace('\'', "''")` for escaping. While the input (`project_cwd`) is not user-controlled (it comes from the app's own workspace config), this hand-rolled escaping is fragile -- a path containing a backslash-single-quote sequence could still escape incorrectly. The `sqlite3` CLI does not support parameterized queries, so this is hard to fix without switching to `rusqlite`, but it is worth noting as a known limitation in a code comment.
