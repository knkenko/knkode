# DRY / Reuse Analysis -- PR #14 (config-store-hardening)

## Summary

The PR adds well-structured migration, sanitization, and validation logic to the Rust config store. The main DRY concerns are (1) divergent default constants between the Rust backend and the TypeScript frontend that will silently produce different fallback values, (2) a duplicated `default_theme()` literal that appears in two places within the PR, and (3) a repeated pattern for extracting and mutating the workspace theme object.

## Must Fix

- `src-tauri/src/config.rs:13` vs `src/shared/types.ts:48` -- `DEFAULT_BACKGROUND` is `"#1a1a2e"` in Rust but `"#1e1e1e"` in TypeScript. When the backend sanitizes a theme with a missing/invalid background, it inserts a different color than what the frontend would use as its own fallback. These must agree or one side will silently override the other. Either pick a single canonical value or have the frontend always trust the backend-provided value and remove the frontend default.
- `src-tauri/src/config.rs:14` -- `DEFAULT_FOREGROUND` (`"#e0e0e0"`) has no TypeScript counterpart. If the frontend ever needs a foreground fallback (e.g. for canvas cursor color, selection highlight), it will invent its own. Add a `DEFAULT_FOREGROUND` export to `src/shared/types.ts` so the source of truth is shared.

## Suggestions

- `src-tauri/src/config.rs:66-77` and `src-tauri/src/config.rs:264-271` -- The `default_theme()` JSON literal is duplicated: once inline in `migrate_theme`'s `None` branch and once in the standalone `default_theme()` function. The `migrate_theme` fallback should call `default_theme()` instead of re-spelling the literal. This prevents the two from drifting if a new required field is added.
- `src-tauri/src/config.rs:63` and `src-tauri/src/config.rs:105` -- Both `migrate_theme` and `migrate_effect_levels` open with the identical pattern `ws.get_mut("theme").and_then(|t| t.as_object_mut())` followed by a `None => return ws` guard. Consider extracting a small helper (e.g. `fn theme_object_mut(ws: &mut Value) -> Option<&mut Map<String, Value>>`) to make the intent clearer and avoid the boilerplate.
- `src-tauri/src/config.rs:17-18` and `src/shared/types.ts:11,15` -- `CURSOR_STYLES` and `EFFECT_LEVELS` are duplicated between Rust and TypeScript with identical values. This is inherent in a cross-language boundary, but consider adding a comment in both files referencing the other as the canonical counterpart, so future editors know to update both. Alternatively, a shared JSON schema or build-time codegen could keep them in sync.
- `src-tauri/src/config.rs:20-37` and `src/shared/types.ts:60-77` -- `ANSI_KEYS` (Rust array) mirrors the `AnsiColors` interface fields in TypeScript. Same cross-language concern as above; a comment cross-reference would help.
- `src-tauri/src/config.rs:313-318` and `src-tauri/src/config.rs:477-486` -- The Unix permission-setting pattern (`use PermissionsExt; fs::Permissions::from_mode(...)`) is repeated twice with different modes (0o700 for directory, 0o600 for files). Consider extracting a `set_unix_permissions(path: &Path, mode: u32) -> Result<(), String>` helper to centralize the `#[cfg(unix)]` guard and error formatting. This also makes it easier to add logging or test mocking later.

## Nitpicks

- `src-tauri/src/config.rs:200-208` -- The validation for `gradient` and `preset` fields uses an identical pattern (get string, check non-empty, insert). These could be collapsed into the same loop or a small helper like `copy_nonempty_string(obj, &mut result, field)`, matching the style already used for hex color fields on line 184 and numeric fields on line 219.
- `src-tauri/src/config.rs:119-134` -- The `animatedGlow` and `scanline` migration blocks in `migrate_effect_levels` are structurally identical (check boolean == true, check existing level, insert "medium", remove legacy key). A small closure or helper `migrate_bool_to_level(theme, old_key, new_key)` would reduce the repetition and make adding similar migrations trivial.
- `src-tauri/src/config.rs:15` -- `DEFAULT_FONT_SIZE` is `14.0` (f64) in Rust and `14` (number) in TypeScript. These are semantically equal but worth a comment noting the cross-language pairing, consistent with the suggestion above.
