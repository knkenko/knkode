# Comment Quality Review -- PR #13

## Summary

Two new files (`src/components/CanvasTerminal.tsx` and `src/lib/key-to-ansi.ts`) with a total of 338 lines. Comments are generally concise and well-placed. The JSDoc on `keyEventToAnsi` and `modifierParam` is accurate against the actual implementation. The inline comments in `CanvasTerminal.tsx` are short section headers that aid scannability. Two accuracy issues were found: one misleading comment about how cell dimensions are measured, and one behavioral gap that the file-level JSDoc should acknowledge more precisely.

## Must Fix

- `src/components/CanvasTerminal.tsx:40` -- The comment "Measure cell dimensions from a monospace character" is misleading. Only the **width** is measured from a character (`ctx.measureText("M")`). The **height** is calculated arithmetically as `fontSize * lineHeight * dpr` with no font-metric measurement involved. A future maintainer trying to debug vertical spacing issues could waste time looking for a measurement call that does not exist. Suggested rewrite: `// Measure cell width from a monospace glyph; height is computed from fontSize * lineHeight`.

## Suggestions

- `src/lib/key-to-ansi.ts:1-2` -- The file-level JSDoc says "no input mode awareness (application cursor mode deferred)" which is good, but should also note that **modifier parameters are not applied to SS3-format keys (F1-F4)**. The code at line 70 filters on `special.startsWith("\x1b[")`, which silently skips F1-F4 (`\x1bOP`-`\x1bOS`). A developer adding Shift+F3 support later would need to understand this gap. Suggested addition: `Modifier parameters are only applied to CSI-format sequences; SS3 keys (F1-F4) are sent unmodified.`

- `src/components/CanvasTerminal.tsx:56` -- The comment "Draw the full grid" is accurate but could be more useful. This is the core rendering function and is called both from the grid-change effect and the blink timer. Consider: `// Draw full grid + cursor; called on every grid update and blink tick`. This would help a reader understand the two call sites without tracing the code.

- `src/components/CanvasTerminal.tsx:164` -- The comment "Handle resize: compute cols/rows from container dimensions" describes only part of what the effect does. It also sets the canvas backing-store dimensions, updates `canvas.style` for CSS sizing, and calls `measureCell()`. Since canvas DPR scaling is a common source of blurry-text bugs, the comment should mention that this effect handles DPR-aware canvas sizing. Suggested rewrite: `// Resize canvas (DPR-aware) and recompute grid cols/rows from container dimensions`.

- `src/lib/key-to-ansi.ts:41` -- The comment "Ctrl+key combinations (a-z, plus common special combos)" says "common special combos" but the actual special combos handled are specifically `Ctrl+[`, `Ctrl+\`, `Ctrl+]`, and `Ctrl+Space`. Since these map to well-known terminal control codes (ESC, FS, GS, NUL), listing them explicitly in the comment would be more useful than the vague "common special combos." The inline comments on lines 49 and 54 partially cover this, but the section header could be clearer: `// Ctrl+key: a-z maps to 0x01-0x1A; also handles Ctrl+[ ] \ and Space`.

## Nitpicks

- `src/components/CanvasTerminal.tsx:69` -- The comment `// Clear` is self-evident from `ctx.fillRect(0, 0, canvas.width, canvas.height)`. Similarly, the single-word section comments at lines 120 (`// Background`), 126 (`// Text`), 135 (`// Underline`), and 146 (`// Strikethrough`) inside `drawCell` restate what is immediately obvious from the code. These are borderline -- they do help with visual scanning of the function, so removal is not strongly recommended, but they add no information that the code itself does not already convey.

- `src/components/CanvasTerminal.tsx:213` -- The comment "Reset cursor blink on new grid (keystroke resets blink to visible)" parenthetical says "keystroke" but the effect fires on any `grid` change, which could also come from programmatic output (e.g., a long-running command producing output without user input). The word "keystroke" is technically inaccurate as the sole trigger. A more precise phrasing: `// Reset blink to visible on grid change (any terminal activity resets the blink cycle)`.

- `src/components/CanvasTerminal.tsx:197` -- The comment "Redraw when grid changes" is accurate but trivially obvious from the 2-line effect body `draw()` with `[grid, draw]` deps. This is the kind of comment that adds minimal value since the code is self-documenting.
