# PR-6 Efficiency Review: `feature/workspace-store`

## Summary

The workspace store introduces a multi-pane terminal architecture that is structurally sound, but has two meaningful efficiency issues: sequential pane initialization that blocks startup, and a linear scan on every terminal-output event that will degrade with pane count. Several `set()` calls also spread the entire `paneTerminals` map on every update, producing unnecessary shallow copies.

## Must Fix

- **`src/store/workspace.ts:478-485` — Sequential pane initialization blocks startup.** `initWorkspace` awaits each `initPane` call in a serial `for` loop. Each call issues `create_terminal` + `get_terminal_state` over IPC. With a 2-column or 4-pane preset, startup latency is multiplied by pane count. These pane inits are independent and should run with `Promise.all`.

- **`src/store/workspace.ts:102-108` — `findPaneByTerminalId` is O(n) on every terminal-output event.** This linear scan over `Object.entries(paneTerminals)` fires on every `terminal-output` event — the highest-frequency event in the store. With many panes, this degrades. Maintain a reverse lookup map (`terminalId -> paneId`) that is updated in `initPane`, `closePane`, and the exit handler, reducing this to O(1).

## Suggestions

- **`src/store/workspace.ts:459-470` (and lines 401-406, 429-440, 509-520) — Spreading the entire `paneTerminals` record on every single-pane update.** Every `refreshPaneGrid`, `writeToPane` error path, `initPane`, and `terminal-exit` handler does `{ ...state.paneTerminals, [paneId]: { ... } }`, creating a new shallow copy of the entire map. With many panes and high-frequency refreshes, this generates significant GC pressure. Consider a nested/sliced state structure (e.g., Zustand's `immer` middleware or a `Map`) so that updating one pane's grid does not copy all pane entries.

- **`src/store/workspace.ts:187-242` — `removeWorkspace` calls `get()` 9 times within a single synchronous function.** Lines 188, 195, 200, 201, 202, 208, 209, 212, 222 each call `get()` separately. While `get()` is cheap in Zustand, destructuring once at the top is cleaner and avoids any risk of reading inconsistent intermediate states if the function were ever made async.

- **`src/store/workspace.ts:357-368` — `closePane` uses `get().workspaces` inside `set()` instead of the `set(state => ...)` updater form.** Line 359 reads `get().workspaces` while constructing the object passed to `set({...})`. This is a subtle TOCTOU: if another update races (e.g., an async terminal exit event), the stale snapshot from `get()` will overwrite the concurrent update. Use the updater form `set((state) => ...)` for the entire mutation, as is done elsewhere in the file.

- **`src/App.tsx:7-9` — Inline selector creates a new closure on every render, defeating Zustand's referential equality check.** The selector `(s) => activePaneId ? s.paneTerminals[activePaneId] : undefined` closes over `activePaneId`, so Zustand creates a new subscription function on each render. This means the component re-renders on every store change, not just when `paneTerminals[activePaneId]` changes. Extract a stable selector with `useShallow` or derive `connected`/`error` directly with primitive selectors.

- **`src/App.tsx:27-29` — Cleanup function does not destroy terminals on unmount.** The old `terminal.ts` store called `destroyTerminal()` in the cleanup. The new code only calls `unsubscribe?.()`, leaving orphaned terminal processes in the backend. While not strictly an efficiency issue in the hot-path sense, leaked OS processes are a resource leak.

## Nitpicks

- **`src/store/workspace.ts:140` — `new Set([...state.visitedWorkspaceIds, id])` on every `createWorkspace` / `duplicateWorkspace` / `setActiveWorkspace`.** Spreading a `Set` into an array and back into a `Set` is O(n). A `Set` stored in Zustand state also defeats Zustand's `Object.is` equality — every update creates a new `Set` reference, causing any selector that reads `visitedWorkspaceIds` to always re-render. Consider a plain `Record<string, true>` instead, or keep the `Set` outside the store since it is only read internally.

- **`src/store/workspace.ts:434-436` — Verbose null-coalescing in `writeToPane` error handler.** The spread `...state.paneTerminals[paneId]` already carries all fields, then lines 434-436 re-declare `terminalId`, `grid` with `?? null` / `?? false` fallbacks. These are only needed if the entry could be undefined, but the function already checked `terminalId` on line 424. The same pattern appears in `refreshPaneGrid` (lines 463-466) and the exit handler (lines 513-515).
