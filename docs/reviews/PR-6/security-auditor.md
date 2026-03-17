# Security Audit: PR #6 — Workspace Store

## Summary

This PR replaces a single-terminal Zustand store with a multi-workspace/multi-pane architecture that manages terminal IPC per pane. The security posture is reasonable for a Tauri desktop app: the backend enforces a MAX_TERMINALS cap and validates terminal IDs server-side, CSP is configured, and the frontend properly guards against missing state. No critical vulnerabilities were found, but there are several hardening opportunities around unsafe type casts on IPC event payloads, missing input bounds checks on resize dimensions, unbounded workspace/pane creation on the frontend, and terminal resource leaks in error paths.

## Must Fix

- `src/store/workspace.ts:492` — `event.payload as string` is an unsafe cast on data arriving from the Tauri event bus. If the backend ever emits a non-string payload (or a malicious webview message is injected), this silently coerces the value and feeds it into `findPaneByTerminalId`, which could cause unexpected behavior. The same pattern repeats at line 504. Validate that `event.payload` is actually a `string` before using it (e.g., `if (typeof event.payload !== 'string') return;`).

- `src/store/workspace.ts:396-420` — `initPane` has a TOCTOU (time-of-check-time-of-use) race. The guard `if (get().paneTerminals[paneId]?.terminalId) return;` checks state, then awaits `invoke("create_terminal")`. If two callers invoke `initPane` for the same paneId concurrently (e.g., `splitPane` fires `initPane` asynchronously at line 324, and `initWorkspace` iterates panes at line 483), both can pass the guard before either sets the terminalId, resulting in two backend terminals allocated but only the second stored in state — leaking the first terminal process. Add a synchronization mechanism (e.g., a `Set<string>` of in-flight pane IDs checked/set synchronously before the `await`).

## Suggestions

- `src/store/workspace.ts:444` — `resizePane` passes `cols` and `rows` directly to `invoke("resize_terminal")` without any frontend bounds validation. While the Rust backend accepts `u16`, passing zero or extremely large values (e.g., 65535 columns) could cause excessive memory allocation in the terminal grid emulator. Add reasonable upper-bound checks on the frontend (e.g., cols and rows each capped at 500 or a similar practical limit) in addition to the existing `cols > 0 && rows > 0` check in Terminal.tsx line 155.

- `src/store/workspace.ts:121-143` — `createWorkspace` has no limit on how many workspaces can be created on the frontend. While the Rust backend caps terminals at 16, the frontend can create unlimited workspace/pane metadata objects. A user or automated script calling `createWorkspace` in a loop could exhaust browser memory. Consider adding a frontend workspace limit constant.

- `src/store/workspace.ts:261` — `reorderWorkspaces` blindly replaces `openWorkspaceIds` with whatever array is passed in, with no validation that the IDs correspond to actual workspaces. Passing fabricated or stale IDs would desync `openWorkspaceIds` from `workspaces`, causing downstream lookups to fail silently. Validate that every ID in the array exists in `workspaces` before applying.

- `src/store/workspace.ts:408-419` — When `initPane` catches an error from `create_terminal`, it stores the raw error in `error: \`Failed to create terminal: ${e}\``. If the Rust backend returns detailed system information in error messages (file paths, OS details), this gets exposed in the UI. Consider sanitizing or generalizing error messages shown to the user.

- `src/App.tsx:25` — `init().catch(console.error)` swallows initialization failures. If `createWorkspace`, `subscribeToEvents`, or `initWorkspace` throws, the user sees "Terminal disconnected" with no actionable information and no retry mechanism. Consider surfacing the error to the workspace store's error state for display.

- `src/App.tsx:27-29` — The cleanup function calls `unsubscribe?.()` but does not destroy terminals. The old `terminal.ts` store called `destroyTerminal()` on cleanup. While the Tauri backend will presumably clean up when the app exits, if this component unmounts/remounts (e.g., in React StrictMode dev), orphaned terminal processes could accumulate until hitting the MAX_TERMINALS limit.

## Nitpicks

- `src/store/workspace.ts:285` — `setActivePane` sets `activePaneId` to any string without verifying the pane actually exists in any workspace. While not exploitable, it creates an inconsistent state where `activePaneId` references a nonexistent pane.

- `src/store/workspace.ts:629` — `generateId()` uses `crypto.randomUUID()` which is fine for non-security-critical identifiers. Just noting this is appropriate usage — UUIDs here are opaque handles, not security tokens.

- `src/store/__tests__/workspace.test.ts:6` — The mock for `invoke` returns the same `"mock-terminal-id"` for every `create_terminal` call. This means tests cannot catch the duplicate-terminal-per-pane race condition described above since all panes appear to share the same terminal ID. Consider returning unique IDs per call.

- `src/components/Terminal.tsx:195` — `clipboardData.getData("text/plain")` extracts only plain text, which is correct and avoids HTML/rich-text injection. Good practice.
