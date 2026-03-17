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
import type { LayoutBranch, LayoutPreset, PaneConfig, Workspace } from "../types/workspace";
import { WORKSPACE_COLORS } from "../types/workspace";

const EVENT_TERMINAL_OUTPUT = "terminal-output";
const EVENT_TERMINAL_EXIT = "terminal-exit";

function generateId(): string {
	return crypto.randomUUID();
}

/** Pick the next color from the palette based on workspace count. */
function nextColor(count: number): (typeof WORKSPACE_COLORS)[number] {
	return WORKSPACE_COLORS[count % WORKSPACE_COLORS.length] ?? "#6c63ff";
}

/** Find which workspace owns a pane, checking active workspace first. */
function findWorkspaceForPane(
	workspaces: Record<string, Workspace>,
	activeWorkspaceId: string | null,
	paneId: string,
): string | undefined {
	// Fast path: check active workspace first
	if (activeWorkspaceId) {
		const active = workspaces[activeWorkspaceId];
		if (active && paneId in active.panes) return activeWorkspaceId;
	}
	for (const [wsId, ws] of Object.entries(workspaces)) {
		if (paneId in ws.panes) return wsId;
	}
	return undefined;
}

// -- Per-pane terminal state --

export interface PaneTerminalState {
	terminalId: string | null;
	grid: CellGrid | null;
	connected: boolean;
	error: string | null;
}

// -- Store shape --

export interface WorkspaceStoreState {
	workspaces: Record<string, Workspace>;
	openWorkspaceIds: string[];
	activeWorkspaceId: string | null;
	activePaneId: string | null;
	visitedWorkspaceIds: Set<string>;
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

	// Global event subscription
	subscribeToEvents: () => Promise<() => void>;
}

export type WorkspaceStore = WorkspaceStoreState & WorkspaceStoreActions;

