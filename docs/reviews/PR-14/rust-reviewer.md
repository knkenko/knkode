# Rust Review: PR #14 — config-store-hardening

## Summary

Solid hardening PR that adds theme migration, input sanitization, corrupt-file recovery, and Unix permission enforcement to `ConfigStore`. The code is well-structured and idiomatic. A few issues around missing clamping on `unfocusedDim`, a potential data-loss race in the corrupt-backup path, and asymmetric sanitization on read vs write.

## Must Fix

- `config.rs:176-181` — `sanitize_theme` accepts any finite `unfocusedDim` value without clamping. The TypeScript type doc says it should be clamped to `[0, MAX_UNFOCUSED_DIM]` (0.9). A hand-edited config with `"unfocusedDim": 5.0` or `-1.0` would pass validation. Add `.map(|n| n.clamp(0.0, 0.9))` or at minimum `.filter(|n| *n >= 0.0 && *n <= 1.0)`.

- `config.rs:431-432` — The corrupt-file backup uses `fs::copy(path, &backup)` which silently overwrites any existing `.corrupt` backup. If the same file corrupts twice (e.g., user hand-edits, app reads, user edits again), the first backup is lost. Consider appending a timestamp or checking for existence before overwriting.

- `config.rs:334-355` — `save_workspace` writes the workspace value directly to disk without running it through `sanitize_theme` or `migrate_workspace`. This means invalid theme data from the frontend bypasses all validation. If validation is intentionally read-side only, add a doc comment stating that contract. Otherwise, sanitize on write too.

## Suggestions

- `config.rs:254` — Clippy warning: redundant closure `.is_some_and(|s| is_hex_color(s))` should be `.is_some_and(is_hex_color)`. Clippy already flags this; fix it to keep a clean `cargo clippy` output.

- `config.rs:219-224` — `scrollback`, `paneOpacity`, and `lineHeight` are only checked for `is_finite()` but have documented valid ranges in the TypeScript types (scrollback: 500-50000, paneOpacity: MIN_PANE_OPACITY to 1.0, lineHeight: 1.0 to 2.0). Consider clamping or rejecting out-of-range values in the Rust sanitizer rather than relying solely on the UI.

- `config.rs:53-57` — `is_effect_level` could use `.is_some_and()` instead of `.map(...).unwrap_or(false)` for consistency with the rest of the file (e.g., line 112, 254, 298).

- `config.rs:279-283` — In `migrate_workspace`, `ws.get("theme")` clones the theme value (since `Value::get` returns `&Value` and `sanitize_theme` takes `&Value`), but then it does `ws.as_object_mut()` to insert it back. This works but is slightly wasteful — consider using `if let Some(obj) = ws.as_object_mut()` once and operating on the mutable map directly to avoid the double traversal.

- `config.rs:477-487` — File permissions are set after `fs::rename`. On Unix, if the process crashes between rename and `set_permissions`, the file is world-readable momentarily. Consider setting permissions on the temp file before renaming. This is a minor hardening improvement since the directory is already 0o700.

## Nitpicks

- `config.rs:44-51` — `is_hex_color` only accepts 3- and 6-digit hex colors. If 8-digit hex (`#RRGGBBAA`) is ever used for alpha colors, this will reject them. Not a problem today (no 8-digit hex found in the codebase) but worth a comment noting the intentional restriction.

- `config.rs:240` — `"scrollbarAccent"` is listed under "EffectLevel fields" in `sanitize_theme`, which is correct per the TypeScript type, but the field name is semantically misleading (it sounds like a color, not a level). This is a naming issue from the TypeScript side, not a Rust bug — just noting it for awareness.

- `config.rs:264-271` — `default_theme()` duplicates the JSON structure that also appears in `migrate_theme` (lines 70-75). Consider calling `default_theme()` from `migrate_theme` to reduce duplication.

- `config.rs:55` — Minor style: `.map(|s| EFFECT_LEVELS.contains(&s))` allocates no extra memory but reads slightly more naturally as `.is_some_and(|s| EFFECT_LEVELS.contains(&s))` which also short-circuits the `unwrap_or`.
