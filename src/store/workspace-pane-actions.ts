import { THEME_PRESETS } from "../data/theme-presets";
import type {
	AgentStatus,
	AppState,
	DropPosition,
	LayoutLeaf,
	LayoutNode,
	LayoutPreset,
	PaneConfig,
	PaneTheme,
	PrInfo,
	SplitDirection,
	Workspace,
} from "../shared/types";
import {
	DEFAULT_CURSOR_STYLE,
	DEFAULT_SCROLLBACK,
	DEFAULT_UNFOCUSED_DIM,
	isLayoutBranch,
} from "../shared/types";
import { reorderArray } from "../utils/array";
import { isValidCwd } from "../utils/validation";
import {
	createLayoutFromPreset,
	remapLayoutTree,
	removeLeafFromTree,
	replaceLeafInTree,
	updateSizesAtPath,
} from "./layout-tree";

export function defaultTheme(): PaneTheme {
	return {
		background: THEME_PRESETS[0].background,
		foreground: THEME_PRESETS[0].foreground,
		fontSize: 14,
		unfocusedDim: DEFAULT_UNFOCUSED_DIM,
		scrollback: DEFAULT_SCROLLBACK,
		cursorStyle: DEFAULT_CURSOR_STYLE,
	};
}

function addToVisited(visited: string[], id: string): string[] {
	return visited.includes(id) ? visited : [...visited, id];
}

/** Remove pane-scoped ephemeral state (branches, PRs, agent statuses, titles) for a set of pane IDs. */
function cleanPaneEphemeral(
	state: {
		paneBranches: Record<string, string | null>;
		panePrs: Record<string, PrInfo | null>;
		paneAgentStatuses: Record<string, AgentStatus>;
		paneTitles: Record<string, string>;
	},
	paneIds: string[],
): {
	paneBranches: Record<string, string | null>;
	panePrs: Record<string, PrInfo | null>;
	paneAgentStatuses: Record<string, AgentStatus>;
	paneTitles: Record<string, string>;
} {
	const paneBranches = { ...state.paneBranches };
	const panePrs = { ...state.panePrs };
	const paneAgentStatuses = { ...state.paneAgentStatuses };
	const paneTitles = { ...state.paneTitles };
	for (const pid of paneIds) {
		delete paneBranches[pid];
		delete panePrs[pid];
		delete paneAgentStatuses[pid];
		delete paneTitles[pid];
	}
	return { paneBranches, panePrs, paneAgentStatuses, paneTitles };
}

export function persistAppState(appState: AppState): void {
	window.api.saveAppState(appState).catch((err) => {
		console.error("[store] Failed to save app state:", err);
	});
}

function customLayout(tree: LayoutNode): { type: "custom"; tree: LayoutNode } {
	return { type: "custom" as const, tree };
}

/** Persist a partial PaneConfig update to disk without triggering a store re-render.
 *  Fire-and-forget — used for caching git info so it's available on next startup. */
function persistPaneField(
	state: WorkspacePaneState,
	paneId: string,
	updates: Partial<PaneConfig>,
): void {
	const ws = state.workspaces.find((w) => paneId in w.panes);
	if (!ws || !ws.panes[paneId]) return;
	const updated: Workspace = {
		...ws,
		panes: { ...ws.panes, [paneId]: { ...ws.panes[paneId]!, ...updates } },
	};
	window.api.saveWorkspace(updated).catch((err) => {
		console.warn("[store] persistPaneField: save failed", err);
	});
}

/** Find a workspace, apply a transformation, and return the merged partial state.
 *  Persistence is fire-and-forget (errors are logged, not propagated).
 *  The updater receives the found workspace and current state.
 *  Return null from the updater to skip the update. */
function withWorkspace(
	state: WorkspacePaneState,
	workspaceId: string,
	updater: (
		ws: Workspace,
		st: WorkspacePaneState,
	) => { updated: Workspace; extra?: Partial<WorkspacePaneState> } | null,
): Partial<WorkspacePaneState> {
	const workspace = state.workspaces.find((w) => w.id === workspaceId);
	if (!workspace) {
		console.warn("[store] withWorkspace: workspace not found", workspaceId);
		return {};
	}
	const result = updater(workspace, state);
	if (!result) return {};
	window.api.saveWorkspace(result.updated).catch((err) => {
		console.error("[store] Failed to save workspace:", err);
	});
	return {
		workspaces: state.workspaces.map((w) => (w.id === workspaceId ? result.updated : w)),
		...result.extra,
	};
}

