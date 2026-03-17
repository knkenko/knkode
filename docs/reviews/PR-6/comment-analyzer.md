# PR-6 Comment Quality Review

## Summary

The workspace store introduces well-structured section comments and accurate inline comments throughout. Most comments correctly describe the code they annotate. There are no critical inaccuracies, but there is one slightly misleading JSDoc comment in the test helper, one missing comment where important ordering logic was removed, and a few minor improvement opportunities.

## Must Fix

None

## Suggestions

- `src/store/__tests__/workspace.test.ts:23` -- The JSDoc `/** Get activePaneId with a preceding assertion so Biome doesn't require non-null assertions. */` is grammatically ambiguous. It can be read as "Biome has a setting that doesn't require non-null assertions" rather than the intended meaning. Suggested rewrite: `/** Get activePaneId, throwing if null -- avoids non-null assertions that Biome would flag. */`

- `src/App.tsx:19-22` -- The old code had a comment `// Subscribe before first refresh to avoid missing events during startup` explaining the critical ordering of `subscribeToEvents` before `refreshGrid`. The new init sequence (`createWorkspace` -> `subscribeToEvents` -> `initWorkspace`) still has an important ordering constraint: events must be subscribed before `initWorkspace` creates terminals, otherwise output events fired between terminal creation and subscription would be lost. A brief comment explaining this ordering would preserve institutional knowledge. Suggested: `// Subscribe before initializing panes to avoid missing terminal output events`

- `src/store/workspace.ts:100` -- The `pendingRefreshPanes` set is an important concurrency mechanism (rAF-based coalescing per pane) but has no comment explaining its purpose. The old terminal store had a similar `refreshPending` boolean also without a comment. Now that this has been upgraded to a per-pane Set, it would benefit from a brief explanation like `// Coalesces rapid terminal-output events into one rAF refresh per pane`

- `src/store/workspace.ts:102-108` -- The closure-scoped `findPaneByTerminalId` function performs a reverse lookup (terminal ID -> pane ID) but has no comment explaining why it exists or when it is needed. A brief comment like `// Reverse lookup: events arrive with terminalId, but store is keyed by paneId` would help future readers understand the design constraint.

- `src/store/workspace.ts:478-486` -- The `initWorkspace` function initializes panes sequentially with `for...of` + `await`. There is no comment explaining whether this sequential initialization is intentional (e.g., to avoid overwhelming the backend with concurrent terminal creation) or an oversight. If intentional, a comment like `// Initialize panes sequentially to avoid concurrent IPC create_terminal calls` would prevent a future contributor from "optimizing" this to `Promise.all`.

## Nitpicks

- `src/store/__tests__/workspace.test.ts:121` and `src/store/__tests__/workspace.test.ts:126-127` -- Two comments say essentially the same thing: `// After removing, a new default workspace is auto-created` (line 121) and `// Auto-creates a new workspace when last one is removed` (line 127). One of them is redundant. Consider keeping only the one on line 121 since it provides context before the action, and removing line 127 since the assertion (`toHaveLength(1)`) already makes the behavior clear.

- `src/store/workspace.ts:46,55,111,119,265,289,394,476,488` -- The section divider comments (`// -- Per-pane terminal state --`, `// -- Store shape --`, etc.) are used consistently and serve as useful navigation anchors in a 529-line file. These are well done and should be maintained as the file grows.

- `src/store/workspace.ts:67-94` -- The interface `WorkspaceStoreActions` uses inline section comments (`// Workspace CRUD`, `// Navigation`, etc.) that mirror the section dividers in the implementation. This parallel structure is good for navigability but means comments must be kept in sync in two places. This is acceptable given the file is self-contained.
