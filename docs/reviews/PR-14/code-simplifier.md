# PR #14 Code Simplification Review

## Summary

The PR adds well-structured migration, sanitization, and validation logic to the Rust config store. The main opportunities for simplification are: eliminating a duplicated default-theme literal, extracting the repeated boolean-to-level migration pattern into a loop, consolidating similar optional-string validation blocks, and fixing a `DEFAULT_BACKGROUND` constant that diverges from the TypeScript source of truth.

## Must Fix

- `src-tauri/src/config.rs:13` — `DEFAULT_BACKGROUND` is `"#1a1a2e"` but the canonical TypeScript constant in `src/shared/types.ts:48` is `"#1e1e1e"`. The Rust sanitizer will silently rewrite backgrounds to a different color than the frontend expects. Align to the TS value or extract both from a shared source.

- `src-tauri/src/config.rs:68-75` — The inline `json!({...})` block in `migrate_theme` is an exact duplicate of `default_theme()` (lines 264-271). If the defaults ever change, one will be missed. Replace with `obj.insert("theme".to_string(), default_theme());`.

## Suggestions

- `src-tauri/src/config.rs:119-135` — The `animatedGlow`-to-`glowLevel` and `scanline`-to-`scanlineLevel` migrations are copy-pasted with only the key names changed. Extract into a loop over `[("animatedGlow", "glowLevel"), ("scanline", "scanlineLevel")]` that performs the same check-insert-remove sequence. This eliminates the duplicated logic and makes adding future boolean-to-level migrations trivial:
  ```rust
  for (old_key, new_key) in [("animatedGlow", "glowLevel"), ("scanline", "scanlineLevel")] {
      if theme.contains_key(old_key) {
          if theme.get(old_key) == Some(&json!(true))
              && !is_effect_level(theme.get(new_key).unwrap_or(&Value::Null))
          {
              theme.insert(new_key.to_string(), json!("medium"));
          }
          theme.remove(old_key);
      }
  }
  ```
  This also removes the need for the `has_animated_glow` / `has_scanline` boolean variables (lines 110-111) and the early-return guard that checks them (line 115), since the loop naturally short-circuits when `theme.contains_key(old_key)` is false.

- `src-tauri/src/config.rs:199-209` — The `gradient` and `preset` blocks are identical "optional non-empty string" checks. Combine them into a loop alongside the existing hex-color loop pattern used at line 184:
  ```rust
  for field in ["gradient", "preset"] {
      if let Some(s) = obj.get(field).and_then(|v| v.as_str()) {
          if !s.is_empty() {
              result.insert(field.to_string(), json!(s));
          }
      }
  }
  ```

- `src-tauri/src/config.rs:110-116` — `has_animated_glow`, `has_scanline`, and `has_gradient_without_level` are computed eagerly, then the function returns early if all three are false. If the loop suggestion above is adopted, only `has_gradient_without_level` needs to remain as a pre-check (and even that can move inline). This removes three local variables and the early-return branch.

- `src-tauri/src/config.rs:273-287` — `migrate_workspace` takes ownership, passes through two migration functions, then does a mutable borrow to replace the theme. The `if let Some(theme) = ws.get("theme")` / `if let Some(obj) = ws.as_object_mut()` double-unwrap can be simplified to a single mutable access:
  ```rust
  fn migrate_workspace(ws: Value) -> Value {
      let ws = migrate_theme(ws);
      let mut ws = migrate_effect_levels(ws);
      if let Some(obj) = ws.as_object_mut() {
          if let Some(theme) = obj.get("theme") {
              let sanitized = sanitize_theme(theme);
              obj.insert("theme".to_string(), sanitized);
          }
      }
      ws
  }
  ```
  This avoids the borrow-then-reborrow pattern (immutable `ws.get("theme")` followed by `ws.as_object_mut()`) that only works because the cloned `sanitized` value outlives the immutable borrow. Being explicit about the single `as_object_mut()` entry point is clearer.

## Nitpicks

- `src-tauri/src/config.rs:53-57` — `is_effect_level` uses `.map(...).unwrap_or(false)` which can be simplified to `.is_some_and(...)`:
  ```rust
  fn is_effect_level(v: &Value) -> bool {
      v.as_str().is_some_and(|s| EFFECT_LEVELS.contains(&s))
  }
  ```

- `src-tauri/src/config.rs:240` — `scrollbarAccent` is listed among the EffectLevel fields in `sanitize_theme`, which matches the TS type (`scrollbarAccent?: EffectLevel`). This is correct but the field name is misleading next to `gradientLevel`, `glowLevel`, etc. -- not a code issue, just worth noting that the naming inconsistency originates in the TS types.

- `src-tauri/src/config.rs:92` — The migration clamp range `(0.0, 0.7)` is a magic number pair. The TS side defines `MAX_UNFOCUSED_DIM = 0.9`. While the 0.7 clamp is correct for the opacity-to-dim conversion domain (opacity 0.3 maps to dim 0.7), a named constant like `MAX_MIGRATED_DIM` with a comment referencing the formula would prevent future confusion.

- `src-tauri/src/config.rs:194` — The `fontFamily` sanitization magic number `128` and the injection-prevention character set `[';', '{', '}']` are undocumented. A brief comment explaining why these specific characters are blocked (CSS injection prevention) would help future readers.
