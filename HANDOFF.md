# HANDOFF — knkode-v2

## Current State
PR #28 merged — workspace sidebar with tree-style navigation. Vertical sidebar replaces horizontal tab bar for workspace/pane management. Features: collapsible workspace sections, per-pane branch/PR badges, settings cog, hotkey reference, closed workspaces menu, Mod+B collapse toggle, Mod+/ hotkeys shortcut. Shared utilities extracted (shortenPath, useWindowDrag). Review-hardened: 28 findings + 2 user-reported issues addressed.

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

- [x] Fix: Keyboard input, render throttle, cursor style (PR #21 merged)
- [x] Selection: IPC text extraction (PR #22 merged)
- [x] Selection: Mouse tracking, highlight, copy (PR #23 merged)
- [x] Selection: Smart selection — double/triple click, shift+click extend (PR #24 merged)

## What's Next
- [x] File drag-and-drop to paste paths into terminal (PR #25 merged)
- [x] Inline terminal images (iTerm2/Kitty/Sixel) (PR #26 merged)
- [x] Windows compat & cross-platform hardening (PR #27 merged)
- [x] Release workflow — macOS universal + Windows NSIS on tag push
- [x] Workspace sidebar — tree-style mission control (PR #28 merged)
- [ ] Sidebar controls & context menus (rename, color, duplicate, close workspace from sidebar)
- [ ] Per-workspace theme tinting in sidebar sections
- [ ] Agent activity state detection (animated indicator, cross-workspace notifications)
- [ ] Phase 10: Integration testing & polish

## Key Reference
- Migration prompt: `/Users/sfory/dev/knkode/docs/TAURI_MIGRATION_PROMPT.md`
- V1 codebase: `/Users/sfory/dev/knkode/`

## Active Reviews
None

## Known Issues
- wezterm-term resolved: using `tattoy-wezterm-term` 0.1.0-fork.5 (fork published on crates.io)
- wezterm-term selection module disabled (`// mod selection; FIXME: port to render layer`) — must implement selection on frontend
- TUI apps (claude, gemini) hide system cursor and draw their own via reverse-video text — cursor style setting has no effect inside TUI apps (fundamental limitation)
