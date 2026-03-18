# PR #14 Code Review: Config Store Hardening

**Reviewed file:** `src-tauri/src/config.rs` (331 lines added)
**Branch:** `feature/config-store-hardening` -> `main`

## Summary

Solid hardening PR that adds corrupt JSON backup, Unix file permissions, theme migration, sanitization, and snippet validation. The migration logic is generally correct, but there is one default-value mismatch between the Rust backend and the TypeScript frontend that will produce different fallback themes depending on which layer fills the default, and the `sanitize_theme` function does not clamp `unfocusedDim` to the valid range, which could let out-of-range values through.

## Must Fix

- **`src-tauri/src/config.rs:13` -- `DEFAULT_BACKGROUND` disagrees with TypeScript constant.** The Rust constant is `#1a1a2e` but `src/shared/types.ts:48` defines `DEFAULT_BACKGROUND = "#1e1e1e"`. When `sanitize_theme` falls back to the Rust default (e.g., a workspace with a missing or non-hex background), the user sees a different color than what the frontend would produce on its own. These must match. Fix: change the Rust constant to `#1e1e1e` to match the frontend, or extract both from a single shared source.

- **`src-tauri/src/config.rs:164-168` -- `sanitize_theme` does not clamp `unfocusedDim`.** The migration function `migrate_theme` correctly clamps to `[0.0, 0.7]`, but `sanitize_theme` only checks `is_finite()`. A hand-edited config with `"unfocusedDim": 5.0` or `"unfocusedDim": -1.0` passes validation unclamped. The TypeScript type documents clamping to `[0, MAX_UNFOCUSED_DIM (0.9)]`. Fix: add `.filter(|n| *n >= 0.0 && *n <= 0.9)` or `.map(|n| n.clamp(0.0, 0.9))` to the `unfocusedDim` chain in `sanitize_theme`, matching `MAX_UNFOCUSED_DIM` from `types.ts`.

## Suggestions

- **`src-tauri/src/config.rs:183-189` -- `paneOpacity`, `scrollback`, and `lineHeight` lack range validation.** These are validated only with `is_finite()`, but all three have defined valid ranges in `types.ts`: `paneOpacity` in `[0.05, 1.0]`, `scrollback` in `[500, 50000]`, `lineHeight` in `[1.0, 2.0]`. While the UI clamps these on save, a hand-edited file (the stated use case for `sanitize_theme`) could have out-of-range values. Consider clamping or filtering by range per field, consistent with the "config files may be hand-edited" comment on `sanitize_theme`.

- **`src-tauri/src/config.rs:430-435` -- Corrupt backup silently overwrites previous `.corrupt` file.** If the same file is corrupted repeatedly (e.g., a bug in a third-party editor), each new corruption overwrites the previous backup with no history. Consider appending a timestamp to the backup filename (e.g., `.corrupt.1710720000`) or at minimum logging a warning when a `.corrupt` backup already exists.

- **`src-tauri/src/config.rs:156-161` -- `fontSize` in `sanitize_theme` has no upper/lower bound.** The TypeScript defines `MIN_FONT_SIZE = 8` and `MAX_FONT_SIZE = 32`. A hand-edited value of `fontSize: 0.001` or `fontSize: 9999` passes the `> 0.0` check. Consider clamping to the same `[8, 32]` range.

## Nitpicks

- **`src-tauri/src/config.rs:48-50` -- `is_hex_color` rejects `#RRGGBBAA` 8-digit hex.** This is fine for current usage (no 8-digit hex found in the codebase), but worth a comment noting the intentional omission of CSS4 8-digit hex support.

- **`src-tauri/src/config.rs:88-91` -- `migrate_theme` clamps converted opacity to `[0.0, 0.7]` but `MAX_UNFOCUSED_DIM` in TypeScript is `0.9`.** The clamp ceiling of 0.7 means a legacy `opacity: 0.0` (fully transparent pane) maps to `unfocusedDim: 0.7` -- which is reasonable for migration. But the hardcoded `0.7` is a magic number that doesn't correspond to any named constant. Consider defining `MAX_MIGRATED_DIM` or adding a comment explaining why 0.7 was chosen over 0.9.

- **`src-tauri/src/config.rs:197-199` -- `scrollbarAccent` grouped with `EffectLevel` fields.** The field name `scrollbarAccent` is semantically an accent configuration, not an "effect level", though it uses the `EffectLevel` type. The grouping is technically correct but could confuse a future reader. A brief inline comment would help.
