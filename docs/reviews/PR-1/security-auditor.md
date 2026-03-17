# Security Audit -- PR #1: Scaffold Tauri 2 project with React + TypeScript + Vite

## Summary

The scaffold is structurally sound for an early-stage Tauri 2 desktop app, but it ships with CSP explicitly disabled (`"csp": null`), which is a critical security gap that removes the primary defense against cross-site scripting (XSS) and code injection in the WebView. The remaining findings are lower-severity configuration hardening items and .gitignore completeness improvements.

## Must Fix

- `src-tauri/tauri.conf.json:30` -- **CSP is set to `null`, completely disabling Content Security Policy.** This is the single most important security control in a Tauri WebView application. With CSP disabled, any XSS vulnerability in the frontend (or in a future dependency) can execute arbitrary JavaScript, which in Tauri's context can escalate to IPC command invocation and potentially full system access. Even for a scaffold, set a restrictive baseline CSP now and relax it only as needed. Recommended starting point:
  ```json
  "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: https://asset.localhost; connect-src ipc: http://ipc.localhost"
  ```
  The `'unsafe-inline'` for `style-src` is needed by Tailwind CSS's runtime injection. Adjust `connect-src` if the app will make network requests. The key constraint is that `script-src` must never include `'unsafe-inline'` or `'unsafe-eval'` -- these would negate the XSS protection that CSP provides.

## Suggestions

- `src-tauri/tauri.conf.json` (missing key) -- **Consider adding `"dangerousRemoteDomainIpcAccess": []`** explicitly under `app.security` to document that no remote origins are granted IPC access. While this is the default in Tauri 2, being explicit prevents accidental future misconfiguration and makes the security posture auditable at a glance.

- `src-tauri/capabilities/default.json:6` -- **`"core:default"` is acceptable for a scaffold but should be reviewed before the next PR.** The upcoming `feature/rust-terminal-backend` PR will need shell/process/fs permissions. When that happens, prefer fine-grained permissions (e.g., `shell:allow-spawn` scoped to specific commands) over broad permission sets. Document each permission with a comment explaining why it is needed.

- `vite.config.ts:27` -- **Build target `safari13` may allow use of older, less-secure JavaScript APIs.** Safari 13 dates from 2019 and lacks support for modern security features. Since Tauri uses a system WebView (WebKit on macOS, WebView2 on Windows), the actual engine is always current, but the transpilation target affects which code patterns Vite emits. Consider raising to `safari15` or `es2021` to match the tsconfig target and avoid unnecessary polyfill surface area.

- `vite.config.ts:25` -- **`envPrefix: ["VITE_", "TAURI_ENV_*"]` exposes all `VITE_`-prefixed and `TAURI_ENV_`-prefixed environment variables to the frontend bundle.** This is standard Tauri/Vite behavior and currently safe, but as the project grows, ensure no sensitive values are ever placed in `VITE_`-prefixed variables. Consider adding a comment warning future developers about this behavior.

- `.gitignore` (missing entries) -- **Add coverage and crash report patterns.** The following are commonly generated in Tauri + Vitest projects and should be excluded:
  ```
  # Test coverage
  coverage/

  # Tauri debug/crash artifacts
  src-tauri/target/debug/
  src-tauri/target/release/

  # Signing keys (critical -- prevents accidental commit of code signing material)
  *.pem
  *.p12
  *.key
  *.keystore
  ```
  The `src-tauri/target/` entry already covers the debug/release subdirectories, but the signing key patterns are not covered and are high-impact if accidentally committed.

- `package.json` -- **Dependency version ranges use caret (`^`) ranges, which auto-resolve to latest compatible.** This is standard for development but means `bun install` on different machines or at different times may resolve different patch versions. For a security-sensitive desktop application, consider pinning exact versions or using `bun install --frozen-lockfile` in CI to ensure reproducible builds. The `bun.lock` file is committed, which is good -- ensure CI always uses `--frozen-lockfile`.

## Nitpicks

- `src-tauri/tauri.conf.json:16` -- The `devUrl` is set to `http://localhost:5173` (plaintext HTTP). This is expected for local development and is not a production concern, but be aware that Tauri 2 will refuse to load HTTP URLs in production builds by default -- no action needed.

- `src-tauri/src/lib.rs:5` -- The `.expect("error while running tauri application")` panic message is generic. In production, consider more structured error handling or at minimum a more descriptive message to aid debugging without leaking internal details.

- `index.html:6` -- No `<meta>` tag for `Content-Security-Policy` is present in the HTML. While Tauri's CSP in `tauri.conf.json` is the primary enforcement point (it sets HTTP headers on the WebView), adding a `<meta>` CSP tag as a defense-in-depth measure is a low-cost additional control.
