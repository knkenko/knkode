# Code Review: PR #1 — Tauri 2 Scaffold

## Summary

Solid scaffold for a Tauri 2 + React 19 + TypeScript project. The project structure follows Tauri 2 conventions correctly, and the tooling choices (Biome, Vite, Tailwind 4, Zustand) are well-aligned with the PROJECT_DESCRIPTION. There are a few must-fix items around missing Cargo.lock, incomplete test setup, and a documentation version inaccuracy.

## Must Fix

- **`src-tauri/Cargo.lock` not committed**: For application/binary projects (as opposed to libraries), Cargo.lock must be committed to ensure reproducible builds. This is the official Rust/Cargo guidance. Without it, `cargo build` may resolve different dependency versions on different machines or CI runs. Add `Cargo.lock` to the repository.

- **`src-tauri/tauri.conf.json:20` — CSP disabled (`"csp": null`)**: Setting CSP to `null` disables Content Security Policy entirely, which means the webview has no restrictions on script sources, inline scripts, or external resource loading. For a scaffold this is acceptable during early development, but it should be explicitly called out in HANDOFF.md as a known security gap to address before any release. At minimum, set a permissive-but-present CSP like `"default-src 'self'; script-src 'self'"` so it can be tightened incrementally.

- **Missing `jsdom` (or `happy-dom`) dependency for vitest**: The scaffold includes `vitest` and `@testing-library/react` in devDependencies, but neither `jsdom` nor `happy-dom` is installed. Without one of these, `vitest` cannot run React component tests (it has no DOM environment). Additionally, there is no `vitest.config.ts` to configure `environment: 'jsdom'`. The `test` script will fail if any component test is added. Install `jsdom` and add a vitest config with `environment: 'jsdom'`.

## Suggestions

- **`HANDOFF.md:7` — TypeScript version claim is inaccurate**: States "TypeScript 5.9" but `package.json` specifies `"^5.7"` and TypeScript 5.9 does not exist. The lockfile likely resolves to 5.7.x or 5.8.x. Update HANDOFF.md to reflect the actual version.

- **`src-tauri/tauri.conf.json:29` — `"targets": "all"` in bundle config**: Building for all bundle targets will fail on most machines (e.g., building MSI on macOS, or DMG on Linux). Consider changing to platform-specific targets or `["dmg", "app"]` for macOS development, or removing the `targets` key to use the platform default. HANDOFF.md already notes DMG bundling fails due to code signing, but this config will also attempt to build `.deb`, `.appimage`, `.msi`, etc.

- **`vite.config.ts:28` — Build target `safari13` may be too old for Tauri 2**: The Tauri 2 webview on macOS uses WKWebView which supports modern ES features. `safari13` (2019) forces unnecessary transpilation and polyfills. Consider `safari14` or `safari15` to match the actual minimum macOS version Tauri 2 supports (10.15+, which ships Safari 15 via updates). The Tauri docs recommend `safari13` for compatibility, so this is a minor suggestion — keep it if you want maximum compatibility.

- **`package.json` — Missing `@tauri-apps/plugin-shell` or similar plugins**: For a terminal app that will need to spawn processes, you may want to add Tauri shell plugin early. Not blocking for scaffold, but worth noting for PR #2 planning.

## Nitpicks

- **`biome.json` — Consider adding `"trailingCommas": "all"`**: Biome's default is `"all"` for trailing commas, which is fine, but making it explicit in the config prevents confusion if defaults change in future Biome versions.

- **`index.html:6` — Title says "knkode" but the app is "knkode-v2"**: Minor naming inconsistency. The `tauri.conf.json` also uses "knkode" as `productName` and window title, so this may be intentional (the product name vs the repo name), but worth confirming.

- **`src/styles.css` — Reset styles may conflict with Tailwind 4**: Tailwind 4's `@import "tailwindcss"` includes Preflight (a CSS reset). The manual `margin: 0; padding: 0` rules on `html, body, #root` are redundant with Preflight and can be removed. The `width/height/overflow` rules are still useful.
