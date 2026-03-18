# DRY / Reuse Review — PR #13 (feature/canvas-terminal)

## Summary

The PR correctly reuses `DEFAULT_FONT_SIZE`, `DEFAULT_LINE_HEIGHT`, `CellSnapshot`, and `GridSnapshot` from `src/shared/types.ts`. The main DRY issue is a local `DEFAULT_FONT_FAMILY` constant that should be promoted to shared types alongside the existing theme defaults, and a hardcoded background color that duplicates a value the `PaneTheme` system is designed to provide. Within the PR itself, the underline/strikethrough drawing blocks share an identical horizontal-line pattern that could be extracted.

## Must Fix

- `src/components/CanvasTerminal.tsx:17` — `DEFAULT_FONT_FAMILY` is defined locally as a component-scoped constant. `src/shared/types.ts` already defines `DEFAULT_FONT_SIZE`, `DEFAULT_LINE_HEIGHT`, `DEFAULT_CURSOR_STYLE`, and `PaneTheme.fontFamily`. This default font stack should be exported from `src/shared/types.ts` so it can be shared with any future component or the theme system (which already has a `fontFamily` field on `PaneTheme`).
- `src/components/CanvasTerminal.tsx:28` — The default background `"#1e1e1e"` is a magic string. The existing theme system (`PaneTheme.background`) is the canonical source for terminal background color. Add a `DEFAULT_BACKGROUND` constant to `src/shared/types.ts` and import it here, ensuring consistency with the theme layer.

## Suggestions

- `src/components/CanvasTerminal.tsx:91` — The fallback cursor color `"#c0c0c0"` is a magic string. `PaneTheme` already has a `cursorColor` field (types.ts:107). Consider adding a `DEFAULT_CURSOR_COLOR` constant to shared types so all consumers agree on the fallback.
- `src/components/CanvasTerminal.tsx:18` — `CURSOR_BLINK_MS = 530` is a local magic number. If cursor blink rate becomes user-configurable or is needed by other components, it should live in shared types alongside `CURSOR_STYLES` and `DEFAULT_CURSOR_STYLE`. Acceptable for now but worth a TODO comment.
- `src/components/CanvasTerminal.tsx:136-155` — The underline and strikethrough blocks are structurally identical (set strokeStyle, lineWidth, beginPath, moveTo, lineTo, stroke) differing only in the Y coordinate calculation. Consider extracting a small `drawHLine(ctx, x, y, width, color, lineWidth)` helper to reduce the duplication within the file.
- `src/components/CanvasTerminal.tsx:109` — The `draw` callback's dependency array includes `fontSize` and `fontFamily` but omits `lineHeight`. Since `buildFont` (called inside `draw`) does not use `lineHeight`, and cell metrics are measured separately, this is not a bug — but if `lineHeight` ever affects rendering inside `draw`, the dep array will be stale. Consider adding a comment noting this intentional omission.
- `src/components/CanvasTerminal.tsx:87-107` — The cursor rendering block (10+ lines inside `draw`) renders a block cursor only. The shared types define `CURSOR_STYLES = ["block", "underline", "bar"]` and `DEFAULT_CURSOR_STYLE`. The component currently ignores `cursorStyle` entirely, which means when cursor style preferences are wired up, this block will need a rewrite. Consider accepting `cursorStyle` as a prop now and at minimum adding a TODO comment.

## Nitpicks

- `src/components/CanvasTerminal.tsx:47,65,171` — `window.devicePixelRatio || 1` is repeated three times. A tiny `const dpr = () => window.devicePixelRatio || 1` helper at module scope (or a `useDpr()` hook) would eliminate the repetition. Not urgent given it's a one-liner.
- `src/components/CanvasTerminal.tsx:105,131` — The text vertical centering formula `y + (cellH - fontSize * dpr) / 2` appears twice (once in cursor text redraw, once in `drawCell`). This is inherent to the two call sites, but if a third appears, extract a `textY(y, cellH, fontSize, dpr)` helper.
- `src/lib/key-to-ansi.ts` — No duplication found. This file is clean, well-scoped, and has no overlap with existing codebase logic. The ANSI key mapping is new functionality with no prior implementation to reuse.
