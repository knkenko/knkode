# PR #13 TypeScript Review -- Canvas Terminal

## Summary

Solid canvas-based terminal renderer with clean type usage and correct React hook dependency arrays for the common cases. Two real bugs: missing modifier handling for SS3-encoded function keys (F1-F4), and an implicit coupling between `drawCell`/`buildFont` closures and the `draw` memoization deps that will break silently if either side is edited independently. The ResizeObserver also lacks debouncing, which risks flooding the PTY with resize signals.

## Must Fix

- `src/lib/key-to-ansi.ts:70` -- SS3 function keys (F1-F4) use `\x1bO` prefix, not `\x1b[`, so the modifier injection branch (`special.startsWith("\x1b[")`) never fires for them. `Shift+F1`, `Ctrl+F1`, `Alt+F2`, etc. will emit the unmodified escape sequence instead of the correct `\x1b[1;2P` form. Fix by converting SS3 sequences to CSI format when a modifier is present (xterm does `\x1bOP` -> `\x1b[1;modP`).

- `src/components/CanvasTerminal.tsx:111-161` -- `drawCell` and `buildFont` are plain functions declared in the component body. They close over `background`, `fontSize`, and `fontFamily`, but they are not in `draw`'s `useCallback` dependency array (nor can they be, since they are recreated every render). This works today only because `draw`'s deps happen to list the same values these functions close over. If anyone adds a new closed-over variable to `drawCell`/`buildFont` without also adding it to `draw`'s deps, a stale closure bug will silently appear. Refactor: either move `drawCell`/`buildFont` inside the `draw` callback, or extract them outside the component and pass all values as parameters.

## Suggestions

- `src/components/CanvasTerminal.tsx:170` -- The `ResizeObserver` callback fires on every frame during a resize drag and calls `onResize(cols, rows)`, which likely triggers a Tauri IPC to resize the PTY. Consider debouncing or throttling the `onResize` call (e.g., 100ms trailing debounce) to avoid flooding the backend with resize commands.

- `src/components/CanvasTerminal.tsx:195` -- If the parent component does not wrap `onResize` in `useCallback`, this effect will tear down and re-create the `ResizeObserver` on every render. Document this requirement on the prop, or defend against it by storing `onResize` in a ref so the effect dep array stays stable.

- `src/components/CanvasTerminal.tsx:38` -- Setting `gridRef.current = grid` during render is a render-phase side effect. In React concurrent mode, render can be invoked multiple times without committing. Move this assignment into a `useLayoutEffect` or `useEffect` to align with React's intended lifecycle. The risk is low here since the ref is only read during imperative draw calls, but it is technically incorrect.

- `src/components/CanvasTerminal.tsx:109` -- `draw`'s dependency array lists `[background, cursorColor, fontSize, fontFamily]` but omits `lineHeight`. While `draw` reads cell metrics from a ref (which `measureCell` populates using `lineHeight`), a `lineHeight` prop change will not cause `draw` to be recreated, so the blink timer will continue using the old `draw`. This is unlikely to cause a visible bug in practice (the ResizeObserver path recalculates metrics), but it is an incomplete dependency specification.

## Nitpicks

- `src/lib/key-to-ansi.ts:4` -- `SPECIAL_KEYS` could be declared `as const satisfies Record<string, string>` (or wrapped in `Object.freeze`) to prevent accidental mutation and enable literal type inference if ever needed downstream.

- `src/lib/key-to-ansi.ts:84` -- The `e.key.length === 1` check for printable characters will not match characters outside the BMP that are represented as surrogate pairs (length 2 in JS strings). This is unlikely to matter for terminal input but is worth a brief comment explaining the heuristic.

- `src/components/CanvasTerminal.tsx:203-211` -- Every time `draw` is recreated (any change to `background`, `cursorColor`, `fontSize`, `fontFamily`), the blink timer is torn down and restarted, resetting the blink phase. This is cosmetically harmless but could cause a brief visual glitch. Consider using a ref for the draw function in the blink interval to decouple timer lifetime from draw identity.
