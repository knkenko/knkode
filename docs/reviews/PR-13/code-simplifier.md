# Code Simplification Review -- PR #13

## Summary

Both files are well-structured with clean separation of concerns. The main opportunities are extracting a duplicated horizontal-line drawing pattern, eliminating a redundant `lineHeight` capture in `draw`'s dependency array, and consolidating the modifier-key guard in `key-to-ansi.ts` into a Set lookup.

## Must Fix

- `CanvasTerminal.tsx:109` -- `draw` callback dependency array is `[background, cursorColor, fontSize, fontFamily]` but `draw` reads `lineHeight` indirectly through `cellMetrics` (which is measured elsewhere) and also calls `drawCell`/`buildFont` which close over `fontSize` and `fontFamily`. More importantly, `drawCell` and `buildFont` are plain functions declared inside the component body (lines 111-162) that close over `fontSize`, `fontFamily`, `background`, and `lineHeight` -- but they are not listed as dependencies of `draw` because they are recreated every render. This means `draw` is technically stale if those props change without `background`/`cursorColor`/`fontSize`/`fontFamily` also changing. Either move `drawCell` and `buildFont` inside the `draw` callback, or convert them to module-level pure functions that receive all needed values as parameters (removing the closure over component props). The latter is cleaner -- pass `fontSize`, `fontFamily`, and `background` as explicit arguments to `drawCell` and `buildFont`.

## Suggestions

- `CanvasTerminal.tsx:135-155` -- The underline block (lines 135-144) and strikethrough block (lines 146-155) are near-identical: both set `strokeStyle` to `cell.fg`, set `lineWidth` to `dpr`, compute a Y coordinate, then draw a horizontal line from `x` to `x + cellW`. Extract a small helper like `drawHLine(ctx, x, y, width, color, lineWidth)` to eliminate the duplication. This also makes the cursor-overlay text drawing section easier to follow.
- `CanvasTerminal.tsx:47,65,171` -- `window.devicePixelRatio || 1` is computed in three separate places (`measureCell`, `draw`, and the `ResizeObserver` callback). Consider extracting a `getDpr()` utility at module scope: `function getDpr(): number { return window.devicePixelRatio || 1; }`. This centralizes the fallback logic and makes it trivial to change later (e.g., if you need to cap DPR for performance).
- `key-to-ansi.ts:37-39` -- The modifier-key guard uses four chained equality comparisons. A `Set` lookup is both faster and easier to extend: `const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);` then `if (MODIFIER_KEYS.has(e.key)) return null;`.
- `CanvasTerminal.tsx:98-107` -- The cursor-cell text redraw (lines 98-107) partially duplicates the text-drawing logic inside `drawCell` (lines 127-133). The only difference is the fill color (`background` vs `cell.fg`). Consider calling `drawCell` for the cursor cell with a temporary foreground override, or extracting the text-drawing portion into a shared helper, to avoid two copies of the `buildFont` + `textBaseline` + `textY` calculation.

## Nitpicks

- `CanvasTerminal.tsx:59` -- The variable `g` (short for grid) is used throughout `draw`. A slightly more descriptive name like `snap` or `snapshot` would be clearer since `GridSnapshot` is the type name, and `g` is ambiguous in a graphics context where it could refer to a 2D context.
- `CanvasTerminal.tsx:91` -- `cursorColor ?? "#c0c0c0"` uses a hardcoded fallback. This could be extracted into a named constant like `DEFAULT_CURSOR_COLOR` alongside the other defaults at the top of the file, for consistency with `DEFAULT_FONT_FAMILY` and `CURSOR_BLINK_MS`.
- `key-to-ansi.ts:1-2` -- The JSDoc comment on the module uses an em-dash character. This is fine stylistically but inconsistent with the rest of the codebase which uses plain `--` in comments (see `types.ts`). Minor, but worth noting for consistency.
