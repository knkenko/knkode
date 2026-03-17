# PR-6 TypeScript Review: `feature/workspace-store`

## Summary

The workspace store is well-typed and compiles cleanly under the project's strict tsconfig (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`). The main issues are unsafe `as string` casts on Tauri event payloads, a stale-closure hazard in zustand updaters that capture `workspace` before `set()`, and a test that passes a string literal where the `Workspace["color"]` union type requires a palette constant.

## Must Fix

- **`src/store/workspace.ts:492`** and **`src/store/workspace.ts:504`**: `event.payload as string` is an unsafe type assertion. The event is typed `listen<unknown>`, so `payload` is `unknown`. Casting directly to `string` bypasses all runtime validation. If the backend ever sends a structured payload (e.g. `{ terminalId, exitCode }`) this will silently pass a non-string through. Add a runtime guard: `if (typeof event.payload !== "string") return;` and remove the `as string` cast, or narrow with `listen<string>` if the backend contract is stable and documented.

- **`src/store/workspace.ts:245-250`** (`renameWorkspace`), **`src/store/workspace.ts:253-258`** (`setWorkspaceColor`), **`src/store/workspace.ts:311-321`** (`splitPane` set call), **`src/store/workspace.ts:376-391`** (`updatePaneSizes` set call): These updaters capture `workspace` from `get()` outside the `set()` callback, then spread it inside the updater function. In zustand, the `state` argument to the `set` callback is the latest state at the time of the update, but `workspace` was captured earlier. If two synchronous calls to these methods target the same workspace, the second call's `workspace` will be stale, and the first call's changes will be silently overwritten. Inside each `set((state) => ...)` callback, re-derive `workspace` from `state.workspaces[workspaceId]` instead of closing over the outer variable. The `closePane` method at line 357-368 has the same issue -- it uses `get().workspaces` instead of `state.workspaces` inside its `set()` call.

## Suggestions

- **`src/store/workspace.ts:429-441`** (`writeToPane` catch block), **`src/store/workspace.ts:459-470`** (`refreshPaneGrid` set call), **`src/store/workspace.ts:509-519`** (`subscribeToEvents` exit handler): The pattern of `...state.paneTerminals[paneId]` followed by explicit `?? null` / `?? false` fallbacks for each field is verbose and fragile -- if `PaneTerminalState` gains a new field, every spread site must be updated manually. Consider extracting a helper like `const DEFAULT_PANE_TERMINAL: PaneTerminalState = { terminalId: null, grid: null, connected: false, error: null }` and using `{ ...DEFAULT_PANE_TERMINAL, ...state.paneTerminals[paneId], <overrides> }`. This also eliminates the risk of forgetting a fallback under `noUncheckedIndexedAccess`.

- **`src/store/workspace.ts:62`**: `visitedWorkspaceIds: Set<string>` in the state interface means zustand will never detect changes to the set by reference equality (you always create a `new Set` to trigger re-renders, which is correct). However, this also means any component subscribing to `visitedWorkspaceIds` will re-render on every `set()` call that includes it. Consider whether a plain `Record<string, true>` or `string[]` would be more idiomatic for zustand's shallow-equality model and avoid the `new Set([...spread])` allocation pattern.

- **`src/store/workspace.ts:281`**: `get().initWorkspace(workspaceId)` is called as a fire-and-forget (no `await`, no `.catch()`). If `initWorkspace` throws, the error is silently swallowed. Add `.catch(console.error)` for observability, matching the pattern already used for `invoke("destroy_terminal", ...)` elsewhere.

- **`src/App.tsx:7-9`**: The `paneTerminal` selector closes over `activePaneId` from the previous render. On the render where `activePaneId` changes from `null` to a value, `paneTerminal` will still be `undefined` because the selector captured the old `activePaneId`. This causes an unnecessary extra render cycle. A single selector returning both values would be more efficient: `const { activePaneId, paneTerminal } = useWorkspaceStore((s) => ({ activePaneId: s.activePaneId, paneTerminal: s.activePaneId ? s.paneTerminals[s.activePaneId] : undefined }))`, paired with zustand's `useShallow` to avoid infinite re-renders from the new object reference.

- **`src/store/workspace.ts:200`**: The destructuring `const { [workspaceId]: _, ...remainingWorkspaces } = get().workspaces` uses `_` as an intentional discard. While this compiles (TypeScript treats `_` prefixed variables as intentionally unused), this pattern is repeated at lines 349-350 with `_removedPane` and `_removedTerminal`. Consider extracting a small `omit` utility to make intent clearer and avoid lint-rule sensitivity around unused variables.

## Nitpicks

- **`src/store/__tests__/workspace.test.ts:175`**: `setWorkspaceColor(id, "#e74c3c")` passes a string literal. The `Workspace["color"]` type is `(typeof WORKSPACE_COLORS)[number]`, which is a union of 8 specific string literals. This test only compiles because `"#e74c3c"` happens to be one of the 8 palette values. If the palette changes, this test will break with a confusing type error rather than a logical test failure. Import `WORKSPACE_COLORS` and index into it to make the test resilient.

- **`src/store/workspace.ts:40`**: `findWorkspaceForPane` iterates `Object.entries(workspaces)` after the fast-path check, but it does not skip `activeWorkspaceId` in the loop, so the active workspace is checked twice in the miss case. This is harmless but could be micro-optimized with a `if (wsId === activeWorkspaceId) continue;` guard.

- **`src/store/__tests__/workspace.test.ts:6`**: The `invoke` mock returns `undefined` as a fallback for unhandled commands. Under strict mode this is fine, but adding an explicit `throw new Error(\`Unhandled invoke command: ${cmd}\`)` as the default case would surface unexpected IPC calls during tests rather than silently swallowing them.

- **`src/store/workspace.ts:17-18`**: `EVENT_TERMINAL_OUTPUT` and `EVENT_TERMINAL_EXIT` are module-level string constants. Since these are shared between the store and potentially tests or other modules, consider collocating them in a shared constants file (e.g. `src/constants/events.ts`) or in the terminal types file to avoid duplication if other stores need to listen to the same events.
