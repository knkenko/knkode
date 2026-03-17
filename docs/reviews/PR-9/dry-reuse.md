# DRY / Reuse Analysis -- PR #9 (IPC Adapter Layer)

## Summary

The PR introduces two new files (`src/shared/types.ts`, `src/lib/tauri-api.ts`) and light modifications to `src/main.tsx` and `src/vite-env.d.ts`. Since the `main` branch has only 4 minimal files in `src/`, there is no existing logic to duplicate against. The primary DRY concern is the event listener pattern in `tauri-api.ts`, which is copy-pasted 5 times with only the event name, payload type, and callback extraction differing.

## Must Fix

None

## Suggestions

- `src/lib/tauri-api.ts:38-98` -- The 5 event listener methods (`onTerminalRender`, `onPtyExit`, `onPtyCwdChanged`, `onPtyBranchChanged`, `onPtyPrChanged`) share an identical 10-line pattern: declare `unlisten: UnlistenFn | null`, call `listen<T>(eventName, ...)`, store the unlisten fn via `.then()`, return a synchronous teardown closure. A generic helper like `function tauriEvent<T>(event: string, transform: (payload: T) => Parameters<typeof cb>): Unsubscribe` would reduce each listener to a one-liner and centralize the unlisten lifecycle (including the subtle race condition where `unlisten` is called before the `.then()` resolves -- currently silently dropped). This also makes the pattern testable in isolation.

- `src/lib/tauri-api.ts:38-48` (and all 5 listeners) -- There is a race condition: if the returned unsubscribe function is called before `listen()` resolves its promise, `unlisten` is still `null` and the `unlisten?.()` no-ops, leaving the Tauri listener permanently active. A helper could fix this once by queuing the teardown, e.g., storing a `pending = true` flag and calling `unlisten` inside the `.then()` when pending.

## Nitpicks

- `src/shared/types.ts:223` -- The `Unsubscribe` type alias is defined locally but is not exported. If other files need this type (e.g., hooks wrapping these subscriptions), it will need to be re-declared. Consider exporting it preemptively since the `KnkodeApi` interface that uses it is exported.
