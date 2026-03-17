# PR-6 Code Simplification Review

## Summary

The workspace store is well-structured overall and the migration from a single-terminal store to a multi-pane workspace store is clean. The main issues are: (1) repetitive `PaneTerminalState` spread patterns that should be extracted into a helper, (2) a `closePane` method that reads stale state via `get()` inside a non-updater `set()` call, and (3) a missing terminal cleanup on app unmount.

## Must Fix

- `workspace.ts:357-368` — `closePane` calls `set({...})` (non-updater form) but reads `get().workspaces` on line 359 to build the new workspaces object. Between lines 349-356 (which also use `get()`) and the `set()` call on 357, another async action (e.g. `splitPane` firing `initPane`) could modify state, causing the `set()` to overwrite those changes. Use the updater form `set((state) => ({...}))` and derive all values from `state`, consistent with how `createWorkspace`, `duplicateWorkspace`, `renameWorkspace`, etc. already do it.

- `workspace.ts:428-441` — In the `writeToPane` error handler, the spread `...state.paneTerminals[paneId]` followed by explicit `terminalId: state.paneTerminals[paneId]?.terminalId ?? null` and `grid: state.paneTerminals[paneId]?.grid ?? null` is both redundant and misleading. The spread already copies `terminalId` and `grid`, then the explicit lines overwrite them with the same values (plus a `?? null` fallback that is unreachable since the spread would fail first if the entry were undefined). The same pattern appears in `refreshPaneGrid` (lines 459-470) and `subscribeToEvents` exit handler (lines 509-520). Either drop the spread and write all four fields explicitly (preferred for a 4-field interface), or drop the redundant explicit overrides and guard the entry before spreading.

## Suggestions

- `workspace.ts:423-441,454-473,490-520` — The pattern of looking up `get().paneTerminals[paneId]`, spreading the existing state, and setting individual fields repeats across `writeToPane`, `refreshPaneGrid`, and the `subscribeToEvents` exit handler. Extract a small helper like `updatePaneTerminal(paneId: string, patch: Partial<PaneTerminalState>)` that handles the lookup, spread, and `set()` in one place. This would reduce ~15 lines per call site to 1 and eliminate the redundant spread issues noted above.

- `workspace.ts:193-197` — The `terminalIds` collection loop could be simplified with `flatMap`/`filter`:
  ```ts
  const terminalIds = paneIds
    .map((id) => get().paneTerminals[id]?.terminalId)
    .filter((tid): tid is string => tid != null);
  ```

- `App.tsx:7-9` — The `paneTerminal` selector closes over `activePaneId` from a separate `useWorkspaceStore` call on line 6, which means it re-subscribes on every `activePaneId` change but also causes a double-render (once for `activePaneId` changing, once for `paneTerminal` changing). Consider combining into a single selector that derives both values, or using Zustand's `useShallow` to select a tuple.

- `App.tsx:27-28` — The cleanup function no longer calls `destroyTerminal` (removed from the old store), but the workspace store still has `removeWorkspace` which handles terminal cleanup. On app unmount (e.g. hot-reload in dev), active terminals are leaked. Consider calling `store.removeWorkspace(workspaceId)` in the cleanup, or adding a dedicated `destroyAllTerminals` action.

- `workspace.ts:40-43` — `findWorkspaceForPane` iterates with `Object.entries(workspaces)` but the `wsId` variable is unused because the return is implicit from the `for..of`. The destructured `[wsId, ws]` is fine, but note that this linear scan is O(n) per workspace. For now this is acceptable, but if workspace count grows, consider a reverse index (`paneId -> workspaceId`).

## Nitpicks

- `workspace.ts:104` — `for (const [paneId, state] of Object.entries(terminals))` shadows the outer `state` parameter name commonly used in Zustand updaters. Consider renaming to `terminalState` or `pts` for clarity.

- `workspace.ts:46,55` — The section comments `// -- Per-pane terminal state --` and `// -- Store shape --` are fine for navigation, but the inline comments like `// -- Initial state --` (line 111), `// -- Workspace CRUD --` (line 119), `// -- Navigation --` (line 265), etc. inside the returned object literal are somewhat redundant given the interface already groups these logically. Consider keeping only the top-level section dividers.

- `workspace.ts:809` (diff line) / `workspace.ts:200` — The destructured `_` in `const { [workspaceId]: _, ...remainingWorkspaces } = get().workspaces` is a common pattern, but `_removedWorkspace` would be more descriptive (consistent with `_removedPane` and `_removedTerminal` on lines 349-350).
