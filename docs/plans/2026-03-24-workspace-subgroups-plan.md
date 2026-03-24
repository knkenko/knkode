# Workspace Subgroups — Plan

**Created:** 2026-03-24

## Design

### Architecture

Workspace subgroups allow multiple independent split layouts within a single workspace, switchable via sidebar clicks. Each subgroup is a self-contained layout tree rendered by its own Allotment instance. Only the active subgroup is visible in the pane area at a time; all PTYs across all subgroups stay alive.

**Mental model:** Like tmux windows within a session. A workspace "Backend" can have a 3-pane Claude group (server, logs, tests) and a solo Gemini pane — both in the same project workspace, switchable by clicking in the sidebar.

### Key Decisions

1. **Tabs in sidebar only** — no tab bar in the pane area. Subgroups are represented by bracket connectors (`┌ │ └`) in the sidebar around grouped pane entries. Solo panes have no bracket.

2. **Groups emerge from splitting** — clicking "Add Pane" creates a solo subgroup (full-screen terminal). Splitting from the pane status bar grows that group. No explicit "create group" action.

3. **Bracket/brace visual connectors** — themed per variant. Hidden when workspace has only one subgroup (backward compatible — looks identical to today).

4. **Click switches group + focuses pane** — clicking any pane in an inactive subgroup switches to that group's layout AND focuses the clicked pane.

5. **No drag-between-groups in v1** — to reorganize, close pane and re-add. Keeps scope manageable.

6. **Auto-remove empty groups** — closing the last pane in a subgroup removes the group and switches to the next.

7. **PTY lifecycle unchanged** — all panes in all subgroups of an open workspace stay alive. Existing `visitedWorkspaceIds` + `activePtyIds` model is unaffected.

8. **Keyboard shortcuts** — `Cmd+Shift+]` / `Cmd+Shift+[` cycle next/prev subgroup within workspace.

### Data Model

**Current:**
```typescript
interface Workspace {
  id: string;
  name: string;
  theme: PaneTheme;
  layout: WorkspaceLayout;           // single layout tree
  panes: Record<string, PaneConfig>; // flat map
}
```

**Proposed:**
```typescript
interface SubgroupConfig {
  readonly id: string;
  readonly layout: WorkspaceLayout;  // each subgroup owns a layout tree
}

interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly theme: PaneTheme;
  readonly subgroups: readonly SubgroupConfig[];
  readonly activeSubgroupId: string;
  readonly panes: Record<string, PaneConfig>; // flat — all subgroups
  // `layout` field removed
}
```

**Migration:** On load, if `workspace.layout` exists but `workspace.subgroups` doesn't, wrap the existing layout: `subgroups: [{ id: randomUUID(), layout: workspace.layout }]`.

**Panes stay flat** at workspace level — subgroup layout trees reference pane IDs into this flat map. PTY management, branch tracking, PR tracking all unchanged.

### Store Action Changes

**Modified actions** — find subgroup containing target pane, operate on that subgroup's layout tree:
- `splitPane(wsId, paneId, dir)` — locate subgroup by pane → split within it
- `closePane(wsId, paneId)` — locate subgroup → close pane → if last pane, remove subgroup, switch active
- `updateNodeSizes(wsId, path, sizes)` — operates on active subgroup's layout
- `movePaneToPosition`, `swapPanes` — find subgroup by pane, operate within

**New actions:**
- `addSubgroup(wsId)` — creates solo pane subgroup, sets active
- `setActiveSubgroup(wsId, subgroupId)` — switches visible subgroup
- `cycleSubgroup(wsId, direction: 1 | -1)` — for keyboard shortcuts

**Helper:**
```typescript
function findSubgroupForPane(workspace: Workspace, paneId: string): SubgroupConfig | undefined {
  return workspace.subgroups.find(sg => getPaneIdsInOrder(sg.layout.tree).includes(paneId));
}
```

### Sidebar UI

**Single subgroup** (backward compatible):
```
Backend
  server
  logs
  tests
  [+ Add Pane]
```

**Multiple subgroups** (brackets appear):
```
Backend
  ┌ server          ← active group (accented bracket)
  │ logs
  └ tests
    gemini           ← solo, inactive (dimmed)
  [+ Add Pane]
```

