# Type Design Review -- PR #9 (IPC Adapter Layer)

## Summary

The new types are well-structured for an IPC adapter boundary: `KnkodeApi` provides a clean seam between frontend and Tauri, `GridSnapshot`/`CellSnapshot` express the terminal rendering contract clearly, and domain types like `LayoutNode` use discriminated unions effectively. The main weaknesses are (1) a race condition in the event-listener unsubscribe pattern that can silently leak listeners, (2) `PaneTheme` carrying too many unguarded numeric ranges as plain `number`, and (3) a naming convention mismatch (`snake_case` in `GridSnapshot` vs `camelCase` everywhere else) that will propagate confusion.

## Must Fix

- `src/lib/tauri-api.ts:38-48` (and lines 52-62, 64-74, 76-86, 88-98) -- **Race: unsubscribe called before listener is registered drops the call silently.** `listen()` is async; the returned `Unsubscribe` closure captures `unlisten` which is `null` until the promise resolves. If consumer code calls `unsubscribe()` synchronously (e.g., React `useEffect` cleanup on a fast unmount), `unlisten?.()` is a no-op and the Tauri listener is never removed, leaking memory and firing stale callbacks. This is the same pattern repeated five times. Fix: queue the teardown so that if `unsubscribe()` is called before `listen` resolves, the `UnlistenFn` is invoked as soon as it becomes available. A minimal fix:
  ```ts
  onTerminalRender: (cb) => {
    let unlisten: UnlistenFn | null = null;
    let disposed = false;
    listen<...>("terminal:render", (e) => cb(...)).then((fn) => {
      if (disposed) fn();   // was already torn down while we waited
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  },
  ```
- `src/shared/types.ts:211-219` -- **Naming convention mismatch in `GridSnapshot`.** Fields use `snake_case` (`cursor_row`, `cursor_col`, `cursor_visible`, `total_rows`, `scrollback_rows`) while every other type in this file uses `camelCase`. Since this type is the serialization boundary with Rust (serde defaults to snake_case), the mismatch is understandable, but it creates two problems: (a) consumers must remember which convention to use when accessing grid fields vs. every other field, and (b) it signals that the Rust struct's naming leaks into the frontend contract. Fix: either add `#[serde(rename_all = "camelCase")]` on the Rust struct when it is implemented, or define an explicit mapping layer in `tauri-api.ts` that converts to `cursorRow`, `cursorCol`, etc. before exposing to the frontend. Decide now and document the convention -- do not let both conventions coexist long-term.

## Suggestions

- `src/shared/types.ts:75-116` -- **`PaneTheme` has many `number` fields whose valid ranges are documented only in JSDoc comments.** `fontSize`, `unfocusedDim`, `scrollback`, `paneOpacity`, and `lineHeight` all have min/max constants defined but no compile-time or runtime enforcement at the type level. Consider branded numeric types (e.g., `type Opacity = number & { __brand: 'Opacity' }`) with factory functions that clamp/validate, or at minimum a single `validatePaneTheme()` function that callers can use at construction boundaries. This is lower priority than the race fix but would prevent a class of subtle UI bugs.
- `src/shared/types.ts:75-116` -- **`PaneTheme` fields are not `readonly`.** Every other interface in this file marks fields `readonly`, but `PaneTheme` does not. This means any code holding a `PaneTheme` reference can mutate it in place, bypassing whatever validation the UI layer applies. If mutability is intentional (e.g., for form state), document it; otherwise add `readonly` for consistency.
- `src/shared/types.ts:151-158` -- **`Workspace.panes` uses `Record<string, PaneConfig>` which permits arbitrary string keys.** The keys are pane IDs, but nothing ties them to the IDs referenced in `LayoutLeaf.paneId`. A workspace could have a layout referencing pane IDs not present in `panes`, or vice versa. This is a cross-field invariant that the type cannot enforce alone, but a `validateWorkspace()` function that checks `panes` keys match all `paneId` values in the layout tree would catch common bugs early.
- `src/shared/types.ts:223` -- **`Unsubscribe` is a module-private type alias.** It is used in the `KnkodeApi` interface methods but not exported. Consumers who want to store or pass around unsubscribe handles must redeclare `() => void` themselves. Consider exporting `Unsubscribe` so consumers can reference it by name.
- `src/shared/types.ts:199-207` -- **`CellSnapshot.text` is typed as `string` with no guidance on expected length.** A terminal cell is typically one character (or a grapheme cluster for wide/emoji characters). Documenting whether `text` can be empty (for trailing cells of wide characters) or multi-codepoint would help frontend renderer authors avoid off-by-one bugs.
- `src/lib/tauri-api.ts:17-19` -- **`logScrollDebug` swallows errors silently with `.catch(() => {})`.** This is likely intentional for a debug logging call, but even debug channels benefit from at least a `console.warn` in development. Consider `catch((e) => { if (import.meta.env.DEV) console.warn('logScrollDebug failed', e); })`.

## Nitpicks

- `src/shared/types.ts:7` -- `DEFAULT_PANE_OPACITY = 1 as const` -- The `as const` is redundant on a numeric literal assignment to a `const` variable. `const DEFAULT_PANE_OPACITY = 1;` already narrows to the literal type `1`. Not harmful, but inconsistent with the other constants in the file that don't use `as const`.
- `src/shared/types.ts:196` -- The section comment `// --- v2 additions: terminal grid rendering ---` is useful now but will become noise once v2 is the only version. Consider removing version-relative comments before the codebase matures.
- `src/shared/types.ts:147-149` -- `WorkspaceLayout` discriminated union members are anonymous object types. Extracting them as named interfaces (`PresetLayout`, `CustomLayout`) would improve readability in error messages and make them individually importable, though this is minor.
- `src/vite-env.d.ts:7` -- `Window.api` is declared as non-optional, meaning `window.api` will typecheck as always present. If there is any code path where the script runs before `window.api` is assigned (e.g., module-level side effects, tests), this could mask runtime errors. Consider `api?: KnkodeApi` if there is any such risk.
