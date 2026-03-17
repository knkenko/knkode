# PR #9 TypeScript Review — IPC Adapter Layer

## Summary

The PR introduces a well-structured IPC adapter (`tauri-api.ts`) that implements a `KnkodeApi` interface, bridging Tauri's `invoke`/`listen` to the existing `window.api` contract from v1. Type definitions in `shared/types.ts` are thorough, with strong readonly usage and `as const` tuple patterns. The main concern is a race condition in the event listener pattern where unsubscribe can be called before the listener is registered, silently dropping the cleanup.

## Must Fix

- `src/lib/tauri-api.ts:38-48` (and identical pattern at lines 52-62, 64-74, 76-86, 88-98): **Race condition in async listener teardown.** The `listen()` call returns a `Promise<UnlistenFn>`, but the returned synchronous unsubscribe closure captures `unlisten` which is `null` until the promise resolves. If a React `useEffect` cleanup fires before `listen()` resolves (fast unmount, StrictMode double-mount), `unlisten` is still `null` and the listener is **never removed**, causing a memory leak and phantom event handlers. Fix: track a `disposed` flag and call the unlisten function as soon as it resolves if disposal was already requested. Example pattern:
  ```ts
  onTerminalRender: (cb) => {
      let unlisten: UnlistenFn | null = null;
      let disposed = false;
      listen<{ id: string; grid: GridSnapshot }>("terminal:render", (e) =>
          cb(e.payload.id, e.payload.grid),
      ).then((fn) => {
          if (disposed) fn();
          else unlisten = fn;
      });
      return () => {
          disposed = true;
          unlisten?.();
      };
  },
  ```

- `src/lib/tauri-api.ts:18`: **Silently swallowed errors.** `invoke("log_scroll_debug", { event }).catch(() => {})` discards all errors including unexpected ones (serialization failures, command-not-found). The interface declares `logScrollDebug` as `void` (not `Promise<void>`), which is fine for fire-and-forget, but the empty catch should at minimum log to `console.warn` in development so failures are diagnosable. This is the only fire-and-forget invoke in the adapter; all others return the promise to the caller, creating an inconsistency.

## Suggestions

- `src/shared/types.ts:75-116`: **`PaneTheme` properties lack `readonly`.** Every other data interface in this file (`AnsiColors`, `PaneConfig`, `LayoutLeaf`, `LayoutBranch`, `Workspace`, `AppState`, `Snippet`, `PrInfo`, `ScrollDebugEvent`, `CellSnapshot`, `GridSnapshot`) marks all properties `readonly`. `PaneTheme` does not mark any property as `readonly`. With `exactOptionalPropertyTypes: true` enabled in `tsconfig.json`, this interface will still allow direct mutation. For consistency and to match the project's immutable-data conventions, consider making all `PaneTheme` properties `readonly`.

- `src/shared/types.ts:211-219`: **`GridSnapshot` uses `snake_case` property names** (`cursor_row`, `cursor_col`, `cursor_visible`, `total_rows`, `scrollback_rows`) while every other TypeScript interface uses `camelCase`. This is presumably because Rust's `serde` serializes struct fields as snake_case by default. This is pragmatic, but consider either: (a) adding a TSDoc comment on the interface noting the Rust serialization origin to prevent future "cleanup" PRs from renaming them, or (b) using `serde(rename_all = "camelCase")` on the Rust side for a consistent frontend convention. The existing TSDoc partially explains this but does not call out the naming convention.

- `src/shared/types.ts:7`: **`1 as const` is redundant.** `DEFAULT_PANE_OPACITY = 1 as const` narrows the type to the literal `1`, but a numeric literal `1` assigned to a `const` declaration is already inferred as literal type `1` by TypeScript. The `as const` assertion has no effect here (unlike the array/object cases on lines 11, 15, 27 where it is necessary). Removing it would reduce noise.

- `src/shared/types.ts:223`: **`Unsubscribe` type is module-private.** The `type Unsubscribe = () => void` is not exported, but it is used in the public `KnkodeApi` interface. This means consumers who want to type a variable holding the return value of e.g. `api.onPtyExit(...)` cannot reference the `Unsubscribe` type by name and must write `() => void` or `ReturnType<KnkodeApi['onPtyExit']>`. Exporting `Unsubscribe` would improve ergonomics.

- `src/vite-env.d.ts:3`: **`import` in a `.d.ts` global augmentation file.** Using a top-level `import` statement converts this file into a module, which means the `declare global` block is required (and used correctly here). This works, but is a pattern that can confuse contributors -- if someone removes the `import` and uses an inline `import()` type instead, the `declare global` wrapper becomes unnecessary and behavior changes. A brief comment explaining why the import is there and why `declare global` is needed would prevent accidental breakage.

- `src/lib/tauri-api.ts` (general): **Event name strings are not type-safe.** The event names (`"terminal:render"`, `"pty:exit"`, `"pty:cwd-changed"`, `"pty:branch-changed"`, `"pty:pr-changed"`) are raw string literals. Consider defining them as a const enum or a `const` object (e.g., `const IPC_EVENTS = { ... } as const`) to centralize them and prevent typo-induced silent failures.

## Nitpicks

- `src/shared/types.ts:22-27`: **Dual `as const` assertion on `EFFECT_MULTIPLIERS`.** The object is typed as `Record<EffectLevel, number>` and then asserted `as const`. The `Record<EffectLevel, number>` annotation widens the value types to `number`, so the `as const` has no narrowing effect on the values (they remain `number`, not `0 | 0.4 | 0.7 | 1.0`). If literal value types are desired, use `satisfies Record<EffectLevel, number>` instead of the type annotation (TypeScript 4.9+). If literal types are not needed, remove the `as const`.

- `src/shared/types.ts:157`: **`panes: Record<string, PaneConfig>` loses key safety.** With `noUncheckedIndexedAccess: true` (enabled in tsconfig), accessing `workspace.panes[someId]` returns `PaneConfig | undefined`, which is correct. However, `Record<string, PaneConfig>` also accepts any string key for writes. If pane IDs follow a pattern, a branded type (`type PaneId = string & { __brand: 'PaneId' }`) or template literal type could add safety.

- `src/main.tsx:7`: **Global mutation at import time.** `window.api = api` executes as a side effect at module import. This is intentional for the v1-compatibility shim, but it means the module cannot be imported in a test environment without polluting the global. This is acceptable as a conscious trade-off given the v1 migration strategy, but worth noting for future testability.
