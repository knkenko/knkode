# Security Audit -- PR #14: Config Store Hardening

## Summary

This PR meaningfully improves the security posture of the config store by adding Unix file permissions, corrupt-JSON backup handling, and a thorough theme sanitization/migration pipeline. The implementation is generally solid, with proper use of `is_finite()` checks, hex color validation, and allowlisted enum values. However, there are a few concrete issues: a TOCTOU gap in the temporary file permissions, missing range bounds on several numeric fields, and the `.corrupt` backup path inheriting the world-default umask.

## Must Fix

- **`config.rs:467-468` / `config.rs:477-486` -- Temporary file is written with default umask permissions before being renamed, then permissions are set after rename.** The `fs::write(&tmp_path, content)` call at line 467 creates the temp file with the process's default umask (typically 0o644 on most systems). The `fs::rename` at line 469 preserves those permissions. The `set_permissions(path, 0o600)` at line 480 only runs after the rename succeeds. There is a window where the file exists at the final path with world-readable permissions. Fix: set permissions on `tmp_path` before `fs::rename`, or use a lower-level API (e.g., `std::fs::OpenOptions` with mode) to create the temp file with 0o600 from the start.

- **`config.rs:431-435` -- Corrupt backup file `.corrupt` is written with default umask permissions.** `fs::copy(path, &backup)` at line 433 creates the backup file with default permissions (typically 0o644), meaning the corrupt config data -- which may contain user workspace paths, theme settings, or other potentially sensitive configuration -- is world-readable. The backup should also receive 0o600 permissions, consistent with other config files.

- **`config.rs:176-181` -- `unfocusedDim` passes `is_finite()` check but has no range clamp in sanitize_theme.** In `migrate_theme` (line 92), the value is properly clamped to `0.0..=0.7`. But in `sanitize_theme`, an already-migrated value is only checked for `is_finite()`, meaning a hand-edited config could set `unfocusedDim` to any float (e.g., -999.0, 1e308). The sanitizer should apply the same `clamp(0.0, 0.7)` or at minimum `clamp(0.0, 1.0)`.

## Suggestions

- **`config.rs:169-174` -- `fontSize` only checks `> 0.0` and `is_finite()`, allowing extreme values.** A hand-edited config could set fontSize to `0.001` or `99999.0`, which could cause rendering issues or UI denial-of-service (invisible text, memory-heavy font rendering). Consider bounding to a reasonable range like `6.0..=72.0`.

- **`config.rs:219-224` -- `scrollback`, `paneOpacity`, and `lineHeight` have no range validation beyond `is_finite()`.** Specifically: `scrollback` could be set to a negative number or an astronomically large value (causing memory exhaustion when the terminal allocates scrollback buffer); `paneOpacity` should logically be 0.0-1.0; `lineHeight` should have reasonable bounds. Add per-field range clamping or filtering.

- **`config.rs:200-208` -- `gradient` and `preset` strings are only checked for non-empty, with no length bound or character restriction.** While `fontFamily` (line 194) correctly restricts length to 128 and blocks `;{}`, these two fields accept any non-empty string of unbounded length. If these values are ever interpolated into CSS or terminal escape sequences downstream, they could be an injection vector. Apply a length limit consistent with `fontFamily`.

- **`config.rs:289-301` -- Snippet validation on read but not on write.** `is_valid_snippet` filters invalid snippets when reading (`get_snippets`, line 389), but `save_snippets` (line 392-395) writes the raw `Vec<Value>` to disk without any validation. This means invalid or malicious snippet data can be persisted and will only be silently dropped on the next read. Validate (or at minimum sanitize) on write as well, so the user gets immediate feedback if their data is malformed.

- **`config.rs:328-331` -- Migration runs on every read with no persistence.** `get_workspaces` applies `migrate_workspace` on every call but never writes the migrated result back to disk. This means the migration and sanitization pipeline runs repeatedly, and if there is ever a bug in migration logic, it will corrupt data in-memory on every read rather than being a one-time operation. Consider a write-back-on-migration strategy (with a version flag in the file) so migration is applied once.

## Nitpicks

- **`config.rs:427-429` -- `eprintln!` leaks the full file path and serde parse error to stderr.** While this is stderr (not returned to the frontend), in production builds this could end up in system logs. The serde error message can include fragments of the file content. Consider logging only the filename (not the full path) and a generic "parse failed" message, reserving the detailed error for debug builds.

- **`config.rs:249-258` -- `ansiColors` validation accepts extra keys silently.** The validation checks that all 16 required keys are present and valid hex, but does not reject an `ansiColors` object that contains additional unexpected keys. While not a security risk per se, it means arbitrary data can survive sanitization inside `ansiColors`. The `ac.clone()` on line 257 copies the entire object including extra keys.

- **`config.rs:44-51` -- `is_hex_color` does not accept 8-digit hex (RGBA) format.** Some theme editors and color pickers produce `#RRGGBBAA` format. This is not a security issue but could cause valid colors to be silently dropped and replaced with defaults, confusing users who hand-edit their config.
