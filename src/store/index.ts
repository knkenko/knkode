import { create } from 'zustand'
import type {
	AppState,
	DropPosition,
	LayoutPreset,
	PaneConfig,
	PrInfo,
	Snippet,
	SplitDirection,
	Workspace,
} from '../shared/types'
import { createLayoutFromPreset } from './layout-tree'
import { createSnippetSlice } from './snippet-actions'
import { WORKSPACE_COLORS, createWorkspacePaneSlice, defaultTheme } from './workspace-pane-actions'

interface StoreState {
	// Data
	workspaces: Workspace[]
	appState: AppState
	homeDir: string
	snippets: Snippet[]

	// UI state
	initialized: boolean
	initError: string | null
	focusedPaneId: string | null
	focusGeneration: number
	/** Workspace IDs that have been activated at least once this session.
	 *  Used for lazy PTY loading — only visited workspaces render PaneAreas. */
	visitedWorkspaceIds: string[]
	/** Pane IDs for which a PTY has been requested or is running.
	 *  Prevents double-creation on remount.
	 *  IMPORTANT: Always create a new Set on mutation — Zustand uses reference equality. */
	activePtyIds: Set<string>
	/** Current git branch per pane. Ephemeral runtime state — not persisted to disk. */
	paneBranches: Record<string, string | null>
	/** Current PR info per pane. Ephemeral runtime state — not persisted to disk. */
	panePrs: Record<string, PrInfo | null>

	// Actions
	setFocusedPane: (paneId: string | null) => void
	/** Ensure a PTY exists for the given pane. No-op if already requested or active. */
	ensurePty: (paneId: string, cwd: string, startupCommand: string | null) => void
	/** Kill PTYs for the given pane IDs and remove them from activePtyIds. */
	killPtys: (paneIds: string[]) => void
	/** Remove a single pane ID from activePtyIds (e.g. on natural PTY exit). */
	removePtyId: (paneId: string) => void
	init: () => Promise<void>
	createWorkspace: (name: string, color: string, preset: LayoutPreset) => Promise<Workspace>
	createDefaultWorkspace: () => Promise<Workspace>
	updateWorkspace: (workspace: Workspace) => Promise<void>
	duplicateWorkspace: (id: string) => Promise<Workspace | null>
	removeWorkspace: (id: string) => Promise<void>
	setActiveWorkspace: (id: string) => void
	openWorkspace: (id: string) => void
	closeWorkspaceTab: (id: string) => void
	/** Move the tab at fromIndex to toIndex within openWorkspaceIds (splice-remove then insert). */
	reorderWorkspaceTabs: (fromIndex: number, toIndex: number) => void
	splitPane: (workspaceId: string, paneId: string, direction: SplitDirection) => void
	closePane: (workspaceId: string, paneId: string) => void
	/** Move a pane from one workspace to another. PTY stays alive. */
	movePaneToWorkspace: (fromWsId: string, paneId: string, toWsId: string) => void
	/** Swap two panes' positions within a workspace layout tree.
	 *  Only swaps leaf paneId values; pane configs and PTYs are untouched. */
	swapPanes: (workspaceId: string, paneIdA: string, paneIdB: string) => void
	/** Move a pane to a position (left/right/top/bottom) relative to another pane.
	 *  Both panes must belong to the given workspace. Restructures the layout tree
	 *  by removing the source and inserting it as a new split alongside the target.
	 *  PTYs and pane configs stay alive. */
	movePaneToPosition: (
		workspaceId: string,
		sourcePaneId: string,
		targetPaneId: string,
		position: DropPosition,
	) => void
	updatePaneConfig: (workspaceId: string, paneId: string, updates: Partial<PaneConfig>) => void
	updatePaneCwd: (workspaceId: string, paneId: string, cwd: string) => void
	/** Update git branch for a pane. No workspaceId needed — branch state is a flat
	 *  ephemeral map (not persisted inside workspace objects like cwd). */
	updatePaneBranch: (paneId: string, branch: string | null) => void
	/** Update PR info for a pane. No workspaceId needed — PR state is a flat
	 *  ephemeral map (not persisted inside workspace objects). */
	updatePanePr: (paneId: string, pr: PrInfo | null) => void
	/** Persist pixel sizes as percentages at a given tree path.
	 *  `path` is an array of child indices from the root to the target branch node.
	 *  An empty array `[]` targets the root node itself.
	 *  Also transitions the workspace layout type from 'preset' to 'custom'. */
	updateNodeSizes: (workspaceId: string, path: number[], pixelSizes: number[]) => void
	saveState: () => Promise<void>
	addSnippet: (name: string, command: string) => void
	updateSnippet: (id: string, updates: Pick<Snippet, 'name' | 'command'>) => void
	removeSnippet: (id: string) => void
	/** Move the snippet at fromIndex to toIndex (splice-remove then insert). */
	reorderSnippets: (fromIndex: number, toIndex: number) => void
	runSnippet: (snippetId: string, paneId: string) => void
}

