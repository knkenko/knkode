# PR #6 Test Coverage Review: workspace-store

## Summary

The workspace store test suite (`src/store/__tests__/workspace.test.ts`) provides solid coverage of the synchronous workspace CRUD and pane management operations (24 tests), but has significant gaps in async IPC error paths, event handler behavior, and terminal lifecycle cleanup. The synchronous layout operations delegate to well-tested utility functions (`layout-tree.ts`, `layout-presets.ts`), which is appropriate, but the store's own error-handling and state-transition logic around terminal IPC is largely untested.

## Must Fix

- `src/store/__tests__/workspace.test.ts`: No test for `initPane` error path (`workspace.ts:408-420`). When `invoke("create_terminal")` throws, the store should set `connected: false`, `error` with a descriptive message, and `terminalId: null`. This is the primary error path users will encounter when the backend is unavailable. Without this test, a regression could silently swallow terminal creation failures or leave the pane in an inconsistent state. **Criticality: 9/10**

- `src/store/__tests__/workspace.test.ts`: No test for `writeToPane` error path (`workspace.ts:428-441`). When `invoke("write_to_terminal")` throws, the store transitions the pane to `connected: false` and sets an error message. This is a critical state transition -- a regression here could leave a pane appearing connected when the terminal is broken, causing the user to type into a dead terminal with no feedback. **Criticality: 8/10**

- `src/store/__tests__/workspace.test.ts`: No test for `writeToPane` success path or its guard clause (`workspace.ts:423-427`). The function silently returns if no `terminalId` exists for the pane. There is no test verifying that `writeToPane` actually calls `invoke("write_to_terminal")` with the correct arguments, or that it correctly no-ops when the pane has no terminal. **Criticality: 8/10**

- `src/store/__tests__/workspace.test.ts`: No test for `removeWorkspace` terminal cleanup (`workspace.ts:191-197, 234-237`). When removing a workspace, the store collects terminal IDs and calls `invoke("destroy_terminal")` for each. A regression here would leak terminal processes on the backend. Tests should verify `destroy_terminal` is called with correct IDs and that `paneTerminals` entries are cleaned up. **Criticality: 8/10**

- `src/store/__tests__/workspace.test.ts`: No test for `initWorkspace` (`workspace.ts:478-486`). This orchestrates calling `initPane` for every pane in a workspace. There is no test verifying it initializes all panes (important for multi-pane presets like `2-column` or `2x2-grid`), or that it no-ops for a non-existent workspace. **Criticality: 8/10**

## Suggestions

- `src/store/__tests__/workspace.test.ts`: No test for `resizePane` (`workspace.ts:444-452`). Should verify it calls `invoke("resize_terminal")` with the correct terminal ID, cols, and rows, and that it no-ops when pane has no terminal. **Criticality: 6/10**

- `src/store/__tests__/workspace.test.ts`: No test for `refreshPaneGrid` (`workspace.ts:454-474`). Should verify that the grid is stored in `paneTerminals[paneId].grid` after a successful invoke, and that it no-ops for a pane without a terminal ID. **Criticality: 6/10**

- `src/store/__tests__/workspace.test.ts`: The `subscribeToEvents` test (line 340-345) only checks that it returns a function. It does not test the actual event handler behavior -- specifically the `terminal-output` handler's rAF-based coalescing logic (`workspace.ts:496-501`) or the `terminal-exit` handler's state transition to `connected: false` (`workspace.ts:509-520`). Testing the exit handler by manually invoking the listen callback would catch regressions in the disconnect flow. **Criticality: 7/10**

- `src/store/__tests__/workspace.test.ts`: No test for `closePane` cleaning up `paneTerminals` and calling `destroy_terminal` (`workspace.ts:337-338, 350, 370-373`). The existing `closePane` tests (lines 254-283) verify layout/workspace state but not terminal cleanup. A regression here leaks terminal processes. **Criticality: 7/10**

- `src/store/__tests__/workspace.test.ts`: The `removeWorkspace` test "switches active to adjacent workspace on removal" (line 131-142) only tests removing the last workspace in the list. It should also test removing a workspace from the middle or start of the list to verify the index-clamping logic at `workspace.ts:212-213`. **Criticality: 5/10**

- `src/store/__tests__/workspace.test.ts`: The `setActiveWorkspace` test (line 198-213) does not verify the lazy initialization behavior -- switching to a previously unvisited workspace should trigger `initWorkspace` (`workspace.ts:280-282`), while switching to an already-visited workspace should not. This is a meaningful behavioral distinction. **Criticality: 6/10**

- `src/store/__tests__/workspace.test.ts`: No test for `duplicateWorkspace` verifying that the duplicate preserves the layout structure (direction, sizes) of the original. The test at line 90 checks pane count and name but not structural fidelity of the layout tree. **Criticality: 5/10**

- `src/store/__tests__/workspace.test.ts`: The mock at line 5-17 does not reset between tests. While `resetStore()` clears state, `vi.mocked(invoke).mock.calls` accumulates across tests. The `initPane` "skips if terminal already initialized" test (line 324) works around this by capturing `callCount`, but tests would be more isolated if `vi.clearAllMocks()` were added to `beforeEach`. **Criticality: 5/10**

## Nitpicks

- `src/store/__tests__/workspace.test.ts:56`: `expect(state.activePaneId).toBeTruthy()` is a weak assertion. It would be stronger to verify that `activePaneId` is a string that exists as a key in the workspace's `panes` record, confirming referential consistency.

- `src/store/__tests__/workspace.test.ts:300-304`: The `updatePaneSizes` test has an `if` guard (`if (after?.layout.tree.type === "branch")`) that silently passes if the condition is false. This should use `expect` to assert the type is "branch" before checking children, so the test fails loudly if the precondition is violated.

- `src/store/__tests__/workspace.test.ts:219-224`: The `setActivePane` test sets an arbitrary string `"some-pane-id"` that does not correspond to any actual pane. While this tests that the setter works, it also demonstrates that `setActivePane` performs no validation -- which may be intentional but is worth a comment in the test or a follow-up to add validation.

- `src/store/__tests__/workspace.test.ts:7`: The mock for `invoke` returns `"mock-terminal-id"` for every `create_terminal` call. When multiple panes are initialized, they all share the same terminal ID in `paneTerminals`, which means `findPaneByTerminalId` would only ever match the first entry. Consider returning unique IDs (e.g., incrementing counter) to better simulate real behavior and prevent masked bugs.
