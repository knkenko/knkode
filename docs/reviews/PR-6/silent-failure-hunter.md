# PR-6 Silent Failure & Error Handling Audit

## Summary

The workspace store introduces a multi-pane terminal architecture with several fire-and-forget async operations, catch blocks that log to console without updating user-visible state, and a critical removal of terminal cleanup on unmount. Two patterns are especially dangerous: `resizePane` and `refreshPaneGrid` swallow errors with only `console.error` (invisible to users), and the App component's cleanup effect no longer destroys terminals when the component unmounts, leaking backend resources.

## Must Fix

- **`src/App.tsx:25`** -- `init().catch(console.error)` silently swallows the entire initialization failure (workspace creation, event subscription, terminal init) into the browser console. If `subscribeToEvents()` or `initWorkspace()` throws, the user sees "Terminal disconnected" with no explanation. This catch should set user-visible error state so the UI shows what actually went wrong and what the user can do (e.g., reload the app).

- **`src/App.tsx:27-29`** -- The cleanup function no longer calls `destroyTerminal` (removed from the old store, never replaced). When the App unmounts (e.g., in development with HMR, or on navigation), all backend terminal processes are leaked. The old store explicitly called `destroyTerminal().catch(console.error)` here. The new store must iterate `paneTerminals` and invoke `destroy_terminal` for each, or expose a `destroyAllTerminals` action.

- **`src/store/workspace.ts:444-451`** -- `resizePane` catches all IPC errors and writes only to `console.error`. The user gets zero feedback that resize failed. A persistent resize failure means the terminal is rendering at the wrong dimensions but the user has no idea. At minimum, this should set an error on the pane's terminal state (like `writeToPane` does), or log with a structured logger. Hidden errors: Tauri IPC channel failures, serialization errors, backend panics -- all silently swallowed.

- **`src/store/workspace.ts:454-473`** -- `refreshPaneGrid` catches all IPC errors with `console.error` only. If `get_terminal_state` fails persistently (e.g., terminal process crashed on the backend but exit event was missed), the grid silently stops updating forever. The user sees a frozen terminal with no error message. This must either set `connected: false` / `error` on the pane state, or propagate the error. Hidden errors: terminal process death, IPC deserialization failures, Rust panics -- all invisible to the user.

- **`src/store/workspace.ts:280-282`** -- `setActiveWorkspace` calls `initWorkspace(workspaceId)` without awaiting it and without any `.catch()`. This is a completely unhandled promise. If `initWorkspace` throws (which calls `initPane` which calls `invoke`), the rejection becomes an unhandled promise rejection -- potentially crashing the app in strict environments or silently disappearing. At minimum needs `.catch()` to set error state on the workspace's panes.

- **`src/store/workspace.ts:323-324`** -- `splitPane` calls `get().initPane(newPaneId)` without awaiting it and without `.catch()`. Same unhandled promise rejection problem. If the IPC call to create the terminal for the new pane fails, the promise rejection is completely unhandled. The user sees an empty pane with no error and no explanation.

## Suggestions

- **`src/store/workspace.ts:234-237`** -- Fire-and-forget `destroy_terminal` calls during `removeWorkspace` use `.catch(console.error)`. While cleanup errors are less critical, if destruction consistently fails, it indicates orphaned backend processes. Consider logging these with a structured logger and potentially accumulating a warning the user can see (e.g., "Failed to clean up N terminal processes").

- **`src/store/workspace.ts:370-373`** -- Same pattern in `closePane`. Fire-and-forget terminal destruction with `.catch(console.error)`. Same suggestion as above.

- **`src/store/workspace.ts:491-492`** -- `event.payload as string` is an unsafe type assertion. If the backend sends a payload in an unexpected format (object, number, null), this will silently produce incorrect behavior -- `findPaneByTerminalId` will never match, and terminal output will be silently dropped. Add runtime validation: check `typeof event.payload === "string"` before proceeding, and log a warning if the type is unexpected.

- **`src/store/workspace.ts:504-505`** -- Same unsafe `as string` cast on the terminal-exit event payload. Same risk of silently dropping exit events if the payload format changes or is malformed.

- **`src/store/workspace.ts:396-397`** -- `initPane` silently returns if the pane already has a `terminalId`. While this is guard logic (not error handling), if a caller expects initialization to happen and it silently skips, this could mask bugs. Consider returning a boolean or logging at debug level.

- **`src/App.tsx:32-33`** -- `paneTerminal?.connected ?? false` and `paneTerminal?.error ?? null` silently default when `paneTerminal` is undefined. This means if `activePaneId` points to a pane that has no entry in `paneTerminals` (a valid state during initialization or after a race condition), the user sees "Terminal disconnected" with no indication that initialization is still in progress vs. actually disconnected. Consider distinguishing "initializing" from "disconnected" states.

## Nitpicks

- **`src/store/workspace.ts:416`** -- Error message `Failed to create terminal: ${e}` stringifies the error with template literal coercion, which for Error objects produces `Failed to create terminal: Error: ...` (double "Error:"). Use `e instanceof Error ? e.message : String(e)` for cleaner messages.

- **`src/store/workspace.ts:437`** -- Same template literal error coercion pattern in `writeToPane`: `Write failed: ${e}`.

- **`src/store/workspace.ts:490-527`** -- `subscribeToEvents` does not handle the case where `listen()` itself throws (e.g., Tauri event system not available). If the first `listen` succeeds but the second throws, the first listener leaks with no cleanup. Wrap in try-catch that cleans up partial subscriptions.

- **`src/store/workspace.ts:261-262`** -- `reorderWorkspaces` blindly accepts any array of IDs with no validation. Passing IDs that don't exist in `workspaces` or omitting existing IDs would silently corrupt the workspace order. Not strictly error handling, but a silent data integrity issue.
