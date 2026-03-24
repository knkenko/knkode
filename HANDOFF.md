# Handoff

## What Was Done

### PR #56 — Subgroup Data Model + Migration + Store Foundation
Branch: `feature/subgroup-data-model`

- Replaced `Workspace.layout` with `subgroups: readonly SubgroupConfig[]` + `activeSubgroupId: string`
- Added `SubgroupConfig` type to shared types
- Migrated all store actions to operate within subgroups via helper functions
- Added subgroup management actions: `addSubgroup`, `setActiveSubgroup`, `cycleSubgroup`
- Built migration path in `init()` for legacy single-layout workspaces
- Sidebar switches active subgroup when clicking pane in different group
- PR review completed by 9 agents (20 findings) — all addressed

### Commits
1. `09a396a` feat: replace Workspace.layout with subgroups array
2. `fd8e2ee` feat: add subgroup store actions
3. `252f999` feat: switch active subgroup when clicking pane in different group
4. `c05ac7f` feat: add subgroup action type declarations to StoreState interface
5. `5ed84b3` fix: address all PR review findings (9 agents, 20 items)

### PR #57 — Subgroup Bracket Rendering
Branch: `feature/subgroup-bracket-ui` (merged)

- Added `SubgroupBracket` component with themed vertical connector bars
- Brackets appear when workspace has 2+ subgroups
- Added `BracketColors` and `BracketPosition` types
- All 16 theme variants have unique bracket color pairs

### PR #58 — Themed Add-Pane Button (in review)
Branch: `feature/add-pane-button`

- Added `AddPaneButtonTokens` interface and `addPaneButton` slot in `ThemeVariantConfig`
- Token-driven: single shared renderer + 16 config objects (no per-theme components)
- Buttons call `addSubgroup(wsId)` to create new solo-pane subgroups
- Review completed by 8 agents (9 findings) — all 9 fixed via token-driven refactor
- `aria-label="Add new pane"` on all variants, inline styles replaced with Tailwind

## What's Next

Remaining tasks from the Workspace Subgroups plan:

1. **Task 4: Subgroup keyboard shortcuts** — `feature/subgroup-shortcuts` (knktx card `495ae159`)
   - Keyboard navigation between subgroups

## Active Decisions

- Panes remain flat at workspace level (`workspace.panes`), subgroups only own layout trees
- Each subgroup is an independent `WorkspaceLayout` (preset or custom)
- Migration is automatic and persisted on first load
