# PR #1 TypeScript Review — `chore/tauri-scaffold`

## Summary

Solid Tauri 2 scaffold with a well-configured strict TypeScript setup, correct Vite/Tailwind 4 plugin wiring, and sensible dependency choices. A few tsconfig gaps and one unsafe cast are worth addressing before this becomes the foundation every future PR inherits.

## Must Fix

- **`tsconfig.json:3` — `target` and `lib` pinned to ES2021 while the project uses TypeScript 5.7+.** Tauri targets modern Chromium/WebKit engines that support ES2022+. Pinning to ES2021 means you lose native `Object.hasOwn`, `Array.at()`, `Error.cause`, top-level `await`, and class static blocks. Bump both `target` and `lib` to at least `"ES2022"`. Since the Vite build step transpiles to the actual browser target anyway (`chrome105` / `safari13`), the tsconfig target only governs type-checking and emit shape -- there is no runtime risk in raising it.

- **`src/main.tsx:6` — `document.getElementById("root") as HTMLElement` is an unsafe type assertion.** If the element is missing (e.g., someone changes `index.html`), this silently becomes `null` cast to `HTMLElement`, and `createRoot` throws an opaque runtime error. Replace the cast with a runtime guard:
  ```ts
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing #root element in index.html");
  createRoot(root).render(/* ... */);
  ```
  This is especially important in a strict-mode codebase -- the `as` cast defeats the purpose of `strict: true`.

- **`tsconfig.json` — Missing `noUncheckedIndexedAccess`.** This is the single most impactful strict flag after `strict: true` itself. Without it, indexing into arrays and records silently strips `| undefined` from the return type, which is the number-one source of runtime `TypeError` in TypeScript codebases. Add `"noUncheckedIndexedAccess": true` now while the codebase is empty; retrofitting it later is painful.

## Suggestions

- **`tsconfig.json` — Missing `exactOptionalPropertyTypes`.** With this flag enabled, `{ key?: string }` disallows explicitly assigning `undefined` (i.e., `{ key: undefined }`) and distinguishes "missing" from "present but undefined". This catches a real class of bugs with Zustand stores and React props. Recommend adding `"exactOptionalPropertyTypes": true`.

- **`tsconfig.json` — Missing `verbatimModuleSyntax`.** This replaces the older `isolatedModules` flag and enforces that type-only imports use `import type`. It prevents accidental side-effect imports and makes tree-shaking more predictable. Since Biome already organizes imports, this pairs well. Add `"verbatimModuleSyntax": true` and remove `"isolatedModules": true` (verbatimModuleSyntax subsumes it).

- **`tsconfig.json` — Consider adding `resolveJsonModule` and `allowArbitraryExtensions`.** Tauri projects commonly import JSON (e.g., `tauri.conf.json` for version info) and may later need `.css` or `.svg` module declarations. Having `"resolveJsonModule": true` ready avoids a "why won't this compile" moment on the next PR.

- **`vite.config.ts:28` — `safari13` build target may be too conservative.** Tauri 2 on macOS uses WKWebView, which on macOS 11+ maps to Safari 14+, and on macOS 12+ to Safari 15+. Targeting `safari13` pulls in unnecessary polyfills and blocks modern CSS/JS features. Consider `safari14` as minimum, or `safari15` if you are willing to require macOS 12+.

- **`package.json` — Missing `jsdom` or `happy-dom` for Vitest.** `@testing-library/react` is installed but there is no DOM environment for Vitest. Tests will fail at import time with "document is not defined" unless a `vitest.config.ts` or `vite.config.ts` adds `test: { environment: 'jsdom' }` and `jsdom` (or `happy-dom`) is in devDependencies. This should be addressed before anyone writes the first test.

- **`package.json` — Version ranges are very loose (e.g., `"react": "^19"`, `"vite": "^6"`).** While `bun.lockb` pins exact versions, the caret-major ranges mean a fresh install could pull React 19.x or even 20.0.0-rc if a pre-release tag matches. Prefer `"^19.0.0"` / `"^6.0.0"` minimum to signal intent and avoid accidental major-pre-release resolution.

## Nitpicks

- **`tsconfig.json:5` — `useDefineForClassFields: true` is a no-op with `target >= ES2022`.** If you bump the target to ES2022+ as recommended above, this field can be removed since ES2022 made `[[Define]]` semantics the default. Keeping it is harmless but adds noise.

- **`vite.config.ts:5` — `const host = process.env.TAURI_DEV_HOST` is untyped `string | undefined`.** This is fine for the current usage, but consider extracting Tauri env access into a small typed helper (or a `src/env.d.ts` augmentation for `ImportMetaEnv`) as the project grows. Not urgent for a scaffold PR.

- **`src/App.tsx:3` — Long Tailwind class string on a single line (93 chars inside JSX).** This is within the 100-char Biome line width so it passes formatting, but as more classes are added it will become unwieldy. No action needed now, but consider a `cn()` utility (e.g., `clsx` + `tailwind-merge`) early to keep class composition manageable.

- **`index.html:6` — `<title>knkode</title>` does not match the package name `knkode-v2`.** Minor branding inconsistency. Either is fine, but worth being intentional about which name is user-facing.
