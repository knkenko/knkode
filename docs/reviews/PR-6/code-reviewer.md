# PR-6 Code Review: Workspace Store

## Summary

This PR replaces the single-terminal `terminal.ts` store with a multi-workspace/pane `workspace.ts` store, threading `paneId` through `App.tsx` and `Terminal.tsx`. The architecture is sound and the test coverage is good. The main issues are stale-closure bugs in several store actions where workspace objects captured from `get()` are spread inside `set()` callbacks, which can silently drop concurrent state updates.

## Must Fix

- **`src/store/workspace.ts:314-317` (splitPane) -- Stale workspace reference inside set callback (Confidence: 90)**
  The `workspace` object is captured from `get()` at line 296, then spread inside the `set((state) => ...)` callback at lines 314-317. If any concurrent action modifies this workspace between the `get()` and the `set()`, those changes are silently overwritten. The callback correctly reads `state.workspaces` for the outer spread but then uses the stale `workspace` for the inner spread.
  **Fix:** Read the workspace from `state.workspaces[workspaceId]` inside the `set` callback:
  ```typescript
  set((state) => {
      const current = state.workspaces[workspaceId];
      if (!current) return state;
      return {
          workspaces: {
              ...state.workspaces,
              [workspaceId]: {
                  ...current,
                  layout: { type: "custom", tree: newTree },
                  panes: { ...current.panes, [newPaneId]: newPaneConfig },
              },
          },
          activePaneId: newPaneId,
      };
  });
  ```

- **`src/store/workspace.ts:357-368` (closePane) -- Uses `get()` inside non-callback `set()`, stale workspace (Confidence: 92)**
  `set({...})` is called with `get().workspaces` at line 359 (non-atomic read) and the stale `workspace` captured at line 332. This is the same class of bug as `splitPane` but worse because it does not even use the callback form of `set()`. If any concurrent action fires between the `get()` calls and the `set()`, state is lost.
  **Fix:** Convert to callback form and read all state from the callback parameter:
  ```typescript
  set((state) => ({
      workspaces: {
          ...state.workspaces,
          [workspaceId]: {
              ...state.workspaces[workspaceId],
              layout: { type: "custom", tree: newTree },
              panes: remainingPanes,
          },
      },
      activePaneId: newActivePaneId,
      paneTerminals: remainingPaneTerminals,
  }));
  ```
  Also compute `remainingPanes`, `remainingPaneTerminals`, and `newActivePaneId` inside the callback, or at minimum read `workspace` from `state`.

- **`src/store/workspace.ts:245-250` (renameWorkspace) -- Stale workspace in set callback (Confidence: 88)**
  `workspace` is captured from `get()` at line 246 and spread inside `set((state) => ...)` at line 249. Concurrent changes to the same workspace between `get()` and `set()` are silently dropped.
  **Fix:** Read workspace from `state` inside the callback:
  ```typescript
  set((state) => {
      const ws = state.workspaces[workspaceId];
      if (!ws) return state;
      return { workspaces: { ...state.workspaces, [workspaceId]: { ...ws, name } } };
  });
  ```

- **`src/store/workspace.ts:253-258` (setWorkspaceColor) -- Same stale workspace pattern (Confidence: 88)**
  Identical issue to `renameWorkspace`.
  **Fix:** Same pattern -- read workspace from `state` inside the callback.

## Suggestions

- **`src/store/workspace.ts:280-282` (setActiveWorkspace) -- Unhandled async rejection (Confidence: 82)**
  `get().initWorkspace(workspaceId)` is fire-and-forget with no `.catch()`. If workspace initialization fails (e.g., Tauri IPC error), the promise rejection is unhandled and may cause an unhandledrejection error in some environments.
  **Fix:** Add `.catch(console.error)` or handle the error:
  ```typescript
  if (!wasVisited) {
      get().initWorkspace(workspaceId).catch(console.error);
  }
  ```

- **`src/store/workspace.ts:324` (splitPane) -- Same unhandled async rejection (Confidence: 82)**
  `get().initPane(newPaneId)` is fire-and-forget with no `.catch()`.
  **Fix:** Add `.catch(console.error)`.

- **`src/store/workspace.ts:396-397` (initPane) -- Race condition on double-init (Confidence: 80)**
  The check `if (get().paneTerminals[paneId]?.terminalId) return` at line 397 is not atomic with the subsequent `invoke("create_terminal")`. If `initPane` is called twice for the same paneId in quick succession (possible if `setActiveWorkspace` triggers `initWorkspace` while a split is also initializing the same pane), both calls pass the guard and two terminals are created, but only the last one is stored. The first terminal leaks and is never destroyed.
  **Fix:** Add a `Set<string>` of pane IDs currently being initialized (similar to `pendingRefreshPanes`), and check/add atomically before the async call:
  ```typescript
  const initializingPanes = new Set<string>();
  // ...
  initPane: async (paneId: string) => {
      if (get().paneTerminals[paneId]?.terminalId) return;
      if (initializingPanes.has(paneId)) return;
      initializingPanes.add(paneId);
      try {
          // ... existing logic
      } finally {
          initializingPanes.delete(paneId);
      }
  },
  ```

## Nitpicks

- None
