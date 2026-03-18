# Efficiency Review — PR #13 (`feature/canvas-terminal`)

## Summary

The canvas renderer redraws the entire grid on every blink tick (~1.9 redraws/sec) and constructs a new font string per cell per frame, which together dominate render cost. The key-to-ansi module is clean; all hot-path concerns are in `CanvasTerminal.tsx`.

## Must Fix

- **`CanvasTerminal.tsx:128` — `buildFont()` called per cell, per frame.** Every cell calls `buildFont`, which allocates a new template-literal string. For an 80x24 grid that is 1,920 string allocations per draw, doubled by the blink timer. Cache the four font variants (normal, bold, italic, bold-italic) once in a ref when `fontSize`/`fontFamily` change, and index into the cache from `drawCell`.

- **`CanvasTerminal.tsx:203-211` — Blink timer redraws the entire grid.** `setInterval` fires `draw()` every 530 ms, which clears and repaints every cell just to toggle the cursor block. Instead, only repaint the single cursor cell rect: save/restore the area under the cursor with `getImageData`/`putImageData` or redraw only the cursor cell and its background.

- **`CanvasTerminal.tsx:109` — `draw` dependency array missing `lineHeight`.** `draw` closes over `fontSize` and `fontFamily` (listed) but also reads `cellMetrics.current.height`, which is derived from `lineHeight`. More importantly `buildFont` is called inside `draw` and it references `fontSize` from closure, but `lineHeight` is only captured via `measureCell`. If `lineHeight` changes, `draw` itself is not re-created, but `cellMetrics` will have been updated via `measureCell`. This is not a correctness bug per se, but `fontSize` *is* in the dep array while `lineHeight` is not — be consistent: either move all metric reads to the ref (drop `fontSize` from draw deps) or add `lineHeight` too.

## Suggestions

- **`CanvasTerminal.tsx:62` — `canvas.getContext("2d")` called every draw.** `getContext` with the same context type returns the same object, so the browser short-circuits, but it still performs an internal lookup. Cache the context in a ref once (after the canvas mounts or resizes) and reuse it across `draw`, `measureCell`, and blink redraws.

- **`CanvasTerminal.tsx:129-130` — Redundant `ctx.textBaseline` assignment per cell.** `textBaseline = "top"` is set for every cell that has text. Set it once at the start of `draw` and leave it; the underline/strikethrough paths don't alter it.

- **`CanvasTerminal.tsx:65` — `window.devicePixelRatio` read every draw.** DPR only changes on display-switch or zoom. Read it once in the resize handler and store in a ref; pass the ref value into `draw`.

- **`CanvasTerminal.tsx:74-85` — Full grid redraw with no dirty tracking.** For a first version this is acceptable, but for larger grids (e.g. 200x50) consider a dirty-row bitset: the Rust side can flag which rows changed between snapshots, and `draw` can skip unchanged rows entirely.

- **`CanvasTerminal.tsx:213-216` — Blink reset effect runs on every `grid` change.** Setting `cursorVisible.current = true` is cheap but creates an extra effect invocation per grid update. Fold this into the `draw`-on-grid effect (line 198) as a single statement before `draw()` to eliminate the separate effect.

- **`CanvasTerminal.tsx:170` — ResizeObserver fires on initial observe.** The observer callback calls `onResize` immediately on attachment, which may fire before the parent is ready. Consider debouncing or guarding with a mounted flag if this causes a double-render on mount.

## Nitpicks

- **`CanvasTerminal.tsx:111-156` — `drawCell` is a plain function, not memoized.** It closes over `background`, `fontSize`, and `fontFamily` from the component scope. This works but means a new closure is created every render. Move it inside `draw`'s useCallback body (it is only called there) or convert to a module-level pure function that receives all dependencies as arguments.

- **`CanvasTerminal.tsx:158-162` — `buildFont` also a per-render closure.** Same as above. Once you cache font strings this becomes moot, but until then it is a fresh closure per render.

- **`key-to-ansi.ts:70` — `special.length > 2` guard is fragile.** The intent is "only modify CSI sequences, not SS3 (\\x1bO…)". This works today because all SS3 entries are exactly 3 chars, but the guard reads as a magic number. A comment or an explicit `!special.startsWith("\\x1bO")` check would be clearer.