- Active subgroup bracket uses theme accent/glow color
- Inactive subgroup panes are dimmed
- "Add Pane" button: themed per variant (words/icon/+ varies like scroll-to-bottom)
- Bracket characters rendered as left-edge decoration on `SidebarPaneEntry`

### PaneArea Change

Minimal — receives active subgroup's layout tree:
```typescript
const activeSubgroup = workspace.subgroups.find(s => s.id === workspace.activeSubgroupId);
// renderNode(activeSubgroup.layout.tree) — rest identical
```

### Edge Cases

1. **Last subgroup, last pane closed** → workspace gets fresh default pane (existing behavior)
2. **`duplicateWorkspace`** → deep-clone all subgroups with new IDs + pane IDs
3. **`movePaneToWorkspace`** → remove from source subgroup (remove subgroup if empty), add as solo subgroup in target
4. **Layout presets** → apply to active subgroup only
5. **Workspace git info** → derived from all panes across all subgroups (no change)
6. **Sidebar collapsed mode** → workspace icons only, no subgroup UI needed

## Tasks

### Task 1: Data model + migration + store foundation
- **Branch:** `feature/subgroup-data-model`
- **PR title:** feat: workspace subgroup data model and migration
- **Scope:** Types, migration, store action refactoring, PaneArea update
- **Details:**
  - Add `SubgroupConfig` interface to `types.ts`
  - Update `Workspace` interface: replace `layout` with `subgroups` + `activeSubgroupId`
  - Add migration in store `init()` — wrap `workspace.layout` into single subgroup
  - Update all store actions referencing `workspace.layout` to locate subgroup first
  - Add `findSubgroupForPane` helper to `layout-tree.ts`
  - Add `addSubgroup`, `setActiveSubgroup`, `cycleSubgroup` actions
  - Update `PaneArea` to render active subgroup's layout tree
  - Update sidebar pane click to call `setActiveSubgroup` when clicking pane in different subgroup
  - Update `createLayoutFromPreset` / `applyPresetWithRemap` to work with subgroups
  - Update `duplicateWorkspace`, `movePaneToWorkspace` for subgroup awareness

### Task 2: Sidebar bracket rendering
- **Branch:** `feature/subgroup-bracket-ui`
- **PR title:** feat: sidebar bracket connectors for pane subgroups
- **Scope:** Sidebar bracket UI, active/inactive visual states
- **Details:**
  - Add bracket position prop to `SidebarPaneEntry` (`first | middle | last | solo | none`)
  - Render `┌ │ └` bracket decoration as left-edge element per pane entry
  - Only show brackets when workspace has 2+ subgroups
  - Active subgroup: accent-colored bracket, normal pane text
  - Inactive subgroup: muted bracket and dimmed pane text
  - Add bracket color/style to theme variant config for per-theme customization

### Task 3: Themed "Add Pane" button
- **Branch:** `feature/add-pane-button`
- **PR title:** feat: themed add-pane button in sidebar
- **Scope:** ThemeVariantConfig extension, 16 variant implementations, sidebar wiring
- **Details:**
  - Add `BaseAddPaneButtonProps` and component slot to `ThemeVariantConfig`
  - Implement `AddPaneButton` for all 16 theme variants (8 classic + 8 identity)
  - Style per variant: some show "+ New Pane", some show just "+", some use themed icon
  - Full-width, narrow height, positioned after all subgroup entries
  - Wire in `Sidebar.tsx` — calls `addSubgroup(wsId)` on click

### Task 4: Subgroup keyboard shortcuts
- **Branch:** `feature/subgroup-shortcuts`
- **PR title:** feat: Cmd+Shift+bracket shortcuts for subgroup cycling
- **Scope:** Global shortcut handler, cycle action
- **Details:**
  - Register `Cmd+Shift+]` → `cycleSubgroup(wsId, 1)` (next)
  - Register `Cmd+Shift+[` → `cycleSubgroup(wsId, -1)` (prev)
  - No-op when workspace has single subgroup
  - Wraps around at boundaries
  - Add to hotkey reference dialog
