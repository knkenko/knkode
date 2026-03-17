# PR #9 Comment Quality Review

## Summary

PR #9 introduces shared types (`src/shared/types.ts`), a Tauri IPC adapter (`src/lib/tauri-api.ts`), a global `window.api` binding (`src/main.tsx`), and a Window type augmentation (`src/vite-env.d.ts`). Overall comment quality is good -- JSDoc comments on types are thorough and the inline comments in tauri-api.ts explain non-obvious async patterns well. However, there are a few accuracy issues, a dangling reference, and a version-stamped section marker that will age poorly.

## Must Fix

- **`src/shared/types.ts:112`** -- The JSDoc `/** Theme preset name -- links to THEME_PRESETS for full identity. */` references `THEME_PRESETS`, but no such constant exists anywhere in the codebase. This is a dangling reference that will confuse future maintainers searching for the constant. Either define `THEME_PRESETS` or rewrite to: `/** Theme preset name. Identifies which built-in theme this config was derived from. */`

- **`src/shared/types.ts:196`** -- The section divider `// --- v2 additions: terminal grid rendering ---` uses version-specific labeling ("v2") that will become meaningless as the codebase evolves. All code in this repo is v2; the label provides no useful context. Rewrite to something durable like `// --- Terminal grid rendering ---` or remove the section comment entirely, since the types are self-documenting.

- **`src/shared/types.ts:246`** and **`src/lib/tauri-api.ts:36-37`** -- Both comments reference `onPtyData` as something this code "replaces." Since `onPtyData` never existed in the v2 codebase, this is migration-era context that will confuse anyone who only knows v2. These comments should explain what the current code does, not what a different codebase used to do. Suggestion: `// Terminal grid events -- Rust processes PTY data via wezterm-term, sends rendered grid snapshots` (drop the "REPLACES" language).

## Suggestions

- **`src/lib/tauri-api.ts:50-51`** -- The comment `// PTY lifecycle events -- Tauri listen() returns Promise<UnlistenFn>. / We need synchronous unsubscribe, so we store the unlisten fn once resolved.` is excellent for `onPtyExit` but the same pattern is used identically by `onTerminalRender` (line 38), `onPtyCwdChanged` (line 64), `onPtyBranchChanged` (line 76), and `onPtyPrChanged` (line 88). The comment only appears on `onPtyExit`, creating an inconsistency. Consider moving this explanation to a single block comment above `onTerminalRender` (the first method using the pattern), so it covers all event subscriptions. This also avoids duplicating the comment five times.

- **`src/lib/tauri-api.ts:36-51`** -- The async listen pattern has a subtle race condition: if the caller invokes the returned unsubscribe function before the `listen()` Promise resolves, `unlisten` is still `null` and the listener leaks. The comment does not mention this. For a production IPC adapter, consider documenting this known limitation, e.g., `// Note: unsubscribe is no-op if called before listen() resolves (listener will leak).`

- **`src/shared/types.ts:209-210`** -- The JSDoc on `GridSnapshot` says "emitted by Rust via `terminal:render` event." This is accurate per the project design, but the Rust backend emitting this event does not yet exist in the codebase (no `terminal:render` emission in `src-tauri/`). The comment reads as a statement of current behavior. Consider adding "will be" or "designed to be" to signal this is a forward-looking contract until the Rust side is implemented.

- **`src/shared/types.ts:198`** -- The JSDoc `/** A single cell in the terminal grid, serialized from Rust (wezterm-term). */` similarly describes Rust-side serialization that does not yet exist. Same suggestion: flag it as the intended contract.

- **`src/shared/types.ts:1`** -- `/** Default unfocused pane dimming (moderate). */` -- the word "moderate" is subjective and will not age well. The value 0.3 speaks for itself. Consider: `/** Default unfocused pane dimming opacity. */`

- **`src/shared/types.ts:79`** -- `/** Black overlay opacity on unfocused panes. Clamped to [0, MAX_UNFOCUSED_DIM] by the UI. */` -- The comment says "Black overlay" but the type is just `number`. If the overlay is always black, this is useful implementation context. If it could change, the word "Black" becomes misleading. Verify the assumption is stable.

- **`src/shared/types.ts:221`** -- The section divider `// --- API interface (implemented by tauri-api.ts) ---` is good but will become stale if additional implementations are created (e.g., a mock for testing). Consider: `// --- API interface ---` and let the JSDoc or a README explain implementations.

## Nitpicks

- **`src/shared/types.ts:211-218`** -- `GridSnapshot` uses snake_case field names (`cursor_row`, `cursor_col`, `total_rows`, `scrollback_rows`) while every other TypeScript interface in the file uses camelCase. This is presumably intentional to match Rust/serde serialization, but there is no comment explaining the naming convention deviation. A one-line note like `// Field names match Rust serde serialization (snake_case)` would prevent a future contributor from "fixing" them to camelCase.

- **`src/shared/types.ts:14`** -- `// Ordered by intensity, low to high -- UI renders left-to-right in this order` -- Good comment explaining the non-obvious ordering contract. No change needed, but consider making it a JSDoc (`/** ... */`) so it appears in IDE tooltips for `EFFECT_LEVELS`.

- **`src/main.tsx:7`** -- `window.api = api;` has no comment explaining why the API is attached to the global window object. The PROJECT_DESCRIPTION.md explains this is for v1 compatibility, but a brief inline comment like `// Expose API globally for v1-compatible components that reference window.api` would help a reader who lands here without that context.

- **`src/vite-env.d.ts`** -- No comments at all. This is fine for a small type augmentation file, but a one-liner like `// Augment Window with the IPC API so window.api is type-safe` would help developers unfamiliar with the `declare global` pattern understand its purpose.

- **`src/lib/tauri-api.ts:18`** -- `invoke("log_scroll_debug", { event }).catch(() => {});` silently swallows errors. The empty catch has no comment explaining why errors are intentionally ignored. Consider: `// Fire-and-forget: scroll debug logging is non-critical, suppress errors`.
