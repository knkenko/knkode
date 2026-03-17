# Code Simplification Review — PR #1 (`chore/tauri-scaffold`)

## Summary

Clean scaffold with minimal code. The structure is solid and follows project conventions well. A few CSS redundancies, a minor Tailwind v4 consideration, and one unnecessary Cargo dependency stand out as simplification opportunities.

## Must Fix

- `src/styles.css:3-11` — The manual CSS reset (`margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden`) on `html, body, #root` is partially redundant with Tailwind CSS v4, which applies `margin: 0` on all elements via its preflight/base layer by default. The `width: 100%; height: 100%` on `html` and `body` are also covered by Tailwind preflight in v4. The only non-default property here is `overflow: hidden`. Consider replacing the raw CSS block with Tailwind utility classes on `#root` (via the component in `main.tsx` or App.tsx) and a minimal `@layer base` override for `overflow: hidden` if needed — or at minimum, remove the properties that Tailwind preflight already handles (`margin: 0; padding: 0`) to avoid confusion about what is actually custom.
- `src-tauri/Cargo.toml:16` — `serde_json = "1"` is listed as a dependency but is never used in any Rust source file (`lib.rs` or `main.rs`). It should be removed until it is actually needed; unused dependencies increase compile time and binary size. (Note: `serde` with `derive` is also unused currently, but is commonly needed as soon as Tauri commands are added, so it is more defensible to keep.)

## Suggestions

- `src/styles.css:3-11` — If the intent is to ensure the app fills the viewport with no scrollbars, consider using Tailwind classes directly on the root element containers. In `App.tsx:3`, the component already uses `h-screen w-screen` which handles full-viewport sizing. The raw CSS reset could be reduced to just `@import "tailwindcss";` plus an `overflow: hidden` rule on `#root` (or applied as a Tailwind class). This keeps styling in one system rather than splitting between raw CSS and Tailwind utilities.
- `vite.config.ts:5` — `const host = process.env.TAURI_DEV_HOST;` is a standard Tauri template pattern and is fine, but the ternary on lines 13-19 for `hmr` config creates moderate nesting. This is acceptable for a config file and matches the official Tauri template, so no action required — just flagging for awareness.
- `biome.json:22` — The `files.includes` pattern `["**", "!**/node_modules", "!**/dist", "!**/src-tauri/target", "!**/src-tauri/gen"]` uses negative patterns to exclude directories. Biome already ignores `node_modules` by default, so `!**/node_modules` is redundant. Removing it would slightly simplify the config.

## Nitpicks

- `src/App.tsx` — The component has no explicit return type annotation. Per project standards ("Use explicit return type annotations for top-level functions"), consider adding `: React.JSX.Element` or `: ReactNode` as the return type on the `App` function. For a scaffold placeholder this is very minor.
- `tsconfig.json:4` — `"useDefineForClassFields": true` is included but the project uses React functional components and is unlikely to use class fields. This is a default from the Vite template and is harmless, but could be removed for a cleaner config if class-based patterns are not planned.
- `src-tauri/Cargo.toml:8` — `crate-type = ["lib", "cdylib", "staticlib"]` includes all three crate types. For a desktop-only Tauri app, `"lib"` and `"cdylib"` are needed but `"staticlib"` is only required for mobile targets. This is the default Tauri scaffold output and is fine to keep for cross-platform readiness, but worth knowing it could be trimmed for desktop-only builds.
