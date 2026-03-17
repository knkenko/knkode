# Rust Review -- PR #9 (feature/ipc-adapter-layer)

## Summary

This PR adds the `tauri-plugin-shell` dependency to enable `openExternal` (URL opening) from the frontend via the IPC adapter. The Rust-side changes are minimal and correct: plugin registration in the builder chain and a properly scoped capability grant.

## Must Fix

None

## Suggestions

- `src-tauri/Cargo.toml:15` -- Pin `tauri-plugin-shell` to a tighter semver range (e.g., `"2.3"` or `"=2.3.5"`) to match how `tauri` is pinned at `"2"`. A major-only pin is fine today since Cargo.lock is committed, but an explicit minor pin prevents accidental breakage when the lockfile is regenerated.
- `src-tauri/capabilities/default.json:6` -- `shell:allow-open` permits opening any URL scheme (including `file://`). Consider adding a scope restriction to limit it to `https://` and `http://` URLs only, which is all that `openExternal` needs. In Tauri v2 this can be done with a scoped permission object instead of the bare string. Example:
  ```json
  {
    "identifier": "shell:allow-open",
    "allow": [{ "url": "https://**" }, { "url": "http://**" }]
  }
  ```
- `src-tauri/src/lib.rs:2` -- The return type `Box<dyn std::error::Error>` works but loses the concrete error type. As more plugins are added, consider switching to `anyhow::Result<()>` (already a transitive dependency via tauri-plugin) for better ergonomics and backtrace support. Not urgent with a single plugin, but worth keeping in mind.

## Nitpicks

- `src-tauri/Cargo.toml:14-16` -- Alphabetical ordering convention: `serde` now comes after `tauri-plugin-shell`. Consider reordering to keep dependencies sorted (`serde`, `tauri`, `tauri-plugin-shell`) for consistency. Current order is `tauri`, `tauri-plugin-shell`, `serde`.
