# Code Review: PR #9 -- IPC Adapter Layer + Shared Types (Phase 2)

## Summary

Solid foundational PR that establishes the IPC adapter pattern (`tauri-api.ts`) and shared type definitions for the Tauri v2 migration. Types are comprehensive, well-documented, and the adapter correctly maps Tauri `invoke()`/`listen()` to the `window.api` interface. One bug-class issue with event listener cleanup and one naming convention concern.

## Must Fix

- **`src/lib/tauri-api.ts:38-48` (and lines 52-62, 64-74, 76-86, 88-98)** -- Race condition in all five `on*` event listener methods. If the returned unsubscribe function is called before the `listen()` Promise resolves, `unlisten` is still `null` and the Tauri event listener is never removed, causing a memory/event leak. This is a real issue in React StrictMode (double mount/unmount in dev) and fast workspace switching. Fix: track a `disposed` flag and call `unlisten` inside the `.then()` if disposal was requested before resolution. Example:
  ```ts
  onTerminalRender: (cb) => {
    let unlisten: UnlistenFn | null = null;
    let disposed = false;
    listen<{ id: string; grid: GridSnapshot }>("terminal:render", (e) =>
      cb(e.payload.id, e.payload.grid),
    ).then((fn) => {
      if (disposed) {
        fn();
      } else {
        unlisten = fn;
      }
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  },
  ```
  Apply the same pattern to all five listener methods. **(Confidence: 90)**

## Suggestions

- **`src/shared/types.ts:213-218`** -- `GridSnapshot` uses snake_case field names (`cursor_row`, `cursor_col`, `cursor_visible`, `total_rows`, `scrollback_rows`) while every other TypeScript interface in this file uses camelCase. This will propagate to all canvas renderer and store code that consumes the grid. The standard approach is to add `#[serde(rename_all = "camelCase")]` to the future Rust struct so the serialized JSON arrives in camelCase, or transform in the adapter. Since the Rust struct does not exist yet, now is the ideal time to define the TypeScript interface with camelCase (`cursorRow`, `cursorCol`, `cursorVisible`, `totalRows`, `scrollbackRows`) and match it when implementing the Rust side. **(Confidence: 82)**

## Nitpicks

None
