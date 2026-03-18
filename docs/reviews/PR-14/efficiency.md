# Efficiency Review -- PR #14 (`feature/config-store-hardening`)

## Summary

The migration and sanitization logic is clean and well-structured, but running the full `migrate_workspace` pipeline (two migrations + sanitize rebuild) on every `get_workspaces()` call is the dominant efficiency concern. There are also several avoidable allocations from `json!()` wrapping already-valid values and a redundant theme extraction in `migrate_workspace`.

## Must Fix

- **`config.rs:328-331` -- Migration pipeline runs on every read with no persistence.** `get_workspaces()` calls `migrate_workspace` on every element of the array on every invocation, but never writes the migrated result back to disk. This means the same migration + sanitization work repeats on every frontend IPC call. For N workspaces, this is O(N) allocations and field scans per read. Either (a) persist migrations on first read (migrate-on-load, write-back once), or (b) run migrations only in `save_workspace` / at startup and cache the result. Option (a) is simplest: after mapping, if any workspace was actually mutated, write the array back atomically so subsequent reads skip migration entirely.

- **`config.rs:274-287` -- `sanitize_theme` rebuilds the theme Map from scratch every call, even for already-valid themes.** `sanitize_theme` always allocates a new `Map`, copies every field via `json!()` (which allocates a new `Value::String` for each), and replaces the original. For a theme that is already correct (the common case after the first migration), this is pure waste. Consider a validation-only fast path: scan the theme object for invalid fields first; if everything passes, return the original `Value` by reference/clone instead of rebuilding.

## Suggestions

- **`config.rs:146-261` -- Excessive `json!()` macro use for trivial string copies.** Lines like `result.insert("background".to_string(), json!(bg))` where `bg` is already a `&str` could use `Value::String(bg.to_string())` directly, avoiding the `json!()` macro overhead (which goes through the `serde_json::value::to_value` path). This is minor per-call but happens ~20+ times per theme sanitization. Similarly, `json!(s)` for validated strings could be `Value::String(s.to_string())`.

- **`config.rs:274-287` -- Double theme extraction in `migrate_workspace`.** `migrate_theme` and `migrate_effect_levels` each independently call `ws.get_mut("theme").and_then(|t| t.as_object_mut())` to locate the theme. Then `migrate_workspace` calls `ws.get("theme")` a third time to pass to `sanitize_theme`. Three separate lookups into the same JSON map for the same key. Consider restructuring so the theme object is extracted once and passed through the pipeline.

- **`config.rs:249-258` -- `ansiColors` clone is an all-or-nothing deep copy.** `Value::Object(ac.clone())` clones all 16 color entries even though they were just validated in place. If `sanitize_theme` operated in-place (retaining valid fields, removing invalid ones), this clone would be unnecessary.

- **`config.rs:120,129` -- `json!(true)` allocates for comparison.** `theme.get("animatedGlow") == Some(&json!(true))` creates a temporary `Value::Bool(true)` on each call just for an equality check. Use `theme.get("animatedGlow").and_then(|v| v.as_bool()) == Some(true)` instead, which is zero-allocation.

- **`config.rs:431-435` -- Corrupt backup overwrites previous backup without rotation.** If the file is corrupt on multiple reads (e.g., repeated `get_workspaces` calls before anyone fixes it), `fs::copy` overwrites the `.corrupt` backup each time. This is wasted I/O. Consider checking if the backup already exists before copying, or appending a timestamp.

## Nitpicks

- **`config.rs:184,219,235` -- Static arrays could be const slices.** The inline arrays `["accent", "glow", ...]`, `["scrollback", "paneOpacity", ...]`, and the effect-level field list are constructed on the stack each call. These are tiny and the compiler likely optimizes them, but for consistency with `CURSOR_STYLES` and `EFFECT_LEVELS` (which are top-level `const`), consider promoting them to module-level constants.

- **`config.rs:62,104` -- Migration functions take `Value` by move and return it.** This is fine for the pipeline pattern, but `migrate_theme` and `migrate_effect_levels` both have early-return paths that return `ws` unchanged. The compiler should optimize this (NRVO), but it is worth confirming with a release build that no unnecessary deep copies occur on the no-op path.

- **`config.rs:160,167,174,181,187,195,214` -- Repeated `.to_string()` on string literals for Map keys.** Every `result.insert("background".to_string(), ...)` allocates a new heap `String` for the key. This is inherent to `serde_json::Map<String, Value>` and cannot be avoided without changing the representation, so this is informational only.
