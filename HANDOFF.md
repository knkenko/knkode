# HANDOFF — knkode-v2

## Current State
Phase 3 in review — PR #10 open with review fixes applied.

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
- [x] Phase 3: Rust backend commands + ConfigStore (PR #10 — review fixes applied)

## What's Next
- [ ] Phase 4: Rust PTY manager (portable-pty)
- [ ] Phase 5: Terminal emulation (wezterm-term + canvas renderer)
- [ ] Phase 6: Config store (Rust, ~/.knkode/)
- [ ] Phase 7: CWD tracker (Rust)
- [ ] Phase 8: Window configuration (platform-specific)
- [ ] Phase 9: Native menu
- [ ] Phase 10: Frontend changes (port v1 React code)

## Key Reference
- Migration prompt: `/Users/sfory/dev/knkode/docs/TAURI_MIGRATION_PROMPT.md`
- V1 codebase: `/Users/sfory/dev/knkode/`

## Active Reviews

### PR #10 — Rust Backend Commands + ConfigStore (Phase 3)
- State: `docs/reviews/PR-10/_state.json`
- Agents: 8/8 completed
- Phase: fixes applied
- Fixes: 3 commits (config.rs overhaul, commands.rs fixes, pty.rs cleanup)

## Active Branch
`feature/rust-commands`

## Known Issues
- DMG bundling fails (macOS code signing) — not blocking for dev
- Icons are placeholder dark squares
- wezterm-term is NOT on crates.io as standalone — only `tattoy-wezterm-term` fork exists (affects Phase 5)
