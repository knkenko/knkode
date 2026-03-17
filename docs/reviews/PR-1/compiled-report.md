# Compiled Review Report — PR #1: chore/tauri-scaffold

**Agents:** code-reviewer, security-auditor, silent-failure-hunter, code-simplifier, comment-analyzer, type-design-analyzer, typescript-pro
**Files reviewed:** 71 (mostly icons; ~15 source/config files)

---

## Must Fix (7 items)

1. **`src/main.tsx:6` — Unsafe `as HTMLElement` cast** [type-design-analyzer, silent-failure-hunter, typescript-pro]
   `document.getElementById("root") as HTMLElement` silently passes `null` to `createRoot` if the element is missing, producing an opaque React error. Replace with a runtime guard:
   ```ts
   const root = document.getElementById("root");
   if (!root) throw new Error("Missing #root element in index.html");
   createRoot(root).render(...);
   ```

2. **`src-tauri/tauri.conf.json:23` — CSP disabled (`"csp": null`)** [security-auditor, code-reviewer]
   Completely disables Content Security Policy, removing the primary XSS defense. Set a restrictive baseline:
   ```json
   "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: https://asset.localhost; connect-src ipc: http://ipc.localhost"
   ```

3. **`src-tauri/src/lib.rs:4` — `.expect()` causes silent app crash** [silent-failure-hunter, security-auditor]
   On Windows release builds (console suppressed), the app vanishes with no error. Propagate the `Result` to `main()` for proper error reporting.

4. **`tsconfig.json:3` — `target`/`lib` pinned to ES2021** [typescript-pro]
   Tauri targets modern engines supporting ES2022+. Bump to `"ES2022"` to get `Object.hasOwn`, `Array.at()`, `Error.cause`, top-level `await`.

5. **`tsconfig.json` — Missing `noUncheckedIndexedAccess`** [typescript-pro]
   The most impactful strict flag after `strict: true`. Add now while codebase is empty; retrofitting later is painful.

6. **`src-tauri/Cargo.lock` not committed** [code-reviewer]
   For binary/application projects, Cargo.lock must be committed for reproducible builds.

7. **Missing `jsdom` dependency for Vitest** [code-reviewer, typescript-pro]
   `@testing-library/react` is installed but no DOM environment exists. Tests will fail. Install `jsdom` and configure vitest environment.

## Suggestions (12 items)

1. **`src-tauri/Cargo.toml:16` — Remove unused `serde_json`** [code-simplifier, comment-analyzer]
   Not imported in any Rust file. Remove until needed; keep `serde` (will be needed for Tauri commands).

2. **`src/styles.css:3-11` — Redundant CSS reset with Tailwind v4** [code-simplifier, code-reviewer]
   `margin: 0; padding: 0` already handled by Tailwind Preflight. Reduce to just `overflow: hidden` on `#root`.

3. **`tsconfig.json` — Add `verbatimModuleSyntax`** [typescript-pro]
   Replaces `isolatedModules`, enforces `import type`, better tree-shaking. Remove `isolatedModules` if added.

4. **`tsconfig.json` — Add `exactOptionalPropertyTypes`** [typescript-pro]
   Distinguishes "missing" from "present but undefined" — catches real bugs with Zustand stores.

5. **`vite.config.ts:27` — Raise build target from `safari13`** [security-auditor, typescript-pro, code-reviewer]
   `safari13` (2019) pulls in unnecessary polyfills. Consider `safari14` or `safari15`.

6. **`.gitignore` — Add signing key patterns** [security-auditor]
   Add `*.pem`, `*.p12`, `*.key`, `*.keystore`, `coverage/` to prevent accidental secret commits.

7. **`src-tauri/tauri.conf.json:27` — Change `"targets": "all"` to platform-specific** [code-reviewer]
   Building all targets fails cross-platform. Use `"app"` or remove key for platform default.

8. **`HANDOFF.md:13` — Misleading serde claim** [comment-analyzer]
   "Tauri 2.10 + serde" implies active serde usage. Clarify it's a dependency for future use.

9. **`PROJECT_DESCRIPTION.md:24` — "Vitest 4" doesn't exist** [comment-analyzer]
   V1 "Replaces" column claims Vitest 4. Correct to actual v1 version.

10. **`PROJECT_DESCRIPTION.md:38-42` — Future state written as present** [comment-analyzer]
    Architecture descriptions read as implemented, but this is scaffold phase. Add "Target:" prefix.

11. **`src-tauri/build.rs:2` — Add `.expect()` to `tauri_build::build()`** [silent-failure-hunter]
    Makes build errors actionable rather than bare backtraces.

12. **`tsconfig.json` — Add `resolveJsonModule`** [typescript-pro]
    Tauri projects commonly import JSON. Pre-configure to avoid future friction.

## Nitpicks (8 items)

1. **`index.html:6` — Title "knkode" vs package "knkode-v2"** [code-reviewer, typescript-pro]
2. **`vite.config.ts:13` — `host || false` could be `host ?? false`** [type-design-analyzer]
3. **`vite.config.ts:28` — Double-negative debug logic** [type-design-analyzer]
4. **`biome.json:22` — Redundant `!**/node_modules` exclusion** [code-simplifier]
5. **`tsconfig.json:4` — `useDefineForClassFields` is no-op with ES2022** [code-simplifier, typescript-pro]
6. **`src-tauri/Cargo.toml:8` — `staticlib` only needed for mobile** [code-simplifier]
7. **`src/styles.css` — Missing comment explaining Tailwind exception** [comment-analyzer]
8. **`vite.config.ts` — No header comment explaining Tauri template origin** [comment-analyzer]
