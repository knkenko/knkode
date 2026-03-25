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

### PR #62 — Handle PTY Exit Events & Surface Creation Errors (merged)
Branch: `fix/silent-failures`

3 changes to eliminate silent failures in PTY lifecycle:
1. **exitedPtyIds tracking** — new `ReadonlySet<string>` in store tracks which panes had their PTY exit, enabling restart-on-keypress overlay
2. **onPtyExit listener** — centralized PTY exit handling in App.tsx with exit code logging (debug for 0, warn for non-zero) via atomic `handlePtyExit` action
3. **PTY restart error surfacing** — Pane.tsx restart path catches `createPty` failures and restores error overlay instead of leaving a blank pane

Review completed by 9 agents (13 findings: 2 must-fix, 6 suggestions, 5 nitpicks).
All findings addressed in 3 fix commits (e477c1f..201563f).

### PR #63 — Tighten PaneTheme.preset Typing & Remove Unsafe Casts (merged)
Branch: `fix/type-safety`

5 type-safety improvements:
1. **PaneTheme.preset narrowing** — `string` → `ThemePresetName` union type, propagated through SettingsPanel and TerminalTabPanel
2. **mergeThemeWithPreset** — replaced `as unknown as PaneTheme` double cast with typed mutable spread
3. **stripUndefined** — typed `Partial<T>` accumulator replaces `Record<string, unknown>` cast
4. **LegacyWorkspace migration** — runtime `hasLegacyLayout()` type guard replaces `as unknown as` double cast
5. **SettingsPanel effects** — explicit object literal replaces unsafe `{} as Record<...>` empty-object cast

Review completed by 9 agents (12 findings: 1 must-fix, 6 suggestions, 5 nitpicks).
All findings addressed in 3 fix commits (f684cca..4f87801).

### PR #64 — Remove Dead `logScrollDebug` IPC Path (merged)
Branch: `fix/dead-code`

Clean removal of unused `logScrollDebug` IPC path across all four layers:
1. **Shared types** — removed `ScrollDebugEvent` interface and `logScrollDebug` from `KnkodeApi`
2. **TypeScript IPC** — removed `logScrollDebug` wrapper from `tauri-api.ts`
3. **Rust command** — removed `log_scroll_debug` from `commands.rs`
4. **Tauri registration** — removed `commands::log_scroll_debug` from `lib.rs` handler list

Review completed by 4 agents — zero findings. Net security positive (eliminates unused command accepting untyped input).

### PR #65 — Harden WinPty Safety (merged)
Branch: `fix/rust-safety`

Mutex, Result errors, DWORD guards, and review fixes for `win_pty.rs`:
1. **Option\<HANDLE\>** — `Mutex<Option<HANDLE>>` prevents use-after-free; `take()` in Drop, `None` check in `resize()`
2. **Result error propagation** — `load_conpty()` returns `Result<ConPtyFuncs, &'static str>` instead of panicking `assert!`
3. **DWORD overflow guard** — `clamp_to_dword()` helper prevents silent `usize` → `u32` truncation in ReadFile/WriteFile
4. **kill/wait hardening** — `TerminateProcess` and `WaitForSingleObject`/`GetExitCodeProcess` return values checked and logged
5. **Attribute list leak fix** — `DeleteProcThreadAttributeList` always called via closure pattern in `spawn()`
6. **coord() helper** — eliminates duplicated COORD construction
7. **SAFETY comments** — documented `unsafe impl Send/Sync`, `mem::transmute`, and poisoning strategy
8. **Drop logging** — `eprintln!` on unreachable `conpty()` failure path, `debug_assert!` removed in favor of logging

Review completed by 7 agents (19 findings: 5 must-fix, 10 suggestions, 4 nitpicks).
All findings addressed in 3 fix commits (c6be584..152724f).

## What's Next

PR #65 merged. Remaining v2.1.0 polish tasks:
- PR 5: Accessibility (`fix/accessibility`) — skipped for now
- PR 8: Documentation (`chore/docs-update`)

## Active Decisions

- Panes remain flat at workspace level (`workspace.panes`), subgroups only own layout trees
- Each subgroup is an independent `WorkspaceLayout` (preset or custom)
- Migration is automatic and persisted on first load
