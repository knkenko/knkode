# Silent Failure Audit: PR #9 (IPC Adapter Layer)

## Summary

The IPC adapter in `src/lib/tauri-api.ts` contains one explicitly swallowed error (`.catch(() => {})`) and five event listener registrations whose `listen()` promises have no `.catch()` handler at all, meaning listener setup failures will produce unhandled promise rejections with no user feedback. The race condition between the synchronous unsubscribe return and the async listener setup also means early unsubscribe calls silently do nothing.

## Must Fix

- **`src/lib/tauri-api.ts:18`** -- `.catch(() => {})` is an empty catch that unconditionally swallows every error from the `log_scroll_debug` IPC call. If the Rust command does not exist, is misspelled, or throws a serialization error, developers will never know. This violates the project rule against silent failures. The empty arrow function discards the error object entirely -- no logging, no console output, nothing. Hidden errors include: command-not-found (typo in command name), serialization failures (malformed event payload), Tauri runtime errors, and permission errors. At minimum, log the error with `console.warn` so developers can see scroll debug is broken. If this is intentionally fire-and-forget, add a comment explaining why AND still log at debug level.

- **`src/lib/tauri-api.ts:40-44`** -- The `listen()` promise in `onTerminalRender` has `.then()` but no `.catch()`. If `listen()` rejects (e.g., event system not initialized, invalid event name, Tauri runtime not ready), the promise rejection goes completely unhandled. The user's terminal render callback will never fire, and there will be zero indication why the terminal is blank. The same pattern repeats at lines 54-58 (`onPtyExit`), 66-70 (`onPtyCwdChanged`), 78-82 (`onPtyBranchChanged`), and 90-94 (`onPtyPrChanged`). That is five listener registrations, all with the same unhandled rejection problem. Each one must have a `.catch()` that at minimum logs the failure so developers can diagnose why events are not arriving.

## Suggestions

- **`src/lib/tauri-api.ts:38-48` (and lines 52-62, 64-74, 76-86, 88-98)** -- The synchronous-unsubscribe-over-async-listen pattern has a race condition. If the returned unsubscribe function is called before the `listen()` promise resolves, `unlisten` is still `null` and the optional chain (`unlisten?.()`) silently does nothing. The listener stays active, leaking a subscription. This is a silent failure by design -- the caller thinks they unsubscribed but the listener keeps firing. Consider returning the `listen()` promise directly, or queuing the unsubscribe request so it executes once the promise resolves. For example:

  ```typescript
  onTerminalRender: (cb) => {
    let cancelled = false;
    const p = listen<{ id: string; grid: GridSnapshot }>("terminal:render", (e) =>
      cb(e.payload.id, e.payload.grid),
    );
    p.catch((err) => console.error("[tauri-api] Failed to listen terminal:render", err));
    return () => {
      cancelled = true;
      p.then((fn) => fn());
    };
  },
  ```

  This ensures the unsubscribe always executes, even if called before the promise resolves, and the `.catch()` surfaces registration failures.

- **`src/lib/tauri-api.ts:15-16`** -- `getHomeDir` and `openExternal` propagate errors to the caller via the returned promise, which is correct. However, neither has any local error handling. If callers forget to `.catch()` these, they will produce unhandled rejections. Consider whether a top-level error boundary or global unhandled-rejection handler exists for these. This is not a bug in this file, but worth confirming the callers handle rejections.

- **`src/lib/tauri-api.ts:22-28`** -- The config methods (`getWorkspaces`, `saveWorkspace`, `deleteWorkspace`, `getAppState`, `saveAppState`, `getSnippets`, `saveSnippets`) all return raw `invoke()` promises with no error wrapping. If Tauri returns a cryptic Rust-level error string, it will reach the UI layer unmodified. Consider wrapping these in an adapter that catches IPC errors and re-throws with user-friendly messages, or at least adds context like "Failed to load workspaces: <original error>".

## Nitpicks

- **`src/lib/tauri-api.ts:18`** -- Even if `logScrollDebug` is intentionally fire-and-forget, the pattern `.catch(() => {})` is a code smell that will trip linters and future reviewers. A named no-op like `.catch(noop)` with a comment, or better yet `.catch((e) => console.debug("[scroll-debug] IPC failed:", e))`, would signal intent without hiding problems.

- **`src/shared/types.ts:229`** -- `logScrollDebug` is typed as returning `void` (not `Promise<void>`), which is accurate for the fire-and-forget implementation. However, this means callers cannot `.catch()` it even if they wanted to. If the intent changes to surface errors, the interface signature must change too.

- **`src/main.tsx:7`** -- `window.api = api` has no guard against being called in a non-Tauri context (e.g., during SSR or testing). If `invoke` or `listen` from `@tauri-apps/api` throw on import because `window.__TAURI_INTERNALS__` is missing, the entire app will fail to load with an opaque error. This is not directly a silent failure, but it is a missing error boundary at the application entry point.
