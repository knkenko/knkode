# PR #6 Type Design Review: `feature/workspace-store`

## Summary

The workspace store introduces a well-structured multi-workspace, multi-pane architecture with good domain modeling in `src/types/workspace.ts` (readonly fields, discriminated unions, factory functions, a `validateWorkspace` function). However, the store layer (`src/store/workspace.ts`) undermines several of those guarantees: `PaneTerminalState` is a flat bag of nullable fields with no enforced state machine, `WorkspaceStoreState` has redundant parallel data structures whose sync is entirely manual, and several actions silently accept invalid input without validation. The type definitions are a solid foundation, but the store's invariants need tightening.

---

## Must Fix

- **`src/store/workspace.ts:49-54`** -- `PaneTerminalState` allows every combination of `{ terminalId: string | null, connected: boolean, error: string | null, grid: CellGrid | null }`, but only a few combinations are valid: (1) uninitialized: all null/false, (2) connected: terminalId set, connected true, error null, (3) disconnected/errored: connected false, error or terminalId may vary. This should be a discriminated union (e.g., `{ status: "idle" } | { status: "connected"; terminalId: string; grid: CellGrid | null } | { status: "error"; error: string }`) so that impossible states like `{ terminalId: null, connected: true }` or `{ terminalId: "abc", connected: false, error: null }` are unrepresentable. Currently every consumer must defensively null-check fields that logically cannot be null in a given state.

- **`src/store/workspace.ts:413-428`** -- `writeToPane` and `refreshPaneGrid` (lines 455-475) use a fragile spread pattern: `{ ...state.paneTerminals[paneId], terminalId: state.paneTerminals[paneId]?.terminalId ?? null, grid: state.paneTerminals[paneId]?.grid ?? null, ... }`. The spread of `state.paneTerminals[paneId]` can be `undefined` if the pane was removed between the guard check and the `set()` callback (race with `closePane` or `removeWorkspace`). This silently produces `{ undefined, ... }` with missing fields. Each setter must guard inside the `set()` callback, not just outside it. This is a correctness issue, not just style.

- **`src/store/workspace.ts:259-260`** -- `reorderWorkspaces` accepts any `string[]` without validating that the provided IDs match `openWorkspaceIds`. Passing IDs that do not exist in `workspaces`, passing duplicates, or omitting existing IDs will corrupt the `openWorkspaceIds <-> workspaces` invariant silently. Add a guard that verifies the new array is a permutation of the current `openWorkspaceIds`.

- **`src/store/workspace.ts:280-282`** -- `setActivePane` accepts any string without checking that the pane exists in the active workspace (or any workspace). The test at `workspace.test.ts:230` demonstrates this: it sets `activePaneId` to the literal `"some-pane-id"` which does not exist anywhere. This breaks the invariant that `activePaneId` should reference a real pane in the active workspace.

## Suggestions

- **`src/store/workspace.ts:58-65`** -- `WorkspaceStoreState` maintains `openWorkspaceIds` (ordering) as a separate array from the `workspaces` record (data). These two must stay in sync, but synchronization is scattered across every action. Consider a single `workspaces: Map<string, Workspace>` with insertion-order guarantees, or at minimum a private helper function that updates both atomically. The current approach is the single most likely source of desync bugs as more actions are added.

- **`src/store/workspace.ts:58-65`** -- `activePaneId` is a global field, but panes are workspace-scoped. This means switching workspaces requires remembering to update `activePaneId`, and the "last active pane per workspace" is lost on switch. Consider moving `activePaneId` into the `Workspace` type (or a parallel `Record<workspaceId, paneId>`) so each workspace remembers its own active pane.

- **`src/store/workspace.ts:63`** -- `visitedWorkspaceIds: Set<string>` is used solely to gate lazy `initWorkspace` calls. A `Set` inside Zustand state is unusual -- Zustand's shallow equality check will not detect mutations to a `Set`, so the code must always create a `new Set(...)` on every update (which it does, but it is fragile). Consider replacing with `initializedWorkspaceIds: Record<string, boolean>` for idiomatic Zustand, or moving the tracking into a closure-scoped `Set` (like `pendingRefreshPanes`) since components never need to read it.

- **`src/store/workspace.ts:492-497`** -- `subscribeToEvents` casts `event.payload as string` without validation. If the backend ever sends a non-string payload (e.g., an object with a terminal ID field), this will silently produce `"[object Object]"` as the terminal ID and fail to match any pane. Add a runtime type check or use a typed event schema.

- **`src/store/workspace.ts:68-98`** -- `WorkspaceStoreActions` groups workspace CRUD, navigation, pane operations, terminal IPC, and event subscription into a single interface. This 17-method interface signals that the store is doing too much. Consider splitting terminal IPC actions into a separate concern (e.g., a `createTerminalSlice` Zustand slice) to keep the workspace store focused on layout/navigation and the terminal store focused on IPC lifecycle. This would also make `PaneTerminalState` management self-contained.

- **`src/store/workspace.ts:246-256`** -- `renameWorkspace` and `setWorkspaceColor` capture `workspace` from `get()` outside the `set()` callback but use it inside. If two rapid calls overlap, the second `set()` will overwrite changes from the first because `workspace` is stale. Use the functional form consistently: `set((state) => { const ws = state.workspaces[workspaceId]; if (!ws) return {}; ... })`.

## Nitpicks

- **`src/store/workspace.ts:25-27`** -- `nextColor` has a fallback `?? "#6c63ff"` that can never execute because `WORKSPACE_COLORS` has 8 entries and `count % 8` always yields a valid index. The fallback is dead code; it is harmless but adds visual noise. If keeping it for safety, add a comment explaining it satisfies `noUncheckedIndexedAccess`.

- **`src/store/workspace.ts:17-18`** -- `EVENT_TERMINAL_OUTPUT` and `EVENT_TERMINAL_EXIT` are duplicated from the deleted `terminal.ts`. These are shared domain constants that should live in a constants file (e.g., `src/constants/events.ts`) or in `src/types/terminal.ts` alongside the other terminal type definitions.

- **`src/App.tsx:7-10`** -- The selector `(s) => activePaneId ? s.paneTerminals[activePaneId] : undefined` captures `activePaneId` from the outer scope, creating a stale closure. When `activePaneId` changes, Zustand re-renders the component (because `activePaneId` changed), and React re-evaluates this selector with the new `activePaneId`, so it works in practice. However, this is a subtle correctness dependency. A single selector that derives both values would be more robust: `(s) => ({ activePaneId: s.activePaneId, paneTerminal: s.activePaneId ? s.paneTerminals[s.activePaneId] : undefined })` with a shallow equality comparator.

- **`src/store/__tests__/workspace.test.ts:35-42`** -- `resetStore` manually lists every state field. If a new field is added to `WorkspaceStoreState`, the reset will be incomplete, leaving stale state between tests. Consider using `useWorkspaceStore.setState(useWorkspaceStore.getInitialState())` or extracting the initial state as a constant from the store module.
