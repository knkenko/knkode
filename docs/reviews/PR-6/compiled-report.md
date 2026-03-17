# Compiled Review — PR #6 `feature/workspace-store`

**10/10 agents completed** | Areas: code quality, security, silent failures, code simplification, DRY/reuse, comments, type design, test coverage, TypeScript, efficiency

---

## Must Fix (9 items)

- [ ] **M1** `src/store/workspace.ts:245-250,253-258,314-317,357-368` — Stale workspace references in `set()` callbacks. `renameWorkspace`, `setWorkspaceColor`, `splitPane`, and `closePane` capture `workspace` from `get()` outside the `set()` callback then spread it inside. Concurrent state changes between `get()` and `set()` are silently overwritten. `closePane` is worst — uses non-callback `set({...})` with `get().workspaces`. Fix: re-derive workspace from `state.workspaces[workspaceId]` inside every `set((state) => ...)` callback. [code-reviewer, code-simplifier, typescript-reviewer, type-design-analyzer, efficiency]

- [ ] **M2** `src/store/workspace.ts:492,504` — Unsafe `event.payload as string` casts on Tauri event payloads. `listen<unknown>` returns `unknown` payload; casting bypasses runtime validation. If backend sends non-string payload, `findPaneByTerminalId` silently fails. Fix: add `if (typeof event.payload !== "string") return;` guard and remove `as string`. [security-auditor, silent-failure-hunter, type-design-analyzer, typescript-reviewer]

- [ ] **M3** `src/store/workspace.ts:396-420` — `initPane` TOCTOU race. Guard checks `paneTerminals[paneId]?.terminalId` then awaits `invoke("create_terminal")`. Two concurrent calls (e.g., `splitPane` + `initWorkspace`) both pass guard, create two terminals, store only the last — leaking the first. Fix: add `initializingPanes: Set<string>` checked/set synchronously before await. [security-auditor, code-reviewer]

- [ ] **M4** `src/store/workspace.ts:280-282,323-324` — Unhandled promise rejections. `setActiveWorkspace` calls `initWorkspace()` and `splitPane` calls `initPane()` as fire-and-forget with no `.catch()`. If IPC fails, unhandled rejection may crash app in strict environments. Fix: add `.catch(console.error)`. [silent-failure-hunter, code-reviewer, typescript-reviewer]

- [ ] **M5** `src/App.tsx:27-29` — Missing terminal cleanup on unmount. Old store called `destroyTerminal()` in cleanup; new store only calls `unsubscribe?.()`. HMR/StrictMode remounts leak backend terminal processes until MAX_TERMINALS hit. Fix: expose `destroyAllTerminals` action or iterate `paneTerminals` in cleanup. [silent-failure-hunter, security-auditor, code-simplifier, efficiency]

- [ ] **M6** `src/store/workspace.ts:401-420,429-441,459-470,509-520` — Redundant `paneTerminals` spread pattern repeated 4+ times. Spread of `state.paneTerminals[paneId]` can be `undefined` if pane was removed between guard and `set()` callback. Also: explicit `?? null` fallbacks after spread are redundant. Fix: extract `updatePaneTerminal(state, paneId, patch)` helper with a `DEFAULT_PANE_TERMINAL` constant. [dry-reuse, code-simplifier, type-design-analyzer, typescript-reviewer, efficiency]

- [ ] **M7** `src/store/workspace.ts:478-485` — Sequential pane initialization blocks startup. `initWorkspace` awaits each `initPane` in serial `for` loop. With 4-pane preset, startup latency is 4x. Pane inits are independent. Fix: use `Promise.all(paneIds.map(...))`. [efficiency]

- [ ] **M8** `src/store/workspace.ts:444-451,454-473` — `resizePane` and `refreshPaneGrid` swallow errors with `console.error` only. User gets frozen terminal with wrong dimensions and no error feedback. Fix: set `connected: false` / `error` on pane state like `writeToPane` does. [silent-failure-hunter]

- [ ] **M9** `src/store/__tests__/workspace.test.ts` — Missing tests for IPC error paths. No tests for: `initPane` error (create_terminal throws), `writeToPane` error/success/guard, `removeWorkspace` terminal cleanup (`destroy_terminal` called), `initWorkspace` multi-pane init. These are the primary failure modes users encounter. [pr-test-analyzer]

## Suggestions (13 items)

- [ ] **S1** `src/store/workspace.ts:102-108` — `findPaneByTerminalId` O(n) scan on every `terminal-output` event (highest-frequency event). Maintain a reverse lookup `Map<terminalId, paneId>` updated in `initPane`/`closePane`/exit handler for O(1). [efficiency]

- [ ] **S2** `src/store/workspace.ts:49-54` — `PaneTerminalState` is a flat bag of nullable fields allowing impossible states (`terminalId: null, connected: true`). Consider discriminated union: `{ status: "idle" } | { status: "connected"; terminalId: string; grid: CellGrid | null } | { status: "error"; error: string }`. [type-design-analyzer]

