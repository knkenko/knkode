# HANDOFF — knkode-v2

## Current State
Phase 9 complete — all frontend code ported. App shell fully functional with drag-and-drop, terminal rendering, and all 17 pane chrome variants.

## What's Done
- [x] Tauri 2 project scaffolded (React 19 + TypeScript 5.9 + Vite 6 + Tailwind CSS 4.2)
- [x] Biome configured with tab indentation
- [x] Zustand 5 installed
- [x] Vitest + @testing-library/react installed
- [x] Placeholder App.tsx
- [x] Frontend build passes (tsc + vite build)
- [x] Rust backend compiles (Tauri 2)
- [x] Old knktx boards/notes/plans archived (clean slate)
- [x] PROJECT_DESCRIPTION.md updated with new approach
- [x] Phase 2: IPC adapter layer — shared types + tauri-api.ts + shell plugin (PR #9 merged)
- [x] Phase 3: Rust backend commands + ConfigStore (PR #10 merged)
- [x] Phase 4: Rust PTY manager with portable-pty 0.9 (PR #11 merged)
- [x] Phase 5a: Rust terminal emulation layer (PR #12 merged)
- [x] Phase 5b: Frontend canvas terminal renderer (PR #13 merged)
- [x] Phase 6a: Config store hardening — migrations, sanitization, permissions (PR #14 merged)
- [x] Phase 6b: CWD tracker with git branch and PR detection (PR #15 merged)
- [x] Phase 7: Window configuration — platform effects, bounds persistence (PR #16 merged)
- [x] Phase 8: Native menu — platform-specific submenus via PredefinedMenuItem (PR #17 merged)
- [x] Phase 9a: Frontend foundation — store, utils, hooks, data (PR #18 merged)
- [x] Phase 9b: Frontend components & app shell (PR #19 merged)

## What's Next
- [ ] Phase 10: Integration testing & polish

## Key Reference
- Migration prompt: `/Users/sfory/dev/knkode/docs/TAURI_MIGRATION_PROMPT.md`
- V1 codebase: `/Users/sfory/dev/knkode/`

## Active Reviews

### PR #20 — fix: apply theme ANSI colors to terminal renderer
- Branch: `fix/ansi-theme-colors`
- State: `docs/reviews/PR-20/_state.json`
- Review: 10/10 agents completed, compiled report written
- Fixes: 2 commits pushed (Rust hardening + TS stabilization)
- Status: awaiting merge

## Known Issues
- DMG bundling fails (macOS code signing) — not blocking for dev
- Icons are placeholder dark squares
- wezterm-term resolved: using `tattoy-wezterm-term` 0.1.0-fork.5 (fork published on crates.io)