export const useWorkspaceStore = create<WorkspaceStore>()((set, get) => {
	const pendingRefreshPanes = new Set<string>();

	function findPaneByTerminalId(terminalId: string): string | undefined {
		const terminals = get().paneTerminals;
		for (const [paneId, state] of Object.entries(terminals)) {
			if (state.terminalId === terminalId) return paneId;
		}
		return undefined;
	}

	return {
		// -- Initial state --
		workspaces: {},
		openWorkspaceIds: [],
		activeWorkspaceId: null,
		activePaneId: null,
		visitedWorkspaceIds: new Set<string>(),
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

			set((state) => ({
				workspaces: { ...state.workspaces, [id]: workspace },
				openWorkspaceIds: [...state.openWorkspaceIds, id],
				activeWorkspaceId: id,
				activePaneId: getFirstPaneId(layout.tree) ?? null,
				visitedWorkspaceIds: new Set([...state.visitedWorkspaceIds, id]),
			}));

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

			set((state) => ({
				workspaces: { ...state.workspaces, [newId]: newWorkspace },
				openWorkspaceIds: [...state.openWorkspaceIds, newId],
				activeWorkspaceId: newId,
				activePaneId: getFirstPaneId(newTree) ?? null,
				visitedWorkspaceIds: new Set([...state.visitedWorkspaceIds, newId]),
			}));

			return newId;
		},

		removeWorkspace: (workspaceId: string) => {
			const workspace = get().workspaces[workspaceId];
			if (!workspace) return;

			// Collect terminal IDs for async cleanup
			const paneIds = Object.keys(workspace.panes);
			const terminalIds: string[] = [];
			for (const paneId of paneIds) {
				const tid = get().paneTerminals[paneId]?.terminalId;
				if (tid) terminalIds.push(tid);
			}

			// Build new state
			const { [workspaceId]: _, ...remainingWorkspaces } = get().workspaces;
			const newOpenIds = get().openWorkspaceIds.filter((id) => id !== workspaceId);
			const newPaneTerminals = { ...get().paneTerminals };
			for (const paneId of paneIds) {
				delete newPaneTerminals[paneId];
			}

			// Determine new active workspace
			let newActiveId = get().activeWorkspaceId;
			let newActivePaneId = get().activePaneId;

			if (newActiveId === workspaceId) {
				const oldIndex = get().openWorkspaceIds.indexOf(workspaceId);
				newActiveId = newOpenIds[Math.min(oldIndex, newOpenIds.length - 1)] ?? null;
				if (newActiveId) {
					const nextWs = remainingWorkspaces[newActiveId];
					newActivePaneId = nextWs ? (getFirstPaneId(nextWs.layout.tree) ?? null) : null;
				} else {
					newActivePaneId = null;
				}
			}

			const newVisited = new Set(get().visitedWorkspaceIds);
			newVisited.delete(workspaceId);

			set({
				workspaces: remainingWorkspaces,
				openWorkspaceIds: newOpenIds,
				activeWorkspaceId: newActiveId,
				activePaneId: newActivePaneId,
				visitedWorkspaceIds: newVisited,
				paneTerminals: newPaneTerminals,
			});

			// Async cleanup — fire and forget
			for (const tid of terminalIds) {
				invoke("destroy_terminal", { id: tid }).catch(console.error);
			}

			// If no workspaces left, create a new default one
			if (newOpenIds.length === 0) {
				get().createWorkspace();
			}
		},

		renameWorkspace: (workspaceId: string, name: string) => {
			const workspace = get().workspaces[workspaceId];
			if (!workspace) return;
			set((state) => ({
				workspaces: { ...state.workspaces, [workspaceId]: { ...workspace, name } },
			}));
		},

		setWorkspaceColor: (workspaceId: string, color: Workspace["color"]) => {
			const workspace = get().workspaces[workspaceId];
			if (!workspace) return;
			set((state) => ({
				workspaces: { ...state.workspaces, [workspaceId]: { ...workspace, color } },
			}));
		},

		reorderWorkspaces: (ids: string[]) => {
			set({ openWorkspaceIds: ids });
		},

		// -- Navigation --

		setActiveWorkspace: (workspaceId: string) => {
			const workspace = get().workspaces[workspaceId];
			if (!workspace) return;

			const wasVisited = get().visitedWorkspaceIds.has(workspaceId);
			const firstPaneId = getFirstPaneId(workspace.layout.tree) ?? null;

			set((state) => ({
				activeWorkspaceId: workspaceId,
				activePaneId: firstPaneId,
				visitedWorkspaceIds: new Set([...state.visitedWorkspaceIds, workspaceId]),
			}));

			if (!wasVisited) {
				get().initWorkspace(workspaceId);
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

			set((state) => ({
				workspaces: {
					...state.workspaces,
					[workspaceId]: {
						...workspace,
						layout: { type: "custom", tree: newTree },
						panes: { ...workspace.panes, [newPaneId]: newPaneConfig },
					},
				},
				activePaneId: newPaneId,
			}));

			// Initialize terminal for the new pane
			get().initPane(newPaneId);
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

			const { [paneId]: _removedPane, ...remainingPanes } = workspace.panes;
			const { [paneId]: _removedTerminal, ...remainingPaneTerminals } = get().paneTerminals;

			let newActivePaneId = get().activePaneId;
			if (newActivePaneId === paneId) {
				newActivePaneId = getFirstPaneId(newTree) ?? null;
			}

			set({
				workspaces: {
					...get().workspaces,
					[workspaceId]: {
						...workspace,
						layout: { type: "custom", tree: newTree },
						panes: remainingPanes,
					},
				},
				activePaneId: newActivePaneId,
				paneTerminals: remainingPaneTerminals,
			});

			// Async cleanup
			if (terminalId) {
				invoke("destroy_terminal", { id: terminalId }).catch(console.error);
			}
		},

		updatePaneSizes: (workspaceId: string, path: readonly number[], sizes: readonly number[]) => {
			const workspace = get().workspaces[workspaceId];
			if (!workspace) return;

			const newTree = updateSizesAtPath(workspace.layout.tree, path, sizes);
			if (newTree === workspace.layout.tree) return;

			set((state) => ({
				workspaces: {
					...state.workspaces,
					[workspaceId]: {
						...workspace,
						layout: { type: "custom", tree: newTree },
					},
				},
			}));
		},

		// -- Per-pane terminal IPC --

		initPane: async (paneId: string) => {
			if (get().paneTerminals[paneId]?.terminalId) return;

			try {
				const terminalId = await invoke<string>("create_terminal");
				set((state) => ({
					paneTerminals: {
						...state.paneTerminals,
						[paneId]: { terminalId, grid: null, connected: true, error: null },
					},
				}));
				await get().refreshPaneGrid(paneId);
			} catch (e) {
				set((state) => ({
					paneTerminals: {
						...state.paneTerminals,
						[paneId]: {
							terminalId: null,
							grid: null,
							connected: false,
							error: `Failed to create terminal: ${e}`,
						},
					},
				}));
			}
		},

		writeToPane: async (paneId: string, data: string) => {
			const terminalId = get().paneTerminals[paneId]?.terminalId;
			if (!terminalId) return;
			try {
				await invoke("write_to_terminal", { id: terminalId, data });
			} catch (e) {
				set((state) => ({
					paneTerminals: {
						...state.paneTerminals,
						[paneId]: {
							...state.paneTerminals[paneId],
							terminalId: state.paneTerminals[paneId]?.terminalId ?? null,
							grid: state.paneTerminals[paneId]?.grid ?? null,
							connected: false,
							error: `Write failed: ${e}`,
						},
					},
				}));
			}
		},

		resizePane: async (paneId: string, cols: number, rows: number) => {
			const terminalId = get().paneTerminals[paneId]?.terminalId;
			if (!terminalId) return;
			try {
				await invoke("resize_terminal", { id: terminalId, cols, rows });
			} catch (e) {
				console.error(`Failed to resize pane ${paneId}:`, e);
			}
		},

		refreshPaneGrid: async (paneId: string) => {
			const terminalId = get().paneTerminals[paneId]?.terminalId;
			if (!terminalId) return;
			try {
				const grid = await invoke<CellGrid>("get_terminal_state", { id: terminalId });
				set((state) => ({
					paneTerminals: {
						...state.paneTerminals,
						[paneId]: {
							...state.paneTerminals[paneId],
							terminalId: state.paneTerminals[paneId]?.terminalId ?? null,
							connected: state.paneTerminals[paneId]?.connected ?? false,
							error: state.paneTerminals[paneId]?.error ?? null,
							grid,
						},
					},
				}));
			} catch (e) {
				console.error(`Failed to refresh grid for pane ${paneId}:`, e);
			}
		},

		// -- Workspace lifecycle --

		initWorkspace: async (workspaceId: string) => {
			const workspace = get().workspaces[workspaceId];
			if (!workspace) return;

			const paneIds = getPaneIdsInOrder(workspace.layout.tree);
			for (const paneId of paneIds) {
				await get().initPane(paneId);
			}
		},

		// -- Global event subscription --

		subscribeToEvents: async () => {
			const unlistenOutput = await listen<unknown>(EVENT_TERMINAL_OUTPUT, (event) => {
				const terminalId = event.payload as string;
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
				const terminalId = event.payload as string;
				const paneId = findPaneByTerminalId(terminalId);
				if (!paneId) return;

				set((state) => ({
					paneTerminals: {
						...state.paneTerminals,
						[paneId]: {
							...state.paneTerminals[paneId],
							terminalId: null,
							grid: state.paneTerminals[paneId]?.grid ?? null,
							connected: false,
							error: null,
						},
					},
				}));
			});

			return () => {
				unlistenOutput();
				unlistenExit();
			};
		},
	};
});
