import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import { createLayoutFromPreset } from "../lib/layout-presets";
import {
	getFirstPaneId,
	getPaneIdsInOrder,
	remapTree,
	removeLeaf,
	splitAtPane,
	updateSizesAtPath,
} from "../lib/layout-tree";
import type { CellGrid } from "../types/terminal";
import type {
	LayoutBranch,
	LayoutNode,
	LayoutPreset,
	PaneConfig,
	Workspace,
	WorkspaceLayout,
} from "../types/workspace";
import { WORKSPACE_COLORS } from "../types/workspace";

const EVENT_TERMINAL_OUTPUT = "terminal-output";
const EVENT_TERMINAL_EXIT = "terminal-exit";

function generateId(): string {
	return crypto.randomUUID();
}

/** Pick the next color from the palette based on workspace count. */
function nextColor(count: number): (typeof WORKSPACE_COLORS)[number] {
	// Fallback satisfies noUncheckedIndexedAccess — modulo guarantees a valid index
	return WORKSPACE_COLORS[count % WORKSPACE_COLORS.length] ?? "#6c63ff";
}

/** Find which workspace owns a pane, checking active workspace first. */
function findWorkspaceForPane(
	workspaces: Record<string, Workspace>,
	activeWorkspaceId: string | null,
	paneId: string,
): string | undefined {
	if (activeWorkspaceId) {
		const active = workspaces[activeWorkspaceId];
		if (active && paneId in active.panes) return activeWorkspaceId;
	}
	for (const [wsId, ws] of Object.entries(workspaces)) {
		if (wsId !== activeWorkspaceId && paneId in ws.panes) return wsId;
	}
	return undefined;
}

/** Shorthand for { type: "custom", tree } layout. */
function customLayout(tree: LayoutNode): WorkspaceLayout {
	return { type: "custom", tree };
}

/** Fire-and-forget terminal destruction with error logging. */
function destroyTerminalAsync(terminalId: string): void {
	invoke("destroy_terminal", { id: terminalId }).catch(console.error);
}

