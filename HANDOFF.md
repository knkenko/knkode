# HANDOFF — knkode-v2

## Current State
Phase 9 in progress — PR #18 (frontend foundation) under review.

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

## What's Next
- [ ] Phase 9: Frontend changes (port v1 React code)

## Key Reference
- Migration prompt: `/Users/sfory/dev/knkode/docs/TAURI_MIGRATION_PROMPT.md`
- V1 codebase: `/Users/sfory/dev/knkode/`

## Active Reviews

### PR #18 — feat: port frontend foundation (store, utils, hooks, data)
- State: `docs/reviews/PR-18/_state.json`
- Agents: 9/9 completed
- Phase: fixes applied

## Known Issues
- DMG bundling fails (macOS code signing) — not blocking for dev
- Icons are placeholder dark squares
- wezterm-term resolved: using `tattoy-wezterm-term` 0.1.0-fork.5 (fork published on crates.io)
