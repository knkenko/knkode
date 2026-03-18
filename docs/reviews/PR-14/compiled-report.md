# PR #14 Compiled Review Report

**PR**: feat: config store hardening — migrations, sanitization, permissions
**Files**: 1 changed (src-tauri/src/config.rs, 331 lines added)
**Agents**: 8 ran (code-reviewer, security-auditor, silent-failure-hunter, code-simplifier, dry-reuse, comment-analyzer, rust-reviewer, efficiency)

---

## Must Fix (5 items)

1. **`config.rs:13` — DEFAULT_BACKGROUND disagrees with TypeScript**
   [code-reviewer, code-simplifier, dry-reuse] Rust uses `#1a1a2e` but `src/shared/types.ts:48` exports `DEFAULT_BACKGROUND = "#1e1e1e"`. Backend sanitization falls back to a different color than the frontend. Fix: align Rust constant to `#1e1e1e`.

2. **`config.rs:176-181` — `sanitize_theme` does not clamp `unfocusedDim`**
   [code-reviewer, security-auditor, rust-reviewer] Only checks `is_finite()` — hand-edited values like `5.0` or `-1.0` pass. `migrate_theme` correctly clamps to `[0.0, 0.7]` but sanitize doesn't. Fix: add `.map(|n| n.clamp(0.0, 0.9))` matching `MAX_UNFOCUSED_DIM`.

3. **`config.rs:467-486` — Temp file written with default umask before rename**
   [security-auditor] `fs::write` creates the temp file with process umask (typically 0o644). Permissions are set after rename, leaving a window where the file is world-readable. Fix: set permissions on `tmp_path` before `fs::rename`. Also: `.corrupt` backup file gets default umask — should receive 0o600 too.

4. **`config.rs:68-75` — Duplicated default theme literal**
   [code-simplifier, dry-reuse, rust-reviewer] The inline `json!({...})` in `migrate_theme` duplicates `default_theme()`. Fix: call `default_theme()` instead.

5. **`config.rs:59-61` — Misleading doc comment on `migrate_theme`**
   [comment-analyzer] Claims input range `0.3-1.0` but code accepts any finite float. Also: `read_json_array` and `read_json_object` comments say "if file doesn't exist" but now also return fallback for corrupt JSON.

## Suggestions (13 items)

6. **`config.rs:156-224` — Numeric fields lack range validation**
   [code-reviewer, security-auditor, rust-reviewer] `fontSize` (only `> 0.0`), `scrollback`, `paneOpacity`, `lineHeight` accept any finite value. The TS types define ranges: fontSize [8,32], scrollback [500,50000], paneOpacity [0.05,1.0], lineHeight [1.0,2.0]. Clamp in sanitizer.

7. **`config.rs:119-135` — Duplicated boolean-to-level migration pattern**
   [code-simplifier, dry-reuse] `animatedGlow→glowLevel` and `scanline→scanlineLevel` are structurally identical. Extract into a loop over `[("animatedGlow", "glowLevel"), ("scanline", "scanlineLevel")]`.

8. **`config.rs:120,129` — `json!(true)` allocates for comparison**
   [efficiency] Use `theme.get("animatedGlow").and_then(|v| v.as_bool()) == Some(true)` instead — zero allocation.

9. **`config.rs:200-208` — `gradient` and `preset` strings have no length limit**
   [security-auditor] `fontFamily` correctly limits to 128 chars and blocks `; { }`, but these fields accept unbounded strings. Apply consistent length limits.

10. **`config.rs:273-287` — Double theme extraction in `migrate_workspace`**
    [code-simplifier, efficiency, rust-reviewer] Three separate lookups for the same `"theme"` key. Restructure to a single `as_object_mut()` entry point.

11. **`config.rs:254` — Clippy warning: redundant closure**
    [rust-reviewer] `.is_some_and(|s| is_hex_color(s))` → `.is_some_and(is_hex_color)`.

12. **`config.rs:53-57` — `is_effect_level` style**
    [code-simplifier, rust-reviewer] `.map(...).unwrap_or(false)` → `.is_some_and(...)`.

13. **`config.rs:386-389` — Snippet filtering silently drops entries**
    [silent-failure-hunter] No log when invalid snippets are filtered out. Add `eprintln!` for dropped snippets.

14. **`config.rs:144-145` — `sanitize_theme` doc comment incomplete**
    [comment-analyzer] Should note two-tier behavior (required fields get defaults, optional fields dropped) and qualify "PaneTheme" as a TypeScript interface.

15. **`config.rs:100-103` — `migrate_effect_levels` doc comment incomplete**
    [comment-analyzer] Only describes `true` case. `false` values are silently removed without adding a level field — should be documented.

16. **`config.rs:441,450` — `read_json_array`/`read_json_object` comments stale**
    [comment-analyzer] Say "if file doesn't exist" but now also cover corrupt JSON. Update to "if file doesn't exist or contains corrupt JSON."

17. **`config.rs:477-487` — Set permissions on temp file before rename**
    [rust-reviewer, security-auditor] Minor hardening — set 0o600 on `tmp_path` before `fs::rename` to eliminate the race window. Directory is already 0o700 so exposure is limited.

18. **`config.rs:14` — `DEFAULT_FOREGROUND` has no TypeScript counterpart**
    [dry-reuse] Add `DEFAULT_FOREGROUND` export to `src/shared/types.ts` for cross-language consistency.

## Nitpicks (6 items)

19. **`config.rs:44-51` — `is_hex_color` rejects 8-digit hex**
    [code-reviewer, security-auditor, rust-reviewer] Fine for now, worth a comment noting intentional restriction.

20. **`config.rs:92` — Magic number 0.7 in migrate_theme clamp**
    [code-reviewer, code-simplifier] Consider named constant `MAX_MIGRATED_DIM` with comment explaining why 0.7 (not 0.9).

21. **`config.rs:194` — fontFamily sanitization rules undocumented**
    [code-simplifier] 128-char limit and `; { }` block should have a brief comment explaining CSS injection prevention.

22. **`config.rs:240` — `scrollbarAccent` naming misleading among EffectLevel fields**
    [code-reviewer, rust-reviewer, code-simplifier] Correct per TS type but name suggests color. Brief inline comment would help.

23. **`config.rs:249-258` — `ansiColors` validation is all-or-nothing**
    [silent-failure-hunter, security-auditor] One bad color drops all 16. Acceptable for v1 parity but could be noted in comment.

24. **`config.rs:278` — Comment says "in place" but creates a new sanitized copy**
    [comment-analyzer] "Replace the theme with a sanitized copy" is more accurate.
