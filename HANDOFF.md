# HANDOFF — knkode-v2

## Current State
Phase 2 in progress — workspace/pane/tab system. PR #7 (split pane renderer) merged.

## What's Done
- [x] Tauri 2 project scaffolded (React 19 + TypeScript 5.9 + Vite 6 + Tailwind CSS 4.2)
- [x] Biome 2.4 configured with tab indentation
- [x] Zustand 5 installed
- [x] Vitest 3 + @testing-library/react 16 installed
- [x] Frontend build passes (tsc + vite build)
- [x] Rust backend compiles (Tauri 2.10)
- [x] Placeholder icons generated
- [x] PR #1: Tauri scaffold (merged)
- [x] PR #2: Rust terminal backend — alacritty_terminal PTY + event loop (merged)
  - TerminalInstance with PTY spawn, write, resize, grid snapshot
  - TerminalManager with parking_lot::Mutex, UUID keys, 16-instance cap
  - 5 Tauri commands: create, destroy, write, resize, get_state
  - EventProxy bridging alacritty events to Tauri events
  - Full color palette (Tomorrow Night) with correct bright variants
  - 10-agent review: 26 findings, all 26 addressed
- [x] PR #3: Canvas terminal renderer (merged)
  - Canvas-based terminal renderer with DPR-aware scaling
  - Zustand store with full error handling on all IPC calls
  - Keyboard input with VT escape sequences + Cmd+V paste
  - ResizeObserver with debounce, rAF-batched rendering
  - Event coalescing, terminal ID filtering, StrictMode guard
  - 10-agent review: 24 findings, all 24 addressed
- [x] PR #4: Cmd+V paste fix (merged)
- [x] PR #5: Layout tree types, operations, and presets (merged)
  - Discriminated union LayoutNode with type: "leaf"/"branch" tag
  - createLeaf/createBranch factory functions, validateWorkspace
  - 9 pure recursive tree operations with MAX_DEPTH=20 guard
  - 6 layout presets with twoPane/threePanel helpers
  - Workspace.color constrained to palette type
  - 46 tests, 10-agent review: 32 findings, 29 fixed, 3 skipped (nitpicks)
- [x] PR #6: Multi-workspace Zustand store with per-pane terminal IPC (merged)
  - Replaced single-terminal store with multi-workspace/multi-pane architecture
  - Per-pane terminal IPC: create, destroy, write, resize via Tauri invoke
  - Workspace CRUD: create, duplicate, remove, rename, reorder
  - Pane actions: split, close, swap with layout tree mutations
  - Global event routing with terminalToPaneMap reverse lookup
  - Lazy workspace mounting, TOCTOU guard on initPane
  - DRY helpers: setPaneTerminal, updateWorkspace, registerWorkspace
  - 33 tests, 10-agent review: 30 findings, all 30 addressed

- [x] PR #7: Recursive split pane layout with allotment (merged)
  - SplitPaneLayout with recursive LayoutNodeRenderer + BranchRenderer
  - Allotment-based resizable splits with debounced size persistence
  - Pane component with store-derived color/label, a11y attributes
  - String-encoded paths + React.memo for efficient re-rendering
  - Shared useDebouncedCallback hook extracted to src/hooks/
  - 9-agent review: 17 findings, 15 fixed, 2 skipped (nitpicks)

## What's Next
- Phase 2 (continued):
  - PR #8: tab bar
  - PR #9: drag-and-drop
  - PR #10: keybindings

## Active Reviews

### PR #8 — feat: workspace tab bar with context menu
- State: `docs/reviews/PR-8/_state.json`
- Agents: 9/9 completed
- Phase: done — review complete, awaiting fixes

## Active Branch
`feature/tab-bar` (PR #8)

## Known Issues
- DMG bundling fails (macOS code signing) — not blocking for dev
- Icons are placeholder dark squares — replace with real branding later
- Cell flags (bold/italic/underline) not yet rendered — documented as Phase 2+
