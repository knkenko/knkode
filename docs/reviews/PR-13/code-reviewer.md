# PR #13 Code Review — `feature/canvas-terminal`

## Summary

The PR adds a canvas-based terminal renderer (`CanvasTerminal.tsx`) and a keyboard-to-ANSI translation layer (`key-to-ansi.ts`). The canvas rendering logic is solid overall, but the ANSI key translation has two input-handling bugs that will cause broken keyboard behavior in TUI applications.

## Must Fix

- **`src/lib/key-to-ansi.ts:70` — Modified F1-F4 keys send unmodified sequences (confidence: 92).**
  F1-F4 use SS3 format (`\x1bOP` through `\x1bOS`), which starts with `\x1bO`, not `\x1b[`. The modifier check on line 70 (`special.startsWith("\x1b[")`) skips them entirely, so Shift+F1, Ctrl+F3, etc. fall through to returning the unmodified sequence. The correct modified form uses CSI format: e.g., Shift+F1 should be `\x1b[1;2P`, Ctrl+F3 should be `\x1b[1;5R`.
  **Fix**: Add an additional branch for SS3 sequences — when `special.startsWith("\x1bO")` and `mod > 1`, convert to CSI format: `\x1b[1;${mod}${special[2]}`.

- **`src/lib/key-to-ansi.ts:67-80` — Shift+Tab sends `\t` instead of reverse-tab `\x1b[Z` (confidence: 90).**
  `Tab` maps to `\t` in `SPECIAL_KEYS`. Since `\t` does not start with `\x1b[`, the modifier logic is skipped and Shift+Tab sends a plain tab. This breaks reverse-tab navigation in every TUI application (tmux, fzf, tab-completion cycling, etc.).
  **Fix**: Add an explicit check before the generic special-key modifier logic: `if (e.key === "Tab" && e.shiftKey) return "\x1b[Z";`

## Suggestions

- **`src/components/CanvasTerminal.tsx:203-216` — Cursor blink timer not reset on keystroke (confidence: 75).**
  When a new grid arrives, `cursorVisible` is set to `true` (line 215), but the `setInterval` is not restarted. If the interval fires immediately after the grid update, the cursor flashes off for one blink cycle. For a polished feel, clear and restart the interval when the grid changes so the cursor stays visible for a full `CURSOR_BLINK_MS` after each keystroke.

- **`src/components/CanvasTerminal.tsx:204` — Blink timer should use `requestAnimationFrame` (confidence: 70).**
  The blink `setInterval` calls `draw()` directly, which triggers a full canvas repaint that may not align with browser paint frames. Wrapping the `draw()` call inside `requestAnimationFrame` would be more efficient and avoid potential dropped frames.

- **`src/components/CanvasTerminal.tsx:235` — Inline `style={{ background }}` vs Tailwind-only rule (confidence: 65).**
  The project rules state "Tailwind-only styling -- no exceptions." The inline style is used for a dynamic theme background color, which cannot be a static Tailwind class. This is a pragmatically necessary exception, but worth documenting with a comment explaining why it deviates from the Tailwind-only rule (e.g., `{/* Dynamic theme color — cannot use Tailwind */}`).

## Nitpicks

- None
