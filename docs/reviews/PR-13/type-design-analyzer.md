# Type Design Review -- PR #13 (feature/canvas-terminal)

## Summary

The `CanvasTerminalProps` interface is a clean, focused component contract that correctly reuses shared types (`GridSnapshot`, `CellSnapshot`) and shared constants (`DEFAULT_FONT_SIZE`, `DEFAULT_LINE_HEIGHT`). The main type design concerns are a duplicated font-family default that belongs in `shared/types.ts`, a hardcoded background fallback that will drift from theme defaults, and a `draw` callback whose dependency array is missing `lineHeight` -- a runtime correctness bug that causes stale renders when `lineHeight` changes.

## Must Fix

- `src/components/CanvasTerminal.tsx:109` -- The `draw` callback's `useCallback` dependency array is `[background, cursorColor, fontSize, fontFamily]` but `draw` closes over `lineHeight` indirectly through `cellMetrics.current` AND directly in `buildFont` which uses `fontSize`. More critically, `buildFont` (line 158-162) and `drawCell` (line 111-156) are plain functions declared inside the component body -- they capture `fontSize`, `fontFamily`, and `background` from the component closure but are called from within `draw`. Because `drawCell` and `buildFont` are not in the dependency array (they are re-created every render), the memoized `draw` may call stale versions. This is partially mitigated because `draw` itself re-creates when `fontSize`/`fontFamily` change, but `lineHeight` is NOT in the dependency array even though it affects cell height through `measureCell`. If `lineHeight` changes without `fontSize` changing, `draw` will use stale `cellMetrics` because `draw` will not re-memoize, meaning the resize-triggered `measureCell` will update `cellMetrics.current` but the blink interval's cached `draw` reference may be outdated. Add `lineHeight` to the `draw` dependency array: `[background, cursorColor, fontSize, fontFamily, lineHeight]`.

## Suggestions

- `src/components/CanvasTerminal.tsx:17` -- `DEFAULT_FONT_FAMILY` is defined locally in this component, but `DEFAULT_FONT_SIZE` and `DEFAULT_LINE_HEIGHT` are already exported from `src/shared/types.ts`. The font-family default should also live in `shared/types.ts` alongside the other terminal rendering constants, since `PaneTheme.fontFamily` (types.ts:81) references the same concept. This prevents the default from drifting if another consumer needs the same fallback.

- `src/components/CanvasTerminal.tsx:28` -- The hardcoded background fallback `"#1e1e1e"` is a magic color that duplicates theme knowledge. If the project's default theme background ever changes, this component will be out of sync. Consider extracting a `DEFAULT_BACKGROUND` constant in `shared/types.ts` or, better, requiring `background` to always be passed from the theme layer (make the prop non-optional and let the parent resolve the default from `PaneTheme.background`).

- `src/components/CanvasTerminal.tsx:6-15` -- `CanvasTerminalProps` re-declares several fields (`fontSize`, `fontFamily`, `lineHeight`, `cursorColor`, `background`) that overlap with `PaneTheme` (types.ts:75-116). Consider deriving these props from `PaneTheme` using `Pick<PaneTheme, 'fontSize' | 'fontFamily' | 'lineHeight' | 'cursorColor'> & { ... }` or accepting a `theme: PaneTheme` prop directly, then destructuring internally. This creates a single source of truth and prevents the prop types from diverging from the theme type over time.

- `src/components/CanvasTerminal.tsx:91` -- The cursor color fallback `"#c0c0c0"` is another magic color. The existing `PaneTheme` type has `cursorColor` (types.ts:107) with a documented convention of falling back to `foreground` when omitted. This component's fallback to a hardcoded gray contradicts that convention. Align by either accepting `foreground` as a prop and using it as the cursor fallback, or documenting why the canvas renderer uses a different default.

- `src/lib/key-to-ansi.ts:4` -- `SPECIAL_KEYS` is typed as `Record<string, string>`, which loses the ability to check for typos or missing keys at compile time. Consider using a `satisfies` assertion with a union of known key names: `const SPECIAL_KEYS = { ... } as const satisfies Record<string, string>`. The `as const` preserves literal types for values while `satisfies` still checks the shape. This also enables downstream code to know the exact set of handled keys.

## Nitpicks

- `src/components/CanvasTerminal.tsx:94` -- The cursor opacity `0.7` is a magic number. Extract to a named constant (e.g., `CURSOR_OPACITY = 0.7`) next to `CURSOR_BLINK_MS` on line 18 for consistency with the project's convention of extracting magic numbers.

- `src/lib/key-to-ansi.ts:35` -- The function signature `keyEventToAnsi(e: KeyboardEvent): string | null` is correct, but the return type could be made more self-documenting by introducing a type alias like `type AnsiSequence = string` and returning `AnsiSequence | null`. This is a very minor readability concern and may not be worth the indirection in a small utility file.

- `src/components/CanvasTerminal.tsx:32` -- `cellMetrics` ref is initialized with `{ width: 0, height: 0 }`, and the `draw` function guards against zero dimensions on line 67. This works but the zero-initialized sentinel is implicit. A more type-safe approach would be to initialize as `null` and guard with `if (!cellMetrics.current) return`, making the "not yet measured" state explicit in the type.
