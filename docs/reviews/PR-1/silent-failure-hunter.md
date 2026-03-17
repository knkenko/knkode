# Silent Failure Audit -- PR #1 `chore/tauri-scaffold`

## Summary

This is a minimal scaffold PR with very little runtime error handling code. The two issues found are both in the category of "set up correctly now before real logic lands": the Rust entry point uses `.expect()` which will panic without useful diagnostics, and the React entry point performs an unsafe `as` cast on the root DOM element that can silently produce a runtime crash with no user-facing message.

## Must Fix

- **`src-tauri/src/lib.rs:4`** -- `.expect("error while running tauri application")` will cause an unrecoverable panic with a generic message if `tauri::Builder::run()` fails. On a release build (where `windows_subsystem = "windows"` suppresses the console), the user sees nothing -- the app simply disappears. This is the textbook definition of a silent failure. The `run()` method returns `Result<(), tauri::Error>`, so it should be handled with a `match` or `if let Err(e)` that (a) logs the specific `tauri::Error` variant, and (b) on desktop, shows a native error dialog via `tauri::api::dialog` or `rfd` before exiting with a non-zero code. At minimum, change the function signature to `pub fn run() -> Result<(), Box<dyn std::error::Error>>` and propagate the error to `main()`, which can then `eprintln!` and `std::process::exit(1)`.

- **`src/main.tsx:6`** -- `document.getElementById("root") as HTMLElement` is an unsafe cast. If the element does not exist (mismatched `index.html`, SSR environment, browser extension interference), `getElementById` returns `null`, and the `as HTMLElement` cast does not perform a runtime check -- it passes `null` straight into `createRoot`, which throws an opaque internal React error ("createRoot(...): Target container is not a DOM element."). This is not a silent failure per se, but the error message gives the user zero context about what went wrong. Replace with a null-check that throws an explicit, descriptive error:
  ```tsx
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Fatal: #root element not found in document. Check index.html.");
  }
  createRoot(root).render(...)
  ```

## Suggestions

- **`src-tauri/src/build.rs:2`** -- `tauri_build::build()` can fail (e.g., missing Cargo metadata, codegen errors). It currently relies on the implicit panic from the build script process. Consider wrapping in `tauri_build::build().expect("tauri_build::build() failed -- check Cargo.toml and tauri.conf.json");` so the build error message is actionable rather than a bare unwrap backtrace. This is low severity because build scripts run at compile time, not in production.

- **`src/App.tsx`** -- No React error boundary exists anywhere in the component tree. Currently the app is a static placeholder so nothing can throw, but once real components land (terminal renderer, IPC calls to Rust), any uncaught render error will white-screen the app with no recovery path. Consider adding a top-level `<ErrorBoundary>` component now (even a stub) so the pattern is established before interactive code arrives. This is a suggestion rather than a must-fix because the current placeholder cannot throw.

- **`src-tauri/src/main.rs:5`** -- `knkode_v2_lib::run()` returns `()` today, but once `lib.rs` is fixed to return `Result`, `main()` must handle the error. Plan for `fn main() -> Result<(), Box<dyn std::error::Error>>` or an explicit match block here.

## Nitpicks

- **`src-tauri/src/lib.rs:4`** -- The `.expect()` message `"error while running tauri application"` is generic and not grep-friendly. Even if `.expect()` were kept temporarily, the message should include the crate name and suggest a next step, e.g., `"knkode_v2: tauri::Builder::run() failed -- check tauri.conf.json and system WebView availability"`.

- **`vite.config.ts:6`** -- `process.env.TAURI_DEV_HOST` is accessed without validation. If it contains an invalid hostname, the dev server will fail with an opaque Vite error. Not a production concern, but a minor developer-experience gap.
