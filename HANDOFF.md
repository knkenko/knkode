# Handoff

## What Was Done

### PR #61 — Performance & Battery Drain Fix (in review)
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

## What's Next

PR #61 is ready for user review and merge. After merge, remaining v2.1.0 polish tasks:
- PR 3: Silent failures (`fix/silent-failures`)
- PR 4: Type safety (`fix/type-safety`)
- PR 5: Accessibility (`fix/accessibility`)
- PR 6: Dead code (`fix/dead-code`)
- PR 7: Rust safety (`fix/rust-safety`)
- PR 8: Documentation (`chore/docs-update`)

## Active Decisions

- Panes remain flat at workspace level (`workspace.panes`), subgroups only own layout trees
- Each subgroup is an independent `WorkspaceLayout` (preset or custom)
- Migration is automatic and persisted on first load