export const useStore = create<StoreState>((set, get) => ({
	workspaces: [],
	appState: {
		openWorkspaceIds: [],
		activeWorkspaceId: null,
		windowBounds: { x: 100, y: 100, width: 1200, height: 800 },
	},
	homeDir: '/tmp',
	snippets: [],
	initialized: false,
	initError: null,
	focusedPaneId: null,
	focusGeneration: 0,
	visitedWorkspaceIds: [],
	activePtyIds: new Set(),
	paneBranches: {},
	panePrs: {},

	setFocusedPane: (paneId) =>
		set((state) => ({ focusedPaneId: paneId, focusGeneration: state.focusGeneration + 1 })),

	ensurePty: (paneId, cwd, startupCommand) => {
		const { activePtyIds } = get()
		if (activePtyIds.has(paneId)) return
		// Optimistically mark as active to prevent concurrent creation attempts
		const newSet = new Set(activePtyIds)
		newSet.add(paneId)
		set({ activePtyIds: newSet })
		window.api.createPty(paneId, cwd, startupCommand).catch((err) => {
			console.error(`[store] Failed to create PTY for pane ${paneId}:`, err)
			// Remove from active set on failure so retry is possible
			const current = get().activePtyIds
			if (current.has(paneId)) {
				const rollback = new Set(current)
				rollback.delete(paneId)
				set({ activePtyIds: rollback })
			}
		})
	},

	killPtys: (paneIds) => {
		for (const id of paneIds) {
			window.api.killPty(id).catch((err) => {
				console.warn(`[store] killPty failed for pane ${id}:`, err)
			})
		}
		const current = get().activePtyIds
		const newSet = new Set(current)
		let changed = false
		for (const id of paneIds) {
			if (newSet.delete(id)) changed = true
		}
		if (changed) set({ activePtyIds: newSet })
	},

	removePtyId: (paneId) => {
		const current = get().activePtyIds
		if (!current.has(paneId)) return
		const newSet = new Set(current)
		newSet.delete(paneId)
		set({ activePtyIds: newSet })
	},

	init: async () => {
		try {
			const [loadedWorkspaces, loadedAppState, homeDir, snippets] = await Promise.all([
				window.api.getWorkspaces(),
				window.api.getAppState(),
				window.api.getHomeDir(),
				window.api.getSnippets(),
			])

			let workspaces = loadedWorkspaces
			let appState = loadedAppState

			// If no workspaces exist, create a default one
			if (workspaces.length === 0) {
				const { layout, panes } = createLayoutFromPreset('single', homeDir)
				const defaultWorkspace: Workspace = {
					id: crypto.randomUUID(),
					name: 'Default',
					color: WORKSPACE_COLORS[0]!,
					theme: defaultTheme(),
					layout,
					panes,
				}
				workspaces = [...workspaces, defaultWorkspace]
				appState = {
					...appState,
					openWorkspaceIds: [defaultWorkspace.id],
					activeWorkspaceId: defaultWorkspace.id,
				}
				await window.api.saveWorkspace(defaultWorkspace)
				await window.api.saveAppState(appState)
			}

			// Ensure at least one tab is open
			if (appState.openWorkspaceIds.length === 0 && workspaces.length > 0) {
				const firstId = workspaces[0]!.id
				appState = {
					...appState,
					openWorkspaceIds: [firstId],
					activeWorkspaceId: firstId,
				}
				await window.api.saveAppState(appState)
			}

			const initialVisited = appState.activeWorkspaceId ? [appState.activeWorkspaceId] : []
			const activeWs = workspaces.find((w) => w.id === appState.activeWorkspaceId)
			const initialFocusedPaneId = activeWs ? (Object.keys(activeWs.panes)[0] ?? null) : null
			set({
				workspaces,
				appState,
				homeDir,
				snippets,
				initialized: true,
				visitedWorkspaceIds: initialVisited,
				focusedPaneId: initialFocusedPaneId,
				focusGeneration: initialFocusedPaneId ? 1 : 0,
			})
		} catch (err) {
			console.error('[store] Failed to initialize:', err)
			set({ initError: String(err), initialized: true })
		}
	},

	...createWorkspacePaneSlice(set, get),

	saveState: async () => {
		await window.api.saveAppState(get().appState).catch((err) => {
			console.error('[store] Failed to save app state:', err)
		})
	},

	...createSnippetSlice(set, get),
}))

export { WORKSPACE_COLORS } from './workspace-pane-actions'
export {
	applyPresetWithRemap,
	createLayoutFromPreset,
	getFirstPaneId,
	getPaneIdsInOrder,
} from './layout-tree'
