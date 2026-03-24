# Handoff

## What Was Done

### PR #61 — Performance & Battery Drain Fix (merged)
Branch: `fix/performance-battery`

7 performance fixes to eliminate idle CPU wakeups and reduce render overhead:
1. **Cursor blink RAF** — 3-phase state machine (HOLD→BLINK→IDLE) stops RAF after 5s idle
2. **Condvar flush** — replaced 16ms sleep-poll with `Condvar::wait_timeout`, zero wakeups when idle
3. **Zustand selectors** — per-pane `paneBranches[paneId]` selectors replace broad record subscriptions
4. **Render dispatcher** — O(1) `Map<string, RenderCallback>` replaces N×listener fan-out
5. **CWD detection** — `libc::proc_vnodepathinfo` syscall replaces `lsof` fork+exec
6. **Color interning** — `HashMap<(ColorAttribute, bool), String>` reduces ~1920 string allocs to ~20
7. **Foreground detection** — `sysctl(KERN_PROC_PID)` replaces `ps` fork+exec

Review completed by 10 agents (23 findings: 3 must-fix, 10 suggestions, 10 nitpicks).
All findings addressed in 6 fix commits (28fc942..7d82330).

### Previous Work
- PR #56: Subgroup data model + migration + store foundation (merged)
- PR #57: Subgroup bracket rendering (merged)
- PR #58: Themed add-pane button (merged)
- PR #59: Subgroup keyboard shortcuts (merged)

### PR #62 — Handle PTY Exit Events & Surface Creation Errors (in review)
Branch: `fix/silent-failures`

3 changes to eliminate silent failures in PTY lifecycle:
1. **exitedPtyIds tracking** — new `ReadonlySet<string>` in store tracks which panes had their PTY exit, enabling restart-on-keypress overlay
2. **onPtyExit listener** — centralized PTY exit handling in App.tsx with exit code logging (debug for 0, warn for non-zero) via atomic `handlePtyExit` action
3. **PTY restart error surfacing** — Pane.tsx restart path catches `createPty` failures and restores error overlay instead of leaving a blank pane

Review completed by 9 agents (13 findings: 2 must-fix, 6 suggestions, 5 nitpicks).
All findings addressed in 3 fix commits (e477c1f..201563f).

## What's Next

PR #62 ready for merge. Remaining v2.1.0 polish tasks:
- PR 4: Type safety (`fix/type-safety`)
- PR 5: Accessibility (`fix/accessibility`)
- PR 6: Dead code (`fix/dead-code`)
- PR 7: Rust safety (`fix/rust-safety`)
- PR 8: Documentation (`chore/docs-update`)

## Active Decisions

- Panes remain flat at workspace level (`workspace.panes`), subgroups only own layout trees
- Each subgroup is an independent `WorkspaceLayout` (preset or custom)
- Migration is automatic and persisted on first load
