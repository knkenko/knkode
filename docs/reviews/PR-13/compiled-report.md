# PR #13 Compiled Review Report

**PR**: feat: frontend canvas terminal renderer (Phase 5b)
**Files**: 3 changed (CanvasTerminal.tsx new, key-to-ansi.ts new, HANDOFF.md)
**Agents**: 8 ran (code-reviewer, security-auditor, code-simplifier, dry-reuse, comment-analyzer, type-design-analyzer, typescript-pro, efficiency)

---

## Must Fix (3 items)

1. **`key-to-ansi.ts:70` — Modified F1-F4 keys send unmodified sequences**
   [code-reviewer, typescript-pro] F1-F4 use SS3 format (`\x1bOP`-`\x1bOS`), not CSI. The `special.startsWith("\x1b[")` check skips them, so Shift+F1, Ctrl+F3 etc. are broken. Fix: convert SS3 to CSI when modifier present (`\x1b[1;${mod}${special[2]}`).

2. **`key-to-ansi.ts:67-80` — Shift+Tab sends `\t` instead of reverse-tab `\x1b[Z`**
   [code-reviewer] Tab maps to `\t` which doesn't start with `\x1b[`, so modifier logic is skipped. Breaks reverse-tab in tmux, fzf, tab-completion cycling. Fix: explicit `if (e.key === "Tab" && e.shiftKey) return "\x1b[Z"`.

3. **`CanvasTerminal.tsx:111-161` — drawCell/buildFont stale closure risk**
   [code-simplifier, typescript-pro, efficiency] Plain functions in component body close over `background`, `fontSize`, `fontFamily` but are not in `draw`'s useCallback deps. Works today by coincidence. Fix: move inside draw callback or extract to module-level pure functions with explicit parameters.

## Suggestions (14 items)

4. **`CanvasTerminal.tsx:128` — buildFont() called per cell per frame**
   [efficiency] 1920 string allocations per draw (80x24), doubled by blink timer. Cache the 4 font variants (normal, bold, italic, bold-italic) in a ref.

5. **`CanvasTerminal.tsx:203-211` — Blink timer redraws entire grid**
   [efficiency, code-reviewer] Full repaint every 530ms just to toggle cursor. Only repaint the cursor cell rect instead.

6. **`CanvasTerminal.tsx:109` — draw dependency array missing lineHeight**
   [efficiency, type-design-analyzer, code-simplifier] `lineHeight` affects cell height via measureCell but isn't in draw's deps. Add it for consistency.

7. **`CanvasTerminal.tsx:17+28+91` — Magic defaults should be in shared types**
   [dry-reuse, type-design-analyzer] DEFAULT_FONT_FAMILY, background "#1e1e1e", cursor color "#c0c0c0" are hardcoded. Export from shared/types.ts alongside existing DEFAULT_FONT_SIZE etc.

8. **`CanvasTerminal.tsx:62+65` — Cache canvas context and DPR in refs**
   [efficiency, code-simplifier] `getContext("2d")` and `window.devicePixelRatio` called every draw. Cache once on resize, reuse across draws.

9. **`CanvasTerminal.tsx:129` — Set textBaseline once at draw start**
   [efficiency] `ctx.textBaseline = "top"` set per cell. Set once before the loop.

10. **`CanvasTerminal.tsx:170` — Debounce ResizeObserver onResize**
    [typescript-pro, efficiency] Fires every frame during drag, flooding PTY with resize commands. Add ~100ms trailing debounce.

11. **`CanvasTerminal.tsx:203-216` — Reset blink timer on grid change**
    [code-reviewer, efficiency] Clear and restart interval when grid changes so cursor stays visible for full CURSOR_BLINK_MS after keystroke. Fold cursorVisible reset into draw effect.

12. **`CanvasTerminal.tsx:136-155` — Extract drawHLine helper**
    [code-simplifier, dry-reuse] Underline and strikethrough blocks are near-identical horizontal line draws. Extract helper to reduce duplication.

13. **`CanvasTerminal.tsx:40` — Misleading "measure cell dimensions" comment**
    [comment-analyzer] Only width is measured from glyph; height is computed arithmetically. Fix: "Measure cell width from monospace glyph; height is fontSize * lineHeight".

14. **`key-to-ansi.ts:1-2` — JSDoc should note SS3 modifier limitation**
    [comment-analyzer] Document that modifier parameters are only applied to CSI sequences, not SS3 keys (F1-F4).

15. **`key-to-ansi.ts:37-39` — MODIFIER_KEYS as Set**
    [code-simplifier] Four chained equality checks → `new Set(["Shift", "Control", "Alt", "Meta"]).has(e.key)`.

16. **`CanvasTerminal.tsx:235` — Comment Tailwind-only exception**
    [code-reviewer] Inline `style={{ background }}` is necessary for dynamic theme color. Add comment explaining the Tailwind exception.

17. **`CanvasTerminal.tsx:195` — Store onResize in ref for stable effect deps**
    [typescript-pro] If parent doesn't wrap onResize in useCallback, ResizeObserver is recreated every render.

## Nitpicks (4 items)

18. **`key-to-ansi.ts:4` — SPECIAL_KEYS as const satisfies**
    [typescript-pro, security-auditor] Add `as const satisfies Record<string, string>` for stricter typing.

19. **`CanvasTerminal.tsx:94` — Cursor opacity 0.7 magic number**
    [type-design-analyzer] Extract to named constant.

20. **`CanvasTerminal.tsx:233` — Missing ARIA role**
    [security-auditor] Container div is focusable but has no `role` attribute.

21. **`CanvasTerminal.tsx:59` — Variable `g` is ambiguous**
    [code-simplifier] Rename to `snap` or `snapshot` for clarity.