/** Format an unknown error value for display. */
function formatError(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

// -- Per-pane terminal state --

export interface PaneTerminalState {
	terminalId: string | null;
	grid: CellGrid | null;
	connected: boolean;
	error: string | null;
}

const DEFAULT_PANE_TERMINAL: PaneTerminalState = {
	terminalId: null,
	grid: null,
	connected: false,
	error: null,
};

// -- Store shape --

export interface WorkspaceStoreState {
	workspaces: Record<string, Workspace>;
	openWorkspaceIds: string[];
	activeWorkspaceId: string | null;
	activePaneId: string | null;
	paneTerminals: Record<string, PaneTerminalState>;
}

export interface WorkspaceStoreActions {
	// Workspace CRUD
	createWorkspace: (preset?: LayoutPreset, name?: string) => string;
	duplicateWorkspace: (workspaceId: string) => string | null;
	removeWorkspace: (workspaceId: string) => void;
	renameWorkspace: (workspaceId: string, name: string) => void;
	setWorkspaceColor: (workspaceId: string, color: Workspace["color"]) => void;
	reorderWorkspaces: (ids: string[]) => void;

	// Navigation
	setActiveWorkspace: (workspaceId: string) => void;
	setActivePane: (paneId: string) => void;

	// Pane operations
	splitPane: (paneId: string, direction: LayoutBranch["direction"]) => void;
	closePane: (paneId: string) => void;
	updatePaneSizes: (workspaceId: string, path: readonly number[], sizes: readonly number[]) => void;

	// Per-pane terminal IPC
	initPane: (paneId: string) => Promise<void>;
	writeToPane: (paneId: string, data: string) => Promise<void>;
	resizePane: (paneId: string, cols: number, rows: number) => Promise<void>;
	refreshPaneGrid: (paneId: string) => Promise<void>;

	// Workspace lifecycle
	initWorkspace: (workspaceId: string) => Promise<void>;
	destroyAllTerminals: () => void;

	// Global event subscription
	subscribeToEvents: () => Promise<() => void>;
}

export type WorkspaceStore = WorkspaceStoreState & WorkspaceStoreActions;

export const useWorkspaceStore = create<WorkspaceStore>()((set, get) => {
	// Coalesces rapid terminal-output events into one rAF refresh per pane
	const pendingRefreshPanes = new Set<string>();

	// Guards against concurrent initPane calls for the same pane (TOCTOU protection)
	const initializingPanes = new Set<string>();

	// Tracks which workspaces have been initialized (lazy terminal creation)
	const visitedWorkspaceIds = new Set<string>();

	// Reverse lookup: terminal-output/exit events arrive with terminalId, but store is keyed by paneId
	const terminalToPaneMap = new Map<string, string>();

	function findPaneByTerminalId(terminalId: string): string | undefined {
		return terminalToPaneMap.get(terminalId);
	}

	/** Update a single pane's terminal state with a partial patch. */
	function setPaneTerminal(paneId: string, patch: Partial<PaneTerminalState>): void {
		set((state) => {
			const current = state.paneTerminals[paneId];
			return {
				paneTerminals: {
					...state.paneTerminals,
					[paneId]: { ...DEFAULT_PANE_TERMINAL, ...current, ...patch },
				},
			};
		});
	}

	/** Update a single workspace field atomically via set() callback. */
	function updateWorkspace(workspaceId: string, patch: Partial<Workspace>): void {
		set((state) => {
			const ws = state.workspaces[workspaceId];
			if (!ws) return state;
			return {
				workspaces: { ...state.workspaces, [workspaceId]: { ...ws, ...patch } },
			};
		});
	}

	/** Register a new workspace and make it active. */
	function registerWorkspace(id: string, workspace: Workspace, tree: LayoutNode): void {
		visitedWorkspaceIds.add(id);
		set((state) => ({
			workspaces: { ...state.workspaces, [id]: workspace },
			openWorkspaceIds: [...state.openWorkspaceIds, id],
			activeWorkspaceId: id,
			activePaneId: getFirstPaneId(tree) ?? null,
		}));
	}

	return {
		// -- Initial state --
		workspaces: {},
		openWorkspaceIds: [],
		activeWorkspaceId: null,
		activePaneId: null,
		paneTerminals: {},

		// -- Workspace CRUD --

		createWorkspace: (preset: LayoutPreset = "single", name?: string) => {
			const id = generateId();
			const count = Object.keys(get().workspaces).length;
			const color = nextColor(count);
			const { layout, panes } = createLayoutFromPreset(preset, generateId, "");

			const workspace: Workspace = {
				id,
				name: name ?? `Workspace ${count + 1}`,
				color,
				layout,
				panes,
			};

			registerWorkspace(id, workspace, layout.tree);
			return id;
		},

		duplicateWorkspace: (workspaceId: string) => {
			const workspace = get().workspaces[workspaceId];
			if (!workspace) return null;

			const newId = generateId();
			const idMap = new Map<string, string>();

			const newTree = remapTree(workspace.layout.tree, (oldId: string) => {
				const newPaneId = generateId();
				idMap.set(oldId, newPaneId);
				return newPaneId;
			});

			const newPanes: Record<string, PaneConfig> = {};
			for (const [oldId, config] of Object.entries(workspace.panes)) {
				const newPaneId = idMap.get(oldId);
				if (newPaneId) {
					newPanes[newPaneId] = { ...config };
				}
			}

			const count = Object.keys(get().workspaces).length;
			const newWorkspace: Workspace = {
				id: newId,
				name: `${workspace.name} (copy)`,
				color: nextColor(count),
				layout: { ...workspace.layout, tree: newTree },
				panes: newPanes,
			};

			registerWorkspace(newId, newWorkspace, newTree);
			return newId;
		},

		removeWorkspace: (workspaceId: string) => {
			const { workspaces, openWorkspaceIds, activeWorkspaceId, activePaneId, paneTerminals } =
				get();
			const workspace = workspaces[workspaceId];
			if (!workspace) return;

			// Collect terminal IDs for async cleanup
			const paneIds = Object.keys(workspace.panes);
			const terminalIds = paneIds
				.map((id) => paneTerminals[id]?.terminalId)
				.filter((tid): tid is string => tid != null);

			// Build new state
			const { [workspaceId]: _removedWorkspace, ...remainingWorkspaces } = workspaces;
			const newOpenIds = openWorkspaceIds.filter((id) => id !== workspaceId);
			const newPaneTerminals = { ...paneTerminals };
			for (const paneId of paneIds) {
				const tid = newPaneTerminals[paneId]?.terminalId;
				if (tid) terminalToPaneMap.delete(tid);
				delete newPaneTerminals[paneId];
			}

			// Determine new active workspace
			let newActiveId = activeWorkspaceId;
			let newActivePaneId = activePaneId;

			if (newActiveId === workspaceId) {
				const oldIndex = openWorkspaceIds.indexOf(workspaceId);
				newActiveId = newOpenIds[Math.min(oldIndex, newOpenIds.length - 1)] ?? null;
				if (newActiveId) {
					const nextWs = remainingWorkspaces[newActiveId];
					newActivePaneId = nextWs ? (getFirstPaneId(nextWs.layout.tree) ?? null) : null;
				} else {
					newActivePaneId = null;
				}
			}

			visitedWorkspaceIds.delete(workspaceId);

			set({
				workspaces: remainingWorkspaces,
				openWorkspaceIds: newOpenIds,
				activeWorkspaceId: newActiveId,
				activePaneId: newActivePaneId,
				paneTerminals: newPaneTerminals,
			});

			// Async cleanup
			for (const tid of terminalIds) {
				destroyTerminalAsync(tid);
			}

			// If no workspaces left, create a new default one
			if (newOpenIds.length === 0) {
				const fallbackId = get().createWorkspace();
				get().initWorkspace(fallbackId).catch(console.error);
			}
		},

		renameWorkspace: (workspaceId: string, name: string) => {
			updateWorkspace(workspaceId, { name });
		},

		setWorkspaceColor: (workspaceId: string, color: Workspace["color"]) => {
			updateWorkspace(workspaceId, { color });
		},

		reorderWorkspaces: (ids: string[]) => {
			const { workspaces } = get();
			const valid = ids.every((id) => id in workspaces);
			if (!valid) return;
			set({ openWorkspaceIds: ids });
		},

		// -- Navigation --

		setActiveWorkspace: (workspaceId: string) => {
			const workspace = get().workspaces[workspaceId];
			if (!workspace) return;

			const wasVisited = visitedWorkspaceIds.has(workspaceId);
			const firstPaneId = getFirstPaneId(workspace.layout.tree) ?? null;

			visitedWorkspaceIds.add(workspaceId);
			set({
				activeWorkspaceId: workspaceId,
				activePaneId: firstPaneId,
			});

			if (!wasVisited) {
				get().initWorkspace(workspaceId).catch(console.error);
			}
		},

		setActivePane: (paneId: string) => {
			set({ activePaneId: paneId });
		},

		// -- Pane operations --

		splitPane: (paneId: string, direction: LayoutBranch["direction"]) => {
			const { workspaces, activeWorkspaceId } = get();
			const workspaceId = findWorkspaceForPane(workspaces, activeWorkspaceId, paneId);
			if (!workspaceId) return;

			const workspace = workspaces[workspaceId];
			if (!workspace) return;

			const newPaneId = generateId();
			const newTree = splitAtPane(workspace.layout.tree, paneId, newPaneId, direction);

			// If tree didn't change (pane not found), bail
			if (newTree === workspace.layout.tree) return;

			const newPaneConfig: PaneConfig = {
				label: "",
				cwd: workspace.panes[paneId]?.cwd ?? "",
				startupCommand: null,
			};

			set((state) => {
				const current = state.workspaces[workspaceId];
				if (!current) return state;
				return {
					workspaces: {
						...state.workspaces,
						[workspaceId]: {
							...current,
							layout: customLayout(newTree),
							panes: { ...current.panes, [newPaneId]: newPaneConfig },
						},
					},
					activePaneId: newPaneId,
				};
			});

			// Initialize terminal for the new pane
			get().initPane(newPaneId).catch(console.error);
		},

		closePane: (paneId: string) => {
			const { workspaces, activeWorkspaceId } = get();
			const workspaceId = findWorkspaceForPane(workspaces, activeWorkspaceId, paneId);
			if (!workspaceId) return;

			const workspace = workspaces[workspaceId];
			if (!workspace) return;

			const newTree = removeLeaf(workspace.layout.tree, paneId);

			// Collect terminal ID before removing state
			const terminalId = get().paneTerminals[paneId]?.terminalId;

			if (newTree === undefined) {
				// Last pane removed — remove workspace
				get().removeWorkspace(workspaceId);
				return;
			}

			// No change (pane not found)
			if (newTree === workspace.layout.tree) return;

			if (terminalId) terminalToPaneMap.delete(terminalId);

			set((state) => {
				const current = state.workspaces[workspaceId];
				if (!current) return state;
				const { [paneId]: _removedPane, ...remainingPanes } = current.panes;
				const { [paneId]: _removedTerminal, ...remainingPaneTerminals } = state.paneTerminals;

				let newActivePaneId = state.activePaneId;
				if (newActivePaneId === paneId) {
					newActivePaneId = getFirstPaneId(newTree) ?? null;
				}

				return {
					workspaces: {
						...state.workspaces,
						[workspaceId]: {
							...current,
							layout: customLayout(newTree),
							panes: remainingPanes,
						},
					},
					activePaneId: newActivePaneId,
					paneTerminals: remainingPaneTerminals,
				};
			});

			// Async cleanup
			if (terminalId) {
				destroyTerminalAsync(terminalId);
			}
		},

		updatePaneSizes: (workspaceId: string, path: readonly number[], sizes: readonly number[]) => {
			set((state) => {
				const workspace = state.workspaces[workspaceId];
				if (!workspace) return state;

				const newTree = updateSizesAtPath(workspace.layout.tree, path, sizes);
				if (newTree === workspace.layout.tree) return state;

				return {
					workspaces: {
						...state.workspaces,
						[workspaceId]: { ...workspace, layout: customLayout(newTree) },
					},
				};
			});
		},

		// -- Per-pane terminal IPC --

		initPane: async (paneId: string) => {
			if (get().paneTerminals[paneId]?.terminalId) return;
			if (initializingPanes.has(paneId)) return;
			initializingPanes.add(paneId);

			try {
				const terminalId = await invoke<string>("create_terminal");
				terminalToPaneMap.set(terminalId, paneId);
				setPaneTerminal(paneId, { terminalId, connected: true });
				await get().refreshPaneGrid(paneId);
			} catch (e) {
				setPaneTerminal(paneId, { error: `Failed to create terminal: ${formatError(e)}` });
			} finally {
				initializingPanes.delete(paneId);
			}
		},

		writeToPane: async (paneId: string, data: string) => {
			const terminalId = get().paneTerminals[paneId]?.terminalId;
			if (!terminalId) return;
			try {
				await invoke("write_to_terminal", { id: terminalId, data });
			} catch (e) {
				setPaneTerminal(paneId, { connected: false, error: `Write failed: ${formatError(e)}` });
			}
		},

		resizePane: async (paneId: string, cols: number, rows: number) => {
			const terminalId = get().paneTerminals[paneId]?.terminalId;
			if (!terminalId) return;
			try {
				await invoke("resize_terminal", { id: terminalId, cols, rows });
			} catch (e) {
				setPaneTerminal(paneId, { connected: false, error: `Resize failed: ${formatError(e)}` });
			}
		},

		refreshPaneGrid: async (paneId: string) => {
			const terminalId = get().paneTerminals[paneId]?.terminalId;
			if (!terminalId) return;
			try {
				const grid = await invoke<CellGrid>("get_terminal_state", { id: terminalId });
				setPaneTerminal(paneId, { grid });
			} catch (e) {
				setPaneTerminal(paneId, {
					connected: false,
					error: `Grid refresh failed: ${formatError(e)}`,
				});
			}
		},

		// -- Workspace lifecycle --

		initWorkspace: async (workspaceId: string) => {
			const workspace = get().workspaces[workspaceId];
			if (!workspace) return;

			const paneIds = getPaneIdsInOrder(workspace.layout.tree);
			await Promise.all(paneIds.map((paneId) => get().initPane(paneId)));
		},

		destroyAllTerminals: () => {
			const { paneTerminals } = get();
			for (const pts of Object.values(paneTerminals)) {
				if (pts.terminalId) {
					destroyTerminalAsync(pts.terminalId);
				}
			}
			terminalToPaneMap.clear();
		},

		// -- Global event subscription --

		subscribeToEvents: async () => {
			const unlistenOutput = await listen<unknown>(EVENT_TERMINAL_OUTPUT, (event) => {
				if (typeof event.payload !== "string") return;
				const terminalId = event.payload;
				const paneId = findPaneByTerminalId(terminalId);
				if (!paneId) return;

				if (pendingRefreshPanes.has(paneId)) return;
				pendingRefreshPanes.add(paneId);
				requestAnimationFrame(() => {
					pendingRefreshPanes.delete(paneId);
					get().refreshPaneGrid(paneId);
				});
			});

			const unlistenExit = await listen<unknown>(EVENT_TERMINAL_EXIT, (event) => {
				if (typeof event.payload !== "string") return;
				const terminalId = event.payload;
				const paneId = findPaneByTerminalId(terminalId);
				if (!paneId) return;

				terminalToPaneMap.delete(terminalId);
				setPaneTerminal(paneId, { terminalId: null, connected: false });
			});

			return () => {
				unlistenOutput();
				unlistenExit();
			};
		},
	};
});
