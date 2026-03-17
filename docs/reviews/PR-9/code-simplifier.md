# PR #9 Code Simplification Review

## Summary

The IPC adapter layer is cleanly structured with a well-defined `KnkodeApi` interface and a single implementation in `tauri-api.ts`. The main simplification opportunity is extracting the repeated event listener pattern (5 near-identical blocks totaling ~50 lines) into a shared helper function, and fixing a naming convention inconsistency in `GridSnapshot`.

## Must Fix

- **`src/shared/types.ts:213-218`** — `GridSnapshot` uses snake_case field names (`cursor_row`, `cursor_col`, `cursor_visible`, `total_rows`, `scrollback_rows`) while every other interface in the file uses camelCase. The Rust backend has not defined this struct yet (no matches in `src-tauri/`), so there is no serialization constraint forcing snake_case. These should be `cursorRow`, `cursorCol`, `cursorVisible`, `totalRows`, `scrollbackRows` to match the project convention. Fixing this later after consumers exist will be a more invasive change.

## Suggestions

- **`src/lib/tauri-api.ts:38-98`** — The five event listener methods (`onTerminalRender`, `onPtyExit`, `onPtyCwdChanged`, `onPtyBranchChanged`, `onPtyPrChanged`) share an identical structural pattern: create a `let unlisten` variable, call `listen()`, store the result in `.then()`, return a cleanup closure. Extract a generic helper function to eliminate the repetition. For example:

  ```ts
  function createListener<T>(event: string, handler: (payload: T) => void): () => void {
    let unlisten: UnlistenFn | null = null;
    listen<T>(event, (e) => handler(e.payload)).then((fn) => {
      unlisten = fn;
    });
    return () => { unlisten?.(); };
  }
  ```

  Each method then becomes a one-liner that maps its payload fields to the callback. This reduces ~50 lines of copy-paste to ~10 lines of helper + 5 one-liners, and ensures that any future fix to the listen/unlisten lifecycle is applied once rather than five times.

- **`src/lib/tauri-api.ts:36-37`** — The comment "This REPLACES onPtyData" references a v1 concept that does not exist anywhere in this codebase. Similarly, line 50-51 explains the async-to-sync unlisten pattern but only needs to appear once (ideally on the helper function) rather than being partially repeated. After extracting the helper, a single JSDoc on that helper covers the rationale for all five listeners.

## Nitpicks

- **`src/shared/types.ts:196`** — The section divider comment `// --- v2 additions: terminal grid rendering ---` is unnecessary since this is a new file and everything in it is "v2". The comment carries forward v1 context that has no meaning to someone reading this file fresh. Same applies to `// --- API interface (implemented by tauri-api.ts) ---` on line 221 -- consider removing both or replacing with simpler section headers.
- **`src/shared/types.ts:7`** — `DEFAULT_PANE_OPACITY = 1 as const` uses `as const` on a numeric literal, which is redundant since the value `1` is already narrowed to the literal type `1` by `const`. The other constants in the file do not use `as const` on their scalar values, making this inconsistent.
- **`src/shared/types.ts:246`** — The comment `// Terminal render events (replaces onPtyData ...)` in the `KnkodeApi` interface is another v1 reference with no context in this codebase.
- **`src/vite-env.d.ts:3`** — The `import type` statement in a `.d.ts` ambient declaration file works but is unconventional. A `/// <reference path="..." />` or placing the augmentation in a dedicated `global.d.ts` would be more idiomatic, though this is minor.