- [ ] **S3** `src/store/workspace.ts:259-260` — `reorderWorkspaces` accepts any `string[]` without validating IDs exist in `workspaces`. Can silently corrupt `openWorkspaceIds ↔ workspaces` invariant. [security-auditor, type-design-analyzer]

- [ ] **S4** `src/store/workspace.ts:280-282` — `setActivePane` accepts any string without verifying pane exists. Test at `workspace.test.ts:230` passes literal `"some-pane-id"` that doesn't exist. [type-design-analyzer]

- [ ] **S5** `src/store/workspace.ts:62` — `visitedWorkspaceIds: Set<string>` inside Zustand state is unusual — `Set` defeats shallow equality, forcing `new Set([...spread])` on every update. Move to closure-scoped `Set` (like `pendingRefreshPanes`) since components never read it, or replace with `Record<string, true>`. [type-design-analyzer, typescript-reviewer, efficiency]

- [ ] **S6** `src/App.tsx:7-9` — `paneTerminal` selector closes over `activePaneId` from outer scope, creating new closure each render — defeats Zustand's referential equality. Combine into single selector with `useShallow`. [code-simplifier, typescript-reviewer, efficiency]

- [ ] **S7** `src/store/workspace.ts:135-141,176-182` — Duplicated "register and activate workspace" `set()` block in `createWorkspace` and `duplicateWorkspace`. Extract `registerWorkspace(id, workspace, tree)` helper. [dry-reuse]

- [ ] **S8** `src/store/workspace.ts:245-258` — `renameWorkspace` and `setWorkspaceColor` are structurally identical. Extract `updateWorkspaceField(workspaceId, patch)` helper. [dry-reuse]

- [ ] **S9** `src/store/workspace.ts:236,372` — Duplicated `invoke("destroy_terminal", { id }).catch(console.error)` in `removeWorkspace` and `closePane`. Extract `destroyTerminalAsync(id)` one-liner. [dry-reuse]

- [ ] **S10** `src/App.tsx:19-22` — Missing ordering comment. Init sequence has critical constraint: events must subscribe before `initWorkspace` creates terminals. Add: `// Subscribe before initializing panes to avoid missing terminal output events`. [comment-analyzer]

- [ ] **S11** `src/store/workspace.ts:100,102-108` — Missing comments on `pendingRefreshPanes` (rAF coalescing) and `findPaneByTerminalId` (reverse lookup purpose). [comment-analyzer]

- [ ] **S12** `src/store/__tests__/workspace.test.ts` — Mock returns same `"mock-terminal-id"` for every `create_terminal` call. Multiple panes share same ID; `findPaneByTerminalId` only matches first. Return unique IDs via counter. [pr-test-analyzer, security-auditor]

- [ ] **S13** `src/store/__tests__/workspace.test.ts` — Missing `vi.clearAllMocks()` in `beforeEach`. Mock call counts accumulate across tests. [pr-test-analyzer]

## Nitpicks (8 items)

- [ ] **N1** `src/store/workspace.ts:416,437` — Error message `Failed to create terminal: ${e}` produces "Error: Error: ..." for Error objects. Use `e instanceof Error ? e.message : String(e)`. [silent-failure-hunter]

- [ ] **N2** `src/store/workspace.ts:25-27` — `nextColor` `?? "#6c63ff"` fallback is unreachable (WORKSPACE_COLORS has 8 entries, modulo always valid). Keep for `noUncheckedIndexedAccess` but add comment. [type-design-analyzer]

- [ ] **N3** `src/store/workspace.ts:200` — `const { [workspaceId]: _, ... }` — use `_removedWorkspace` for consistency with `_removedPane`/`_removedTerminal` at lines 349-350. [code-simplifier, typescript-reviewer]

- [ ] **N4** `src/store/workspace.ts:17-18` — `EVENT_TERMINAL_OUTPUT`/`EVENT_TERMINAL_EXIT` duplicated from deleted `terminal.ts`. Move to `src/types/terminal.ts`. [type-design-analyzer, typescript-reviewer]

- [ ] **N5** `src/store/__tests__/workspace.test.ts:121,127` — Duplicate comments about auto-creating workspace on removal. Keep only line 121. [comment-analyzer]

- [ ] **N6** `src/store/__tests__/workspace.test.ts:300-304` — `updatePaneSizes` test has `if` guard that silently passes if tree isn't a branch. Add `expect` assertion before narrowing. [pr-test-analyzer]

- [ ] **N7** `src/store/__tests__/workspace.test.ts:175` — `setWorkspaceColor(id, "#e74c3c")` uses string literal. Import `WORKSPACE_COLORS` and index into it for resilience. [typescript-reviewer]

- [ ] **N8** `src/store/__tests__/workspace.test.ts:23` — JSDoc on `getActivePaneId` is grammatically ambiguous. Rewrite: `/** Get activePaneId, throwing if null — avoids non-null assertions that Biome flags. */`. [comment-analyzer]

*Review ran: code-reviewer, security-auditor, silent-failure-hunter, code-simplifier, dry-reuse, comment-analyzer, type-design-analyzer, pr-test-analyzer, typescript-reviewer, efficiency*
