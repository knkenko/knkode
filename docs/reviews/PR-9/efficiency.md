# Efficiency Review: PR #9 — IPC Adapter Layer

## Summary

The IPC adapter introduces a clean abstraction between the frontend and Tauri backend, but all five event listener functions (`onTerminalRender`, `onPtyExit`, `onPtyCwdChanged`, `onPtyBranchChanged`, `onPtyPrChanged`) share a race condition pattern where the synchronous unsubscribe returned to the caller can silently no-op if called before the async `listen()` promise resolves, causing **listener leaks**. The types file is pure declarations with no efficiency concerns.

## Must Fix

- **`src/lib/tauri-api.ts:38-48` (and identical pattern at lines 52-62, 64-74, 76-86, 88-98) — Event listener leak on early unsubscribe.** Each `on*` method returns a synchronous `() => void` unsubscribe function, but the `unlisten` variable is only populated after `listen()` resolves asynchronously. If the caller invokes the returned unsubscribe *before* the promise resolves (e.g., React `useEffect` cleanup fires during a fast mount/unmount cycle, common in StrictMode), `unlisten` is still `null` and the `unlisten?.()` call silently does nothing. The Tauri listener remains registered permanently. In a terminal app where panes are opened/closed frequently, this accumulates orphaned global event listeners that fire callbacks into stale closures. Fix: track whether unsubscribe was requested before resolution, and if so, call the unlisten function immediately upon resolution. Example pattern:
  ```ts
  onPtyExit: (cb) => {
    let unlisten: UnlistenFn | null = null;
    let disposed = false;
    listen<...>("pty:exit", (e) => cb(...)).then((fn) => {
      if (disposed) fn();  // already unsubscribed, clean up immediately
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  },
  ```

## Suggestions

- **`src/lib/tauri-api.ts:38-98` — Extract shared listener helper to eliminate duplication.** All five `on*` methods are structurally identical: call `listen()`, stash the unlisten fn, return a synchronous dispose. This is ~12 lines repeated 5 times. A single helper function (e.g., `listenSync<T>(event: string, handler: (payload: T) => void): Unsubscribe`) would reduce this to 5 one-liners, make the race-condition fix apply in one place, and reduce surface area for future bugs.

- **`src/lib/tauri-api.ts:17-19` — `logScrollDebug` swallows all errors.** The `.catch(() => {})` silently drops IPC failures. If the Rust command doesn't exist yet or errors, there is zero feedback. Consider at minimum logging to `console.warn` in development builds, or removing the catch entirely so unhandled promise rejections are visible during development.

- **`src/main.tsx:7` — `window.api` global assignment is eager.** The `api` object is created at module scope and assigned to `window.api` unconditionally. This is fine for the Tauri runtime but will throw during SSR or unit tests (where `@tauri-apps/api/core` is unavailable). Consider a lazy pattern or guard. Not urgent if test harnesses mock the import, but worth noting.

## Nitpicks

- **`src/shared/types.ts:212-218` — `GridSnapshot` uses `snake_case` field names** (`cursor_row`, `cursor_col`, `cursor_visible`, `total_rows`, `scrollback_rows`) while the rest of the codebase and Tauri event payloads in `tauri-api.ts` use `camelCase` (`exitCode`, `paneId`). This is presumably to match the Rust struct serialization (serde defaults to snake_case), but it creates an inconsistency at the TypeScript layer. Consider adding a `#[serde(rename_all = "camelCase")]` on the Rust side, or documenting why the mismatch is intentional.

- **`src/shared/types.ts:7` — `DEFAULT_PANE_OPACITY = 1 as const` uses `as const` unnecessarily.** The value `1` is already a numeric literal type. The `as const` assertion doesn't change the inferred type here (it would for arrays/objects, not primitives assigned to a `const` binding). Harmless but inconsistent with other constants in the file.
