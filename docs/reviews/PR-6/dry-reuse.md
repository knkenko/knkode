# DRY / Reuse Review -- PR #6 (`feature/workspace-store`)

## Summary

The workspace store introduces significant new state management with clean separation between workspace CRUD and per-pane terminal IPC. The main DRY concerns are: (1) a verbose `paneTerminals` partial-update pattern repeated 4 times that should be extracted into a helper, (2) a duplicated "add workspace and activate it" `set()` block between `createWorkspace` and `duplicateWorkspace`, and (3) a duplicated "lookup workspace by ID, guard null" preamble used 6 times.

## Must Fix

- **`src/store/workspace.ts:429-440` / `src/store/workspace.ts:459-470` / `src/store/workspace.ts:509-520` -- Repeated verbose `paneTerminals` partial-update pattern.** Three locations (plus `initPane` error handler at `:409-420`) perform a partial update to a single pane's terminal state by spreading the entire `paneTerminals` record, then spreading the individual pane entry, then re-declaring every field with `?? null` / `?? false` defaults. This is error-prone (forgetting a field silently drops it) and will grow worse as more pane-terminal fields are added. Extract a helper like `updatePaneTerminal(state, paneId, patch): WorkspaceStoreState["paneTerminals"]` that handles the spread and defaults in one place.

  Affected locations:
  - `src/store/workspace.ts:429-440` (`writeToPane` error handler)
  - `src/store/workspace.ts:459-470` (`refreshPaneGrid` success handler)
  - `src/store/workspace.ts:509-520` (`subscribeToEvents` exit handler)
  - `src/store/workspace.ts:401-420` (`initPane` both success and error paths -- slightly different shape but same structural pattern)

## Suggestions

- **`src/store/workspace.ts:135-141` / `src/store/workspace.ts:176-182` -- Duplicated "register and activate workspace" `set()` block.** `createWorkspace` and `duplicateWorkspace` both call an identical `set()` with the same 5-key shape: add workspace to record, append to `openWorkspaceIds`, set `activeWorkspaceId`, set `activePaneId` via `getFirstPaneId`, and add to `visitedWorkspaceIds`. Extract a private helper like `registerWorkspace(id, workspace, tree)` that performs this `set()` call, reducing both methods by ~7 lines each and ensuring they stay in sync if the registration logic changes.

- **`src/store/workspace.ts:245-258` -- `renameWorkspace` and `setWorkspaceColor` are structurally identical.** Both look up a workspace, guard null, then `set()` with a single-field workspace override. Consider a private `updateWorkspaceField(workspaceId, patch)` helper that handles the lookup, guard, and immutable update. This also pre-empts duplication when future workspace fields are added (e.g., icon, pinned).

  - `src/store/workspace.ts:245-250` (`renameWorkspace`)
  - `src/store/workspace.ts:253-258` (`setWorkspaceColor`)

- **`src/store/workspace.ts:236` / `src/store/workspace.ts:372` -- Duplicated `invoke("destroy_terminal", ...)` fire-and-forget cleanup.** Both `removeWorkspace` and `closePane` call `invoke("destroy_terminal", { id }).catch(console.error)`. If the cleanup logic needs to change (e.g., logging, retry, batching), it must be updated in two places. Extract a `destroyTerminalAsync(terminalId: string)` one-liner.

- **`src/store/workspace.ts:316` / `src/store/workspace.ts:362` / `src/store/workspace.ts:388` -- Repeated `layout: { type: "custom", tree: newTree }` literal.** Three separate pane/workspace mutation methods construct the same layout shape. This is a minor duplication but a `customLayout(tree)` factory would reduce noise and guarantee the `type` discriminant is always `"custom"`.

## Nitpicks

- **`src/store/workspace.ts:424,445,455` -- `get().paneTerminals[paneId]?.terminalId` guard repeated 3 times.** `writeToPane`, `resizePane`, and `refreshPaneGrid` all open with the same two lines: resolve `terminalId` from `paneTerminals`, early-return if null. This is a minor concern now but will compound as more pane IPC methods are added. A `getTerminalId(paneId)` closure (like the existing `findPaneByTerminalId`) would reduce the repetition.

- **`src/store/workspace.ts:291-297` / `src/store/workspace.ts:327-333` -- Duplicated pane-to-workspace resolution preamble in `splitPane` and `closePane`.** Both destructure `{ workspaces, activeWorkspaceId }`, call `findWorkspaceForPane`, guard null, then look up the workspace again. The second lookup (`workspaces[workspaceId]`) is technically redundant since `findWorkspaceForPane` already verified the workspace exists. Minor, but a `resolveWorkspaceForPane(paneId)` helper returning `{ workspace, workspaceId }` or `null` would tighten both methods.

- **`src/store/workspace.ts:140` / `src/store/workspace.ts:181` / `src/store/workspace.ts:277` -- `new Set([...state.visitedWorkspaceIds, id])` repeated 3 times.** Reconstructing a `Set` by spreading into an array then wrapping in `new Set` is a recurring pattern. A small `addToSet(set, value)` utility would be cleaner, though this is cosmetic.
