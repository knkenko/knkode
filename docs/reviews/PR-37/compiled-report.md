# Compiled Review — PR #37: feat: clickable URLs in terminal

**6 files reviewed, 10 agents ran** (code quality, security, silent failures, simplification, DRY/reuse, comments, types, efficiency, Rust, TypeScript)

## Must Fix (4 items)

1. **`src-tauri/src/terminal.rs:309` / `src/lib/tauri-api.ts:44-46` — Localhost URLs silently fail on click** [code-reviewer, silent-failure-hunter, dry-reuse, typescript-pro]
   Rust regex matches bare `localhost:3000` and `127.0.0.1:8080` without `http://` prefix, but `isAllowedUrl` requires `http(s)://`. Cmd+click on these links silently rejects. Fix: prepend `http://` to scheme-less matches in Rust `annotate_row_links`.

2. **`src/components/CanvasTerminal.tsx:718-722` — Dead `buildFont` call with unsafe `as CellSnapshot` cast** [type-design-analyzer, code-simplifier, typescript-pro]
   `{ bold: false, italic: false } as CellSnapshot` is a partial object bypassing type safety. The resulting `ctx.font` is immediately overwritten inside the loop. Remove entirely.

3. **`src-tauri/src/terminal.rs:733` — OSC 8 URIs forwarded without scheme validation** [security-auditor]
   `attrs.hyperlink().map(|h| h.uri().to_string())` passes arbitrary URIs from OSC 8 escape sequences. Filter to `http(s)://` at the Rust layer for defense-in-depth.

4. **`src-tauri/src/terminal.rs:332` — Doc comment references non-existent parameter** [comment-analyzer, code-simplifier]
   Comment says `cell_byte_offsets[i]` but the actual local variable is `cell_byte_starts`. Fix the comment.

## Suggestions (8 items)

1. **`src/components/CanvasTerminal.tsx` — Add `onMouseLeave={clearLinkHover}`** [code-reviewer, typescript-pro]
   Mouse exit with Cmd held leaves stale hover state until key release.

2. **`src/components/CanvasTerminal.tsx:1119,1298,1339` — Extract `isModKeyHeld` utility** [code-simplifier, dry-reuse]
   `isMac ? e.metaKey : e.ctrlKey` repeated 3 times. Extract to `src/utils/platform.ts`.

3. **`src-tauri/src/terminal.rs:349` — Rename `url_arc` to `url_string`** [rust-reviewer, code-simplifier, efficiency]
   Variable name implies `Arc<T>` but is a plain `String`.

4. **`src/components/CanvasTerminal.tsx:471-477` — Consolidate 4 link hover refs into one** [type-design-analyzer, code-simplifier, typescript-pro]
   Four separate refs for one conceptual state creates partial-update hazard.

5. **`src/components/CanvasTerminal.tsx:1125-1127` — No user feedback on openExternal failure** [silent-failure-hunter, security-auditor]
   Only logs to console. User sees highlighted link but nothing happens on failure.

6. **`src/components/CanvasTerminal.tsx:710-743` — Clear hover state on grid snapshot change** [typescript-pro, silent-failure-hunter]
   Stale hover refs may highlight wrong cells after terminal content changes.

7. **Security: No URL preview/tooltip on hover** [security-auditor]
   OSC 8 links can show deceptive text. Standard terminals show URL tooltip.

8. **`src-tauri/src/terminal.rs:335-340` — Reusable buffers for `row_text`/`cell_byte_starts`** [efficiency]
   Per-row per-frame allocations could be hoisted as reusable buffers.

## Nitpicks (5 items)

1. **`src/shared/types.ts:308`** — Redundant `| undefined` on optional `link` field [typescript-pro, type-design-analyzer]
2. **`src-tauri/src/terminal.rs:314-315`** — "matching opener" comment implies balanced pairing but code uses `contains()` [comment-analyzer]
3. **`src/components/CanvasTerminal.tsx:39`** — Comment says "foreground cursor color" but it falls back to `cursorColor` prop [comment-analyzer]
4. **`src/components/CanvasTerminal.tsx:1336`** — Comment says "keyup fires on the container" but listeners are on `window` [comment-analyzer]
5. **`src/components/CanvasTerminal.tsx:714`** — `linkStart >= 0` guard is always true [code-simplifier]