interface WorkspacePaneState {
	workspaces: Workspace[];
	appState: AppState;
	homeDir: string;
	focusedPaneId: string | null;
	focusGeneration: number;
	visitedWorkspaceIds: string[];
	paneBranches: Record<string, string | null>;
	panePrs: Record<string, PrInfo | null>;
	paneAgentStatuses: Record<string, AgentStatus>;
	paneTitles: Record<string, string>;
	killPtys: (paneIds: string[]) => void;
	createWorkspace: (name: string, preset: LayoutPreset) => Promise<Workspace>;
}

/** Zustand slice creator for workspace CRUD and pane manipulation actions. Spread into the main store. */
export function createWorkspacePaneSlice(
	set: (
		partial:
			| Partial<WorkspacePaneState>
			| ((state: WorkspacePaneState) => Partial<WorkspacePaneState>),
	) => void,
	get: () => WorkspacePaneState,
) {
	return {
		createWorkspace: async (name: string, preset: LayoutPreset) => {
			const { layout, panes } = createLayoutFromPreset(preset, get().homeDir);
			const workspace: Workspace = {
				id: crypto.randomUUID(),
				name,
				theme: defaultTheme(),
				layout,
				panes,
			};
			await window.api.saveWorkspace(workspace);

			const state = get();
			const newAppState = {
				...state.appState,
				openWorkspaceIds: [...state.appState.openWorkspaceIds, workspace.id],
				activeWorkspaceId: workspace.id,
			};
			await window.api.saveAppState(newAppState);

			set({
				workspaces: [...state.workspaces, workspace],
				appState: newAppState,
				visitedWorkspaceIds: addToVisited(state.visitedWorkspaceIds, workspace.id),
			});

			return workspace;
		},

		createDefaultWorkspace: async () => {
			const state = get();
			return state.createWorkspace(`Workspace ${state.workspaces.length + 1}`, "single");
		},

		updateWorkspace: async (workspace: Workspace) => {
			set((state) => ({
				workspaces: state.workspaces.map((w) => (w.id === workspace.id ? workspace : w)),
			}));
			await window.api.saveWorkspace(workspace);
		},

		duplicateWorkspace: async (id: string) => {
			const state = get();
			const source = state.workspaces.find((w) => w.id === id);
			if (!source) {
				console.warn("[store] duplicateWorkspace: source workspace not found", id);
				return null;
			}

			const idMap = new Map<string, string>();
			for (const paneId of Object.keys(source.panes)) {
				idMap.set(paneId, crypto.randomUUID());
			}
			const requireMapped = (oldId: string): string => {
				const newId = idMap.get(oldId);
				if (!newId) throw new Error(`[store] duplicateWorkspace: unmapped pane ID "${oldId}"`);
				return newId;
			};
			const newPanes: Record<string, PaneConfig> = {};
			for (const [oldId, config] of Object.entries(source.panes)) {
				newPanes[requireMapped(oldId)] = {
					...config,
					themeOverride: config.themeOverride ? { ...config.themeOverride } : null,
				};
			}
			const remappedTree = remapLayoutTree(source.layout.tree, requireMapped);
			const workspace: Workspace = {
				id: crypto.randomUUID(),
				name: `${source.name} (copy)`,
				theme: { ...source.theme },
				layout:
					source.layout.type === "preset"
						? { type: "preset", preset: source.layout.preset, tree: remappedTree }
						: { type: "custom", tree: remappedTree },
				panes: newPanes,
			};
			await window.api.saveWorkspace(workspace);
			const newAppState = {
				...state.appState,
				openWorkspaceIds: [...state.appState.openWorkspaceIds, workspace.id],
				activeWorkspaceId: workspace.id,
			};
			await window.api.saveAppState(newAppState);
			set({
				workspaces: [...state.workspaces, workspace],
				appState: newAppState,
				visitedWorkspaceIds: addToVisited(state.visitedWorkspaceIds, workspace.id),
			});
			return workspace;
		},

		removeWorkspace: async (id: string) => {
			const workspace = get().workspaces.find((w) => w.id === id);
			// Capture pane IDs before the await to avoid stale state after IPC
			const paneIds = workspace ? Object.keys(workspace.panes) : [];
			if (workspace) {
				get().killPtys(paneIds);
			}
			await window.api.deleteWorkspace(id);
			const afterDelete = get();
			const newOpen = afterDelete.appState.openWorkspaceIds.filter((wid) => wid !== id);
			const newActive =
				afterDelete.appState.activeWorkspaceId === id
					? (newOpen[0] ?? null)
					: afterDelete.appState.activeWorkspaceId;
			const newAppState = {
				...afterDelete.appState,
				openWorkspaceIds: newOpen,
				activeWorkspaceId: newActive,
				collapsedWorkspaceIds: afterDelete.appState.collapsedWorkspaceIds.filter(
					(wid) => wid !== id,
				),
			};
			await window.api.saveAppState(newAppState);
			const latest = get();
			set({
				workspaces: latest.workspaces.filter((w) => w.id !== id),
				appState: newAppState,
				visitedWorkspaceIds: latest.visitedWorkspaceIds.filter((wid) => wid !== id),
				...cleanPaneEphemeral(latest, paneIds),
			});
		},

		setActiveWorkspace: (id: string) => {
			set((state) => {
				const newAppState = { ...state.appState, activeWorkspaceId: id };
				persistAppState(newAppState);
				const ws = state.workspaces.find((w) => w.id === id);
				const firstPaneId = ws ? (Object.keys(ws.panes)[0] ?? null) : null;
				return {
					appState: newAppState,
					focusedPaneId: firstPaneId,
					focusGeneration: state.focusGeneration + 1,
					visitedWorkspaceIds: addToVisited(state.visitedWorkspaceIds, id),
				};
			});
		},

		openWorkspace: (id: string) => {
			set((state) => {
				const open = state.appState.openWorkspaceIds;
				const visited = addToVisited(state.visitedWorkspaceIds, id);
				if (open.includes(id)) {
					const newAppState = { ...state.appState, activeWorkspaceId: id };
					persistAppState(newAppState);
					return { appState: newAppState, visitedWorkspaceIds: visited };
				}
				const newAppState = {
					...state.appState,
					openWorkspaceIds: [...open, id],
					activeWorkspaceId: id,
				};
				persistAppState(newAppState);
				return { appState: newAppState, visitedWorkspaceIds: visited };
			});
		},

		closeWorkspaceTab: (id: string) => {
			const workspace = get().workspaces.find((w) => w.id === id);
			if (workspace) {
				get().killPtys(Object.keys(workspace.panes));
			}
			set((state) => {
				const newOpen = state.appState.openWorkspaceIds.filter((wid) => wid !== id);
				const newActive =
					state.appState.activeWorkspaceId === id
						? (newOpen[newOpen.length - 1] ?? null)
						: state.appState.activeWorkspaceId;
				const newAppState = {
					...state.appState,
					openWorkspaceIds: newOpen,
					activeWorkspaceId: newActive,
				};
				persistAppState(newAppState);
				const newVisited = state.visitedWorkspaceIds.filter((wid) => wid !== id);
				if (newActive && !newVisited.includes(newActive)) {
					newVisited.push(newActive);
				}
				const paneIds = workspace ? Object.keys(workspace.panes) : [];
				return {
					appState: newAppState,
					visitedWorkspaceIds: newVisited,
					...cleanPaneEphemeral(state, paneIds),
				};
			});
		},

		reorderWorkspaceTabs: (fromIndex: number, toIndex: number) => {
			set((state) => {
				const reordered = reorderArray(state.appState.openWorkspaceIds, fromIndex, toIndex);
				if (!reordered) return {};
				const newAppState = { ...state.appState, openWorkspaceIds: reordered };
				persistAppState(newAppState);
				return { appState: newAppState };
			});
		},

		splitPane: (workspaceId: string, paneId: string, direction: SplitDirection) => {
			set((state) =>
				withWorkspace(state, workspaceId, (workspace, st) => {
					if (!workspace.panes[paneId]) return null;
					const newPaneId = crypto.randomUUID();
					const newPane: PaneConfig = {
						label: "terminal",
						cwd: workspace.panes[paneId]!.cwd,
						startupCommand: null,
						themeOverride: null,
					};
					const newTree = replaceLeafInTree(workspace.layout.tree, paneId, (leaf) => ({
						direction,
						size: leaf.size,
						children: [
							{ paneId, size: 50 },
							{ paneId: newPaneId, size: 50 },
						],
					}));
					return {
						updated: {
							...workspace,
							layout: customLayout(newTree),
							panes: { ...workspace.panes, [newPaneId]: newPane },
						},
						extra: { focusedPaneId: newPaneId, focusGeneration: st.focusGeneration + 1 },
					};
				}),
			);
		},

		closePane: (workspaceId: string, paneId: string) => {
			const ws = get().workspaces.find((w) => w.id === workspaceId);
			if (!ws || Object.keys(ws.panes).length <= 1) return;
			get().killPtys([paneId]);

			set((state) =>
				withWorkspace(state, workspaceId, (workspace, st) => {
					if (Object.keys(workspace.panes).length <= 1) return null;
					const newTree = removeLeafFromTree(workspace.layout.tree, paneId);
					if (!newTree) return null;
					const { [paneId]: _, ...remainingPanes } = workspace.panes;
					return {
						updated: {
							...workspace,
							layout: customLayout(newTree),
							panes: remainingPanes,
						},
						extra: {
							focusedPaneId: st.focusedPaneId === paneId ? null : st.focusedPaneId,
							...cleanPaneEphemeral(st, [paneId]),
						},
					};
				}),
			);
		},

		movePaneToWorkspace: (fromWsId: string, paneId: string, toWsId: string) => {
			if (fromWsId === toWsId) return;

			set((state) => {
				const fromWs = state.workspaces.find((w) => w.id === fromWsId);
				const toWs = state.workspaces.find((w) => w.id === toWsId);
				if (!fromWs || !toWs) {
					console.error("[store] movePaneToWorkspace: workspace not found", { fromWsId, toWsId });
					return {};
				}
				if (Object.keys(fromWs.panes).length <= 1) {
					console.warn("[store] movePaneToWorkspace: cannot move last pane", fromWsId);
					return {};
				}
				const config = fromWs.panes[paneId];
				if (!config) {
					console.error("[store] movePaneToWorkspace: pane config not found", { paneId, fromWsId });
					return {};
				}
				if (toWs.panes[paneId]) {
					console.error("[store] movePaneToWorkspace: pane ID already exists in destination", {
						paneId,
						toWsId,
					});
					return {};
				}

				const newSourceTree = removeLeafFromTree(fromWs.layout.tree, paneId);
				if (!newSourceTree) {
					console.error("[store] movePaneToWorkspace: removeLeafFromTree returned null", {
						paneId,
						fromWsId,
					});
					return {};
				}
				const { [paneId]: _, ...remainingPanes } = fromWs.panes;
				const updatedFrom: Workspace = {
					...fromWs,
					layout: customLayout(newSourceTree),
					panes: remainingPanes,
				};

				const destRoot = toWs.layout.tree;
				let newDestTree: LayoutNode;
				if (isLayoutBranch(destRoot) && destRoot.direction === "horizontal") {
					const count = destRoot.children.length + 1;
					const size = Math.round(100 / count);
					const lastSize = 100 - size * (count - 1);
					newDestTree = {
						...destRoot,
						children: [
							...destRoot.children.map((c) => ({ ...c, size })),
							{ paneId, size: lastSize },
						],
					};
				} else {
					newDestTree = {
						direction: "horizontal",
						size: 100,
						children: [
							{ ...destRoot, size: 50 },
							{ paneId, size: 50 },
						],
					};
				}
				const updatedTo: Workspace = {
					...toWs,
					layout: customLayout(newDestTree),
					panes: { ...toWs.panes, [paneId]: config },
				};

				Promise.all([
					window.api.saveWorkspace(updatedFrom),
					window.api.saveWorkspace(updatedTo),
				]).catch((err) => {
					console.error("[store] movePaneToWorkspace: failed to save workspaces", {
						fromWsId,
						toWsId,
						err,
					});
				});

				const openIds = state.appState.openWorkspaceIds;
				const newOpen = openIds.includes(toWsId) ? openIds : [...openIds, toWsId];
				const newAppState = {
					...state.appState,
					openWorkspaceIds: newOpen,
					activeWorkspaceId: toWsId,
				};
				persistAppState(newAppState);

				return {
					workspaces: state.workspaces.map((w) => {
						if (w.id === fromWsId) return updatedFrom;
						if (w.id === toWsId) return updatedTo;
						return w;
					}),
					appState: newAppState,
					focusedPaneId: paneId,
					focusGeneration: state.focusGeneration + 1,
					visitedWorkspaceIds: addToVisited(state.visitedWorkspaceIds, toWsId),
				};
			});
		},

		swapPanes: (workspaceId: string, paneIdA: string, paneIdB: string) => {
			if (paneIdA === paneIdB) return;
			set((state) =>
				withWorkspace(state, workspaceId, (workspace) => {
					if (!workspace.panes[paneIdA] || !workspace.panes[paneIdB]) {
						console.error("[store] swapPanes: pane not found", { paneIdA, paneIdB, workspaceId });
						return null;
					}
					const swapMap = new Map([
						[paneIdA, paneIdB],
						[paneIdB, paneIdA],
					]);
					const swappedTree = remapLayoutTree(workspace.layout.tree, (id) => swapMap.get(id) ?? id);
					return {
						updated: { ...workspace, layout: customLayout(swappedTree) },
					};
				}),
			);
		},

		movePaneToPosition: (
			workspaceId: string,
			sourcePaneId: string,
			targetPaneId: string,
			position: DropPosition,
		) => {
			if (sourcePaneId === targetPaneId) return;
			set((state) =>
				withWorkspace(state, workspaceId, (workspace, st) => {
					if (!workspace.panes[sourcePaneId] || !workspace.panes[targetPaneId]) {
						console.error("[store] movePaneToPosition: pane not found", {
							sourcePaneId,
							targetPaneId,
							workspaceId,
						});
						return null;
					}
					const treeWithoutSource = removeLeafFromTree(workspace.layout.tree, sourcePaneId);
					if (!treeWithoutSource) {
						console.error("[store] movePaneToPosition: removeLeafFromTree returned null", {
							sourcePaneId,
							workspaceId,
						});
						return null;
					}
					const direction: SplitDirection =
						position === "left" || position === "right" ? "horizontal" : "vertical";
					const sourceFirst = position === "left" || position === "top";
					const newTree = replaceLeafInTree(treeWithoutSource, targetPaneId, (leaf) => {
						const sourceLeaf: LayoutLeaf = { paneId: sourcePaneId, size: 50 };
						const targetLeaf: LayoutLeaf = { paneId: targetPaneId, size: 50 };
						return {
							direction,
							size: leaf.size,
							children: sourceFirst ? [sourceLeaf, targetLeaf] : [targetLeaf, sourceLeaf],
						};
					});
					return {
						updated: { ...workspace, layout: { type: "custom" as const, tree: newTree } },
						extra: { focusedPaneId: sourcePaneId, focusGeneration: st.focusGeneration + 1 },
					};
				}),
			);
		},

		updatePaneConfig: (workspaceId: string, paneId: string, updates: Partial<PaneConfig>) => {
			set((state) =>
				withWorkspace(state, workspaceId, (workspace) => {
					if (!workspace.panes[paneId]) return null;
					return {
						updated: {
							...workspace,
							panes: {
								...workspace.panes,
								[paneId]: { ...workspace.panes[paneId]!, ...updates },
							},
						},
					};
				}),
			);
			// Notify the CWD tracker so branch/PR detection updates immediately.
			// This path is triggered by context menu CWD changes; updatePaneCwd
			// below handles CWD changes detected by the Rust tracker itself.
			if (updates.cwd && isValidCwd(updates.cwd)) {
				window.api.trackPaneGit(paneId, updates.cwd).catch((err) => {
					console.warn("[store] trackPaneGit failed:", err);
				});
			}
		},

		updatePaneCwd: (workspaceId: string, paneId: string, cwd: string) => {
			if (!isValidCwd(cwd)) {
				console.warn("[store] updatePaneCwd: invalid cwd", cwd);
				return;
			}
			set((state) =>
				withWorkspace(state, workspaceId, (workspace) => {
					if (!workspace.panes[paneId]) return null;
					if (workspace.panes[paneId]!.cwd === cwd) return null;
					return {
						updated: {
							...workspace,
							panes: { ...workspace.panes, [paneId]: { ...workspace.panes[paneId]!, cwd } },
						},
					};
				}),
			);
		},

		updatePaneBranch: (paneId: string, branch: string | null) => {
			set((state) => {
				if (state.paneBranches[paneId] === branch) return {};
				// Persist to pane config for instant rendering on next startup
				persistPaneField(state, paneId, { lastBranch: branch });
				return { paneBranches: { ...state.paneBranches, [paneId]: branch } };
			});
		},

		updatePanePr: (paneId: string, pr: PrInfo | null) => {
			set((state) => {
				const current = state.panePrs[paneId];
				if (
					current?.number === pr?.number &&
					current?.title === pr?.title &&
					current?.url === pr?.url
				) {
					return {};
				}
				// PR data is ephemeral remote state — don't persist to disk.
				// Unlike branch (local git), PRs go stale on merge and cause
				// stuck indicators if loaded from config on next startup.
				return { panePrs: { ...state.panePrs, [paneId]: pr } };
			});
		},

		updateNodeSizes: (workspaceId: string, path: number[], pixelSizes: number[]) => {
			const total = pixelSizes.reduce((a, b) => a + b, 0);
			if (!Number.isFinite(total) || total <= 0) return;
			const percentages = pixelSizes.map((s) => (s / total) * 100);
			set((state) =>
				withWorkspace(state, workspaceId, (workspace) => {
					const newTree = updateSizesAtPath(workspace.layout.tree, path, percentages);
					if (newTree === workspace.layout.tree) return null;
					return {
						updated: { ...workspace, layout: { type: "custom" as const, tree: newTree } },
					};
				}),
			);
		},
	};
}
