# Compiled Review — PR #9: IPC Adapter Layer + Shared Types (Phase 2)

**Summary:** 6 files reviewed, 10 agents ran (code-quality, security, silent-failure, simplification, DRY, comments, type-design, TypeScript, Rust, efficiency)

---

## Must Fix (7 items)

- [ ] `src/lib/tauri-api.ts:38-98` — [code-reviewer, security-auditor, silent-failure-hunter, type-design-analyzer, typescript-pro, efficiency, dry-reuse, code-simplifier] **Race condition in all 5 event listener methods.** If the returned unsubscribe function is called before the `listen()` Promise resolves, `unlisten` is still `null` and the listener is never removed — causing memory/event leaks. Critical in React StrictMode (double mount/unmount) and fast workspace switching. Fix: add `disposed` flag pattern so teardown executes as soon as `listen()` resolves.

- [ ] `src/lib/tauri-api.ts:18` — [security-auditor, silent-failure-hunter, typescript-pro, efficiency] **`.catch(() => {})` silently swallows all errors** from `logScrollDebug` IPC call. Hides command-not-found, serialization failures, and IPC channel degradation. At minimum use `console.warn` in dev mode.

- [ ] `src/lib/tauri-api.ts:40-44,54-58,66-70,78-82,90-94` — [silent-failure-hunter] **No `.catch()` on `listen()` promises.** If listener registration fails (event system not ready, invalid event name), the rejection is completely unhandled. Terminal will appear blank with zero indication why.

- [ ] `src/lib/tauri-api.ts:16` — [security-auditor] **`openExternal` passes arbitrary URLs to OS shell opener with no validation.** A compromised frontend component could pass `file:///etc/passwd`, `ssh://`, `tel:` or other dangerous URI schemes. Add frontend URL scheme validation (http/https only) before calling `open()`.

- [ ] `src/shared/types.ts:211-218` — [code-reviewer, code-simplifier, type-design-analyzer, typescript-pro, efficiency] **`GridSnapshot` uses snake_case** (`cursor_row`, `cursor_col`, `cursor_visible`, `total_rows`, `scrollback_rows`) while every other TypeScript interface uses camelCase. Rust struct doesn't exist yet — fix to camelCase now and add `#[serde(rename_all = "camelCase")]` on Rust side later.

- [ ] `src/shared/types.ts:112` — [comment-analyzer] **Dangling reference to `THEME_PRESETS`** in JSDoc. No such constant exists in the codebase. Rewrite comment to remove the reference.

- [ ] `src/shared/types.ts:196,246` and `src/lib/tauri-api.ts:36-37` — [comment-analyzer, code-simplifier] **v1/v2 migration-era comments** reference `onPtyData` and "v2 additions" — concepts that don't exist in this codebase. Rewrite to describe current behavior, not what v1 used to do.

## Suggestions (7 items)

- [ ] `src/lib/tauri-api.ts:38-98` — [code-simplifier, dry-reuse, efficiency] **Extract shared listener helper.** All 5 `on*` methods are structurally identical (~12 lines each). A generic `createListener<T>()` helper reduces ~60 lines to ~15, centralizes the race-condition fix, and makes it testable.

- [ ] `src/shared/types.ts:75-116` — [type-design-analyzer, typescript-pro] **`PaneTheme` properties lack `readonly`.** Every other data interface in the file uses `readonly`; `PaneTheme` does not. Add `readonly` for consistency and to prevent accidental mutation.

- [ ] `src/shared/types.ts:223` — [dry-reuse, type-design-analyzer, typescript-pro] **Export `Unsubscribe` type.** Used in the public `KnkodeApi` interface but not exported. Consumers must write `() => void` manually instead of referencing the named type.

- [ ] `src-tauri/capabilities/default.json:6` — [security-auditor, rust-reviewer] **Scope `shell:allow-open` to http/https URLs.** Current permission allows any URL scheme. Add scope restriction: `{ "identifier": "shell:allow-open", "allow": [{ "url": "https://**" }, { "url": "http://**" }] }`.

- [ ] `src-tauri/Cargo.toml:15` — [security-auditor, rust-reviewer] **Pin `tauri-plugin-shell` to tighter semver range** (e.g., `"2.3"` instead of `"2"`). Reduces risk when lockfile is regenerated.

- [ ] `src/lib/tauri-api.ts` (general) — [typescript-pro] **Centralize event name strings.** The 5 event names are raw string literals. A `const IPC_EVENTS = { ... } as const` object would prevent typo-induced silent failures.

- [ ] `src/main.tsx:7` — [security-auditor] **Freeze the global API object.** `Object.freeze(api)` prevents tampering with `window.api` methods as a defense-in-depth measure.

## Nitpicks (7 items)

- [ ] `src/shared/types.ts:7` — [code-simplifier, typescript-pro, efficiency] `as const` on `DEFAULT_PANE_OPACITY = 1` is redundant — numeric literal assigned to `const` is already narrowed.
- [ ] `src/shared/types.ts:22-27` — [typescript-pro] `EFFECT_MULTIPLIERS` typed as `Record<EffectLevel, number>` then asserted `as const` — the annotation widens values, so `as const` has no narrowing effect. Use `satisfies` instead.
- [ ] `src/vite-env.d.ts:7` — [security-auditor] `Window.api` should be `readonly api: KnkodeApi` to signal immutability intent.
- [ ] `src-tauri/Cargo.toml:14-16` — [rust-reviewer] Dependencies not in alphabetical order (`tauri`, `tauri-plugin-shell`, `serde` → should be `serde`, `tauri`, `tauri-plugin-shell`).
- [ ] `src/shared/types.ts:94-95` — [security-auditor] `gradient` field accepts arbitrary CSS string — note it should never be set from untrusted input.
- [ ] `src/shared/types.ts:1` — [comment-analyzer] JSDoc uses subjective "moderate" — value speaks for itself.
- [ ] `src/vite-env.d.ts:3` — [code-simplifier, typescript-pro] `import` in `.d.ts` file converts it to a module — works but unconventional. A comment explaining why would help.

---

*Review ran: code-quality, security, silent-failure, code-simplification, DRY/reuse, comment-quality, type-design, TypeScript, Rust, efficiency*
